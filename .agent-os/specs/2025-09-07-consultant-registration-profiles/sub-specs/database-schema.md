# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-09-07-consultant-registration-profiles/spec.md

## Schema Changes

### New Tables

#### users
Unified user table replacing/extending current email-only authentication
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('consultant', 'producer', 'staff')),
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_type ON users(user_type);
```

#### consultant_profiles
Stores consultant-specific profile information
```sql
CREATE TABLE consultant_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  specialization VARCHAR(20) NOT NULL CHECK (specialization IN ('nutritionist', 'veterinarian')),
  credentials TEXT, -- Max 1000 chars enforced at application level
  profile_photo TEXT, -- Base64 encoded image
  profile_complete_percentage INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_consultant_profiles_user_id ON consultant_profiles(user_id);
CREATE INDEX idx_consultant_profiles_specialization ON consultant_profiles(specialization);
```

#### refresh_tokens
JWT refresh token storage for secure token rotation
```sql
CREATE TABLE refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
```

#### email_verifications
Email verification token management
```sql
CREATE TABLE email_verifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_verifications_token ON email_verifications(token_hash);
CREATE INDEX idx_email_verifications_user_id ON email_verifications(user_id);
```

#### consultant_producer_invitations
Manages consultant to producer invitations
```sql
CREATE TABLE consultant_producer_invitations (
  id SERIAL PRIMARY KEY,
  consultant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  producer_email VARCHAR(255) NOT NULL,
  producer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  invitation_token VARCHAR(255) UNIQUE NOT NULL,
  custom_message TEXT,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  declined_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invitations_consultant_id ON consultant_producer_invitations(consultant_id);
CREATE INDEX idx_invitations_producer_email ON consultant_producer_invitations(producer_email);
CREATE INDEX idx_invitations_status ON consultant_producer_invitations(status);
CREATE INDEX idx_invitations_token ON consultant_producer_invitations(invitation_token);
```

#### consultant_producer_relationships
Active relationships between consultants and producers
```sql
CREATE TABLE consultant_producer_relationships (
  id SERIAL PRIMARY KEY,
  consultant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  producer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_id INTEGER REFERENCES operations(id) ON DELETE CASCADE,
  permissions JSONB DEFAULT '{"view": true, "edit": false, "admin": false}',
  established_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(consultant_id, producer_id)
);

CREATE INDEX idx_relationships_consultant_id ON consultant_producer_relationships(consultant_id);
CREATE INDEX idx_relationships_producer_id ON consultant_producer_relationships(producer_id);
```

### Modifications to Existing Tables

#### operations table
Add user_id foreign key to link with new users table
```sql
ALTER TABLE operations 
ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Migration: Link existing operations to new users based on email
UPDATE operations o
SET user_id = u.id
FROM users u
WHERE o.operator_email = u.email;
```

#### staffMembers table
Add user_id to link staff with users table
```sql
ALTER TABLE "staffMembers"
ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
```

## Migration Strategy

1. **Phase 1**: Create new tables without affecting existing system
2. **Phase 2**: Migrate existing producer data to users table with generated usernames
3. **Phase 3**: Update application code to use new authentication
4. **Phase 4**: Deprecate email-only authentication after migration period

## Data Integrity Rules

- Username must be unique across all user types
- Email must be unique and valid format
- One consultant_profile per consultant user
- Consultant can have multiple producer relationships
- Producer can have multiple consultant relationships
- Invitation tokens expire after 7 days
- Refresh tokens expire after 30 days
- Email verification tokens expire after 24 hours

## Performance Considerations

- Indexed all foreign keys for join performance
- Indexed email and username for fast lookups
- Indexed status fields for filtering operations
- Token fields indexed for verification queries
- Consider partitioning invitation table by created_at if volume grows

## Rollback Plan

```sql
-- If rollback needed
DROP TABLE IF EXISTS consultant_producer_relationships CASCADE;
DROP TABLE IF EXISTS consultant_producer_invitations CASCADE;
DROP TABLE IF EXISTS email_verifications CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS consultant_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

ALTER TABLE operations DROP COLUMN IF EXISTS user_id;
ALTER TABLE "staffMembers" DROP COLUMN IF EXISTS user_id;
```