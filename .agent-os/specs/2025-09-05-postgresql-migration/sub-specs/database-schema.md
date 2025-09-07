# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-09-05-postgresql-migration/spec.md

## Schema Overview

The database schema is already defined in `shared/schema.ts` using Drizzle ORM. This migration will utilize the existing schema definitions without modifications to maintain compatibility.

## Existing Tables to Migrate

### Core Tables (Already Defined)
- **operations** - Cattle operation details with owner information
- **staffMembers** - Team members with roles and status
- **staffInvitations** - Pending invitation tokens
- **pens** - Cattle pen configurations and current status
- **feedingRecords** - Historical feeding data with ingredients
- **feedingSchedules** - Planned feeding programs
- **treatments** - Medical treatment records
- **deathLosses** - Mortality tracking records
- **weightRecords** - Cattle weight history

### New Session Table (Required for connect-pg-simple)
```sql
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
) WITH (OIDS=FALSE);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
```

## Migration Approach

### Phase 1: Initial Setup
- Run `npm run db:push` to create all tables from existing Drizzle schemas
- Execute session table creation for connect-pg-simple
- Verify all tables created successfully with proper constraints

### Phase 2: Data Migration
- Operations table: Direct mapping from in-memory storage
- Staff members: Maintain relationships with operations
- Pens: Preserve all cattle tracking data
- Feeding records: Maintain chronological ordering
- All timestamps: Preserve original creation dates

### Indexes and Constraints

The existing Drizzle schema already defines:
- Primary keys on all tables using `serial("id").primaryKey()`
- Unique constraints on `operations.operator_email`
- Foreign key relationships through application logic
- Timestamps with proper defaults

Additional indexes to consider for performance:
```sql
-- Improve query performance for common lookups
CREATE INDEX IF NOT EXISTS "idx_pens_operator_email" ON "pens" ("operator_email");
CREATE INDEX IF NOT EXISTS "idx_feeding_records_pen_id" ON "feeding_records" ("pen_id");
CREATE INDEX IF NOT EXISTS "idx_feeding_records_date" ON "feeding_records" ("feeding_date");
CREATE INDEX IF NOT EXISTS "idx_treatments_pen_id" ON "treatments" ("pen_id");
CREATE INDEX IF NOT EXISTS "idx_staff_members_operation_id" ON "staff_members" ("operation_id");
```

## Data Integrity Rules

### Referential Integrity
- All pens must belong to an existing operation (via operator_email)
- All feeding records must reference an existing pen
- All treatments must reference an existing pen
- Staff members must reference an existing operation

### Business Logic Constraints
- Pen current count cannot exceed capacity
- Feeding dates must be valid timestamps
- Staff invitation tokens must be unique
- Operation emails must be unique

## Migration Rollback Strategy

In case of migration failure:
1. All migrations wrapped in transactions
2. Backup of in-memory data before migration starts
3. Ability to truncate PostgreSQL tables and retry
4. Maintain in-memory storage until migration verified
5. Log all migration steps for audit trail

## Development Seed Data Structure

Sample data hierarchy:
```
Operation: "Demo Ranch"
├── Owner: John Demo (john@demo.ranch)
├── Staff: Jane Helper (jane@demo.ranch) - Active
└── Pens:
    ├── Pen 1: "North Pasture" - 100 head capacity
    │   ├── 30 days feeding records
    │   ├── 5 treatments
    │   └── 2 death losses
    ├── Pen 2: "South Field" - 150 head capacity
    │   ├── 30 days feeding records
    │   └── 3 treatments
    └── Pen 3: "East Lot" - 75 head capacity
        ├── 30 days feeding records
        └── 4 treatments
```