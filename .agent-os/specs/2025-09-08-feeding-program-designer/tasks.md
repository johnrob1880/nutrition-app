# Spec Tasks

## Tasks

- [x] 1. Database Schema Implementation
  - [x] 1.1 Write tests for database schema migrations
  - [x] 1.2 Create feeding_ingredients table with user-scoped nutritional data
  - [x] 1.3 Create feeding program template tables (templates, phases, ingredients)
  - [x] 1.4 Create pen-specific program tables (programs, phases, ingredients)
  - [x] 1.5 Create variance and completion tracking tables
  - [x] 1.6 Create nutritionist_tasks table for task management
  - [x] 1.7 Migrate pens table (nutritionist_id to UUID, operator_email to operation_id)
  - [x] 1.8 Create all required indexes for performance
  - [x] 1.9 Verify all database migrations succeed and tests pass

- [ ] 2. API Layer Development
  - [ ] 2.1 Write tests for ingredient management endpoints
  - [ ] 2.2 Implement FeedingIngredientController with CRUD operations
  - [ ] 2.3 Implement FeedingProgramTemplateController for template management
  - [ ] 2.4 Implement PenFeedingProgramController with customization support
  - [ ] 2.5 Implement NutritionistTaskController with auto-task creation
  - [ ] 2.6 Implement variance recording and completion tracking endpoints
  - [ ] 2.7 Add WebSocket support for real-time updates
  - [ ] 2.8 Verify all API endpoints work correctly and tests pass

- [ ] 3. Consultant UI Implementation
  - [ ] 3.1 Write tests for consultant UI components
  - [ ] 3.2 Build ingredient library management interface
  - [ ] 3.3 Create template designer with drag-and-drop phase management
  - [ ] 3.4 Implement program assignment UI with pen customization
  - [ ] 3.5 Build nutritionist task dashboard with notifications
  - [ ] 3.6 Create variance analysis and reporting interface
  - [ ] 3.7 Implement multi-client dashboard integration
  - [ ] 3.8 Verify all consultant features work and tests pass

- [ ] 4. Producer App Migration
  - [ ] 4.1 Write tests for migrated producer features
  - [ ] 4.2 Update type definitions (remove old, add new types)
  - [ ] 4.3 Refactor API hooks to use new endpoints
  - [ ] 4.4 Update feeding page to use pen feeding programs
  - [ ] 4.5 Implement variance-only recording in feeding form
  - [ ] 4.6 Add feeding completion tracking UI
  - [ ] 4.7 Update schedule display for multiple daily feeding times
  - [ ] 4.8 Remove deprecated components and clean up code
  - [ ] 4.9 Verify producer app works with new system and tests pass

- [ ] 5. Cleanup and Deployment
  - [ ] 5.1 Write tests to verify old schema removal
  - [ ] 5.2 Drop deprecated tables (feedingPlans, feedingSchedules, old ingredients)
  - [ ] 5.3 Remove old type definitions from shared/schema.ts
  - [ ] 5.4 Remove deprecated API endpoints and controllers
  - [ ] 5.5 Clean up unused imports and dead code
  - [ ] 5.6 Perform end-to-end testing with new schema
  - [ ] 5.7 Deploy changes to development environment
  - [ ] 5.8 Verify all features work with clean schema