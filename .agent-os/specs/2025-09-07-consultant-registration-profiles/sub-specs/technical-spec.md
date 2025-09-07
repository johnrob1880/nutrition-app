# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-07-consultant-registration-profiles/spec.md

## Technical Requirements

### Authentication System
- Implement JWT-based authentication using jsonwebtoken library
- Create unified login endpoint supporting username/password
- Implement refresh token mechanism with secure httpOnly cookies
- Add user type field (enum: 'consultant', 'producer', 'staff') to authentication
- Maintain backward compatibility with existing email-based producer sessions during migration period

### User Registration Flow
- Multi-step registration form with client-side validation using React Hook Form + Zod
- Consultant specialization selection: radio buttons for "Nutritionist" or "Veterinarian"
- Email verification using SendGrid with time-limited tokens (24-hour expiry)
- Password requirements: minimum 8 characters, at least one uppercase, one lowercase, one number
- Username requirements: 3-20 characters, alphanumeric with underscores, unique constraint
- Implement rate limiting on registration endpoint (max 5 attempts per IP per hour)

### Consultant Profile Management
- Profile fields: username, email, full name, phone (optional), specialization (nutritionist/veterinarian), credentials (text, max 1000 chars)
- Profile visibility: private by default, only visible to connected producers
- Implement profile completeness indicator (percentage based on filled fields)
- Add profile photo upload capability using base64 encoding (max 2MB, JPEG/PNG only)
- Specialization-based UI elements: show different icons/badges for nutritionists vs veterinarians

### Producer Invitation System
- Generate unique invitation tokens with 7-day expiry
- Store invitation status: pending, accepted, declined, expired
- Email notifications via SendGrid for invitation sent, accepted, declined
- Implement invitation management dashboard for consultants showing all invitations and statuses
- Add ability to resend or cancel pending invitations

### UI/UX Specifications
- Create dedicated consultant registration page at /consultant/register
- Implement consultant dashboard at /consultant/dashboard with sidebar navigation
- Use existing shadcn/ui components for consistency (Button, Card, Form, Input, Label)
- Add loading states and error handling with toast notifications
- Implement responsive design for mobile/tablet viewing
- Create invitation modal with email input and custom message field

### Security Considerations
- Implement CORS protection for consultant-specific endpoints
- Add rate limiting to prevent brute force attacks on login
- Sanitize all user inputs to prevent XSS attacks
- Implement CSRF protection for state-changing operations
- Log all authentication attempts and invitation activities

### Performance Criteria
- JWT token generation: < 100ms
- Profile load time: < 500ms
- Invitation email send: < 2 seconds
- Dashboard initial load: < 1 second
- Support minimum 100 concurrent consultant sessions

## External Dependencies

**jsonwebtoken** - JWT token generation and verification
**Justification:** Industry standard for JWT implementation in Node.js, required for stateless authentication

**bcryptjs** - Password hashing and verification  
**Justification:** More portable than bcrypt, no native dependencies, essential for secure password storage

**express-rate-limit** - Rate limiting middleware
**Justification:** Prevents brute force attacks and registration spam, essential security feature