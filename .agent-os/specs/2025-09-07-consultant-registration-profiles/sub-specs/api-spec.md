# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-09-07-consultant-registration-profiles/spec.md

## Authentication Endpoints

### POST /api/auth/register/consultant
**Purpose:** Register a new consultant account
**Parameters:** 
- Body: `{username: string, email: string, password: string, fullName: string, specialization: 'nutritionist' | 'veterinarian'}`
**Response:** `{success: boolean, message: string, userId?: number}`
**Errors:** 400 (validation), 409 (username/email exists), 429 (rate limited), 500 (server error)

### POST /api/auth/login
**Purpose:** Authenticate user (consultant, producer, or staff)
**Parameters:** 
- Body: `{username: string, password: string}` OR `{email: string, password: string}`
**Response:** `{success: boolean, user: {id, username, email, userType}, accessToken: string}`
**Errors:** 401 (invalid credentials), 403 (email not verified), 429 (rate limited), 500 (server error)

### POST /api/auth/refresh
**Purpose:** Refresh JWT access token using refresh token
**Parameters:** 
- Cookie: `refreshToken` (httpOnly)
**Response:** `{success: boolean, accessToken: string}`
**Errors:** 401 (invalid/expired token), 500 (server error)

### POST /api/auth/logout
**Purpose:** Invalidate refresh token and logout user
**Parameters:** 
- Cookie: `refreshToken` (httpOnly)
**Response:** `{success: boolean, message: string}`
**Errors:** 500 (server error)

### POST /api/auth/verify-email
**Purpose:** Verify user email with verification token
**Parameters:** 
- Body: `{token: string}`
**Response:** `{success: boolean, message: string}`
**Errors:** 400 (invalid token), 410 (expired token), 500 (server error)

### POST /api/auth/resend-verification
**Purpose:** Resend email verification
**Parameters:** 
- Body: `{email: string}`
**Response:** `{success: boolean, message: string}`
**Errors:** 404 (user not found), 429 (rate limited), 500 (server error)

## Consultant Profile Endpoints

### GET /api/consultant/profile
**Purpose:** Get authenticated consultant's profile
**Parameters:** 
- Headers: `Authorization: Bearer <jwt_token>`
**Response:** `{success: boolean, profile: ConsultantProfile}`
**Errors:** 401 (unauthorized), 403 (not consultant), 404 (profile not found), 500 (server error)

### PUT /api/consultant/profile
**Purpose:** Update consultant profile information
**Parameters:** 
- Headers: `Authorization: Bearer <jwt_token>`
- Body: `{fullName?: string, phone?: string, specialization?: 'nutritionist' | 'veterinarian', credentials?: string, profilePhoto?: string}`
**Response:** `{success: boolean, profile: ConsultantProfile, completeness: number}`
**Errors:** 401 (unauthorized), 403 (not consultant), 400 (validation), 500 (server error)

### GET /api/consultant/dashboard
**Purpose:** Get consultant dashboard data (profile, invitations, relationships)
**Parameters:** 
- Headers: `Authorization: Bearer <jwt_token>`
**Response:** `{success: boolean, data: {profile: ConsultantProfile, invitations: Invitation[], relationships: Relationship[]}}`
**Errors:** 401 (unauthorized), 403 (not consultant), 500 (server error)

## Producer Invitation Endpoints

### POST /api/consultant/invitations
**Purpose:** Send invitation to producer
**Parameters:** 
- Headers: `Authorization: Bearer <jwt_token>`
- Body: `{producerEmail: string, customMessage?: string}`
**Response:** `{success: boolean, invitation: Invitation}`
**Errors:** 401 (unauthorized), 403 (not consultant), 400 (validation), 409 (duplicate invitation), 500 (server error)

### GET /api/consultant/invitations
**Purpose:** Get all invitations sent by consultant
**Parameters:** 
- Headers: `Authorization: Bearer <jwt_token>`
- Query: `?status=pending|accepted|declined&page=1&limit=10`
**Response:** `{success: boolean, invitations: Invitation[], total: number, page: number}`
**Errors:** 401 (unauthorized), 403 (not consultant), 500 (server error)

### PUT /api/consultant/invitations/:id/resend
**Purpose:** Resend pending invitation
**Parameters:** 
- Headers: `Authorization: Bearer <jwt_token>`
- Params: `id` (invitation ID)
**Response:** `{success: boolean, message: string}`
**Errors:** 401 (unauthorized), 403 (not consultant), 404 (not found), 400 (not pending), 500 (server error)

### DELETE /api/consultant/invitations/:id
**Purpose:** Cancel pending invitation
**Parameters:** 
- Headers: `Authorization: Bearer <jwt_token>`
- Params: `id` (invitation ID)
**Response:** `{success: boolean, message: string}`
**Errors:** 401 (unauthorized), 403 (not consultant), 404 (not found), 400 (not pending), 500 (server error)

## Producer Acceptance Endpoints

### GET /api/invitations/:token
**Purpose:** Get invitation details for acceptance page
**Parameters:** 
- Params: `token` (invitation token)
**Response:** `{success: boolean, invitation: {consultantName: string, customMessage?: string, expiresAt: string}}`
**Errors:** 404 (not found), 410 (expired), 500 (server error)

### POST /api/invitations/:token/accept
**Purpose:** Accept consultant invitation (creates producer account if needed)
**Parameters:** 
- Params: `token` (invitation token)
- Body: `{username?: string, password?: string, fullName?: string}` (required if new user)
**Response:** `{success: boolean, user: User, accessToken: string, isNewUser: boolean}`
**Errors:** 400 (validation), 404 (not found), 410 (expired), 409 (username exists), 500 (server error)

### POST /api/invitations/:token/decline
**Purpose:** Decline consultant invitation
**Parameters:** 
- Params: `token` (invitation token)
- Body: `{reason?: string}` (optional decline reason)
**Response:** `{success: boolean, message: string}`
**Errors:** 404 (not found), 410 (expired), 500 (server error)

## Type Definitions

```typescript
interface User {
  id: number;
  username: string;
  email: string;
  userType: 'consultant' | 'producer' | 'staff';
  emailVerified: boolean;
  createdAt: string;
}

interface ConsultantProfile {
  id: number;
  userId: number;
  fullName: string;
  phone?: string;
  specialization: 'nutritionist' | 'veterinarian';
  credentials?: string;
  profilePhoto?: string;
  profileCompletePercentage: number;
  createdAt: string;
  updatedAt: string;
}

interface Invitation {
  id: number;
  consultantId: number;
  producerEmail: string;
  producerId?: number;
  customMessage?: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expiresAt: string;
  createdAt: string;
}

interface Relationship {
  id: number;
  consultantId: number;
  producerId: number;
  operationId?: number;
  permissions: {
    view: boolean;
    edit: boolean;
    admin: boolean;
  };
  establishedAt: string;
}
```

## Error Response Format

All error responses follow this format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {} // Optional additional error details
  }
}
```

## Rate Limiting

- Registration: 5 requests per IP per hour
- Login: 10 requests per IP per 15 minutes  
- Email verification/resend: 3 requests per email per hour
- Invitation sending: 20 requests per consultant per day
- All other authenticated endpoints: 1000 requests per user per hour