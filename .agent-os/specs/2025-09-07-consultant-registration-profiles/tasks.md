# Spec Tasks

## Tasks

- [x] 1. Set up unified authentication infrastructure
  - [x] 1.1 Write tests for JWT authentication and user type management
  - [x] 1.2 Install and configure new dependencies (jsonwebtoken, bcryptjs, express-rate-limit)
  - [x] 1.3 Create unified users table and consultant_profiles table with migration scripts
  - [x] 1.4 Implement JWT token generation, validation, and refresh token mechanisms
  - [x] 1.5 Create authentication middleware for user type verification
  - [x] 1.6 Verify all authentication tests pass

- [x] 2. Build consultant registration and profile system
  - [x] 2.1 Write tests for consultant registration flow and profile management
  - [x] 2.2 Create consultant registration API endpoints with validation
  - [x] 2.3 Implement email verification system with SendGrid integration
  - [x] 2.4 Build consultant registration UI components with specialization selection
  - [x] 2.5 Create consultant profile management dashboard and forms
  - [x] 2.6 Add profile completeness indicator and photo upload functionality
  - [x] 2.7 Verify all registration and profile tests pass

- [x] 3. Implement producer invitation system
  - [x] 3.1 Write tests for invitation creation, sending, and acceptance flows
  - [x] 3.2 Create invitation database tables and management APIs
  - [x] 3.3 Build email invitation templates and SendGrid integration
  - [x] 3.4 Implement invitation acceptance flow with user migration
  - [x] 3.5 Create consultant dashboard invitation management interface
  - [x] 3.6 Add invitation status tracking and resend/cancel functionality
  - [x] 3.7 Verify all invitation system tests pass

- [ ] 4. Create consultant-producer relationship management
  - [ ] 4.1 Write tests for relationship establishment and permissions
  - [ ] 4.2 Implement consultant-producer relationship database schema
  - [ ] 4.3 Create permission-based access control system
  - [ ] 4.4 Build relationship management APIs and middleware
  - [ ] 4.5 Add relationship status indicators to consultant dashboard
  - [ ] 4.6 Verify all relationship management tests pass

- [ ] 5. Integrate security and performance optimizations
  - [ ] 5.1 Write tests for rate limiting and security measures
  - [ ] 5.2 Implement rate limiting on all authentication and registration endpoints
  - [ ] 5.3 Add input sanitization and XSS protection
  - [ ] 5.4 Configure CORS and CSRF protection for consultant endpoints
  - [ ] 5.5 Add comprehensive logging for authentication and invitation activities
  - [ ] 5.6 Performance testing for JWT operations and profile loading
  - [ ] 5.7 Verify all security and performance tests pass