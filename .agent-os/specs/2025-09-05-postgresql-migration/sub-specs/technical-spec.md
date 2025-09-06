# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-05-postgresql-migration/spec.md

## Technical Requirements

### Docker Configuration
- Create `docker-compose.yml` with PostgreSQL 16 service
- Configure persistent volume for database data at `./postgres-data`
- Set up health checks for database readiness
- Use environment variables for database credentials
- Expose PostgreSQL on port 5432 for local development

### Database Connection Implementation
- Utilize existing Drizzle ORM configuration in `drizzle.config.ts`
- Implement connection pooling with appropriate limits (max 10 connections for development)
- Add connection retry logic with exponential backoff
- Create database connection singleton to prevent connection leaks
- Support both `DATABASE_URL` environment variable and individual connection parameters

### Storage Abstraction Layer
- Create `IStorageProvider` interface with all current storage methods
- Implement `PostgreSQLStorageProvider` using Drizzle ORM and existing schemas
- Maintain `InMemoryStorageProvider` for backward compatibility
- Add `StorageFactory` to select provider based on `STORAGE_TYPE` environment variable
- Ensure all storage methods return consistent data formats

### Environment Configuration
- Add `STORAGE_TYPE` variable (`memory` | `postgresql`) with default to `memory`
- Update `.env.example` with PostgreSQL connection variables
- Create `.env.development` with Docker PostgreSQL defaults
- Implement configuration validation on startup
- Add clear error messages for missing configuration

### Session Management
- Migrate from in-memory sessions to PostgreSQL using connect-pg-simple
- Create session table in PostgreSQL for persistent sessions
- Configure session expiration and cleanup policies
- Maintain session compatibility during gradual migration
- Implement session migration utility for existing sessions

### Data Migration Utilities
- Create migration service to transfer in-memory data to PostgreSQL
- Implement transaction-based migration for data integrity
- Add progress logging for migration monitoring
- Create rollback capability for failed migrations
- Build verification queries to ensure data consistency

### Development Seed Data
- Create seed script in TypeScript using Drizzle ORM
- Include one sample operation: "Demo Ranch" with owner details
- Add three pens with different cattle types and feeding programs
- Generate 30 days of historical feeding records
- Include sample treatments and health records
- Add one staff member with active status
- Ensure idempotent seeding (can run multiple times safely)

### Error Handling and Logging
- Implement comprehensive error handling for database operations
- Add structured logging for database queries in development
- Create fallback mechanism to in-memory if PostgreSQL fails
- Log migration progress and any data inconsistencies
- Include performance metrics for database operations

### Testing Considerations
- Maintain existing test suite compatibility
- Add integration tests for PostgreSQL storage provider
- Create test utilities for database setup and teardown
- Implement test data factories using seed data patterns
- Ensure tests can run with both storage providers