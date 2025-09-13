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

- [x] 2. API Layer Development
  - [x] 2.1 Write tests for ingredient management endpoints
  - [x] 2.2 Implement FeedingIngredientController with CRUD operations
  - [x] 2.3 Implement FeedingProgramTemplateController for template management
  - [x] 2.4 Implement PenFeedingProgramController with customization support
  - [x] 2.5 Implement NutritionistTaskController with auto-task creation
  - [x] 2.6 Implement variance recording and completion tracking endpoints
  - [x] 2.7 Add WebSocket support for real-time updates
  - [x] 2.8 Verify all API endpoints work correctly and tests pass

- [x] 3. Consultant UI Implementation
  - [x] 3.1 Write tests for consultant UI components
  - [x] 3.2 Build ingredient library management interface
  - [x] 3.3 Create template designer with drag-and-drop phase management
  - [x] 3.4 Implement program assignment UI with pen customization
  - [x] 3.5 Build nutritionist task dashboard with notifications
  - [x] 3.6 Create variance analysis and reporting interface
  - [x] 3.7 Implement multi-client dashboard integration
  - [x] 3.8 Verify all consultant features work and tests pass

- [x] 4. Producer App Migration
  - [x] 4.1 Write tests for migrated producer features
  - [x] 4.2 Update type definitions (remove old, add new types)
  - [x] 4.3 Refactor API hooks to use new endpoints
  - [x] 4.4 Update feeding page to use pen feeding programs
  - [x] 4.5 Implement variance-only recording in feeding form
  - [x] 4.6 Add feeding completion tracking UI
  - [x] 4.7 Update schedule display for multiple daily feeding times
  - [x] 4.8 Remove deprecated components and clean up code
  - [x] 4.9 Verify producer app works with new system and tests pass
  - [x] 4.10 Create consultant invitation verification page with onboarding flow

- [x] 5. Cleanup and Deployment
  - [x] 5.1 Write tests to verify old schema removal
  - [x] 5.2 Drop deprecated tables (feedingPlans, feedingSchedules, old ingredients)
  - [x] 5.3 Remove old type definitions from shared/schema.ts
  - [x] 5.4 Remove deprecated API endpoints and controllers
  - [x] 5.5 Clean up unused imports and dead code
  - [x] 5.6 Perform end-to-end testing with new schema
  - [x] 5.7 Deploy changes to development environment
  - [x] 5.8 Verify all features work with clean schema