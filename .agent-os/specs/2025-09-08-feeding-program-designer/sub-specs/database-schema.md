# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-09-08-feeding-program-designer/spec.md

## New Tables

### feedingIngredients
```sql
CREATE TABLE feeding_ingredients (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  protein_percentage DECIMAL(5,2), -- % protein in ingredient
  dry_matter_percentage DECIMAL(5,2), -- % dry matter in ingredient
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name)
);
```

### feedingProgramTemplates
```sql
CREATE TABLE feeding_program_templates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_tags TEXT[], -- Array of tags like ["finishing", "steers", "high-energy"]
  created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### feedingProgramPhases
```sql
CREATE TABLE feeding_program_phases (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT NOT NULL REFERENCES feeding_program_templates(id) ON DELETE CASCADE,
  phase_name VARCHAR(255) NOT NULL, -- "Receiving", "Backgrounding", "Finishing"
  phase_order INTEGER NOT NULL,
  duration_days INTEGER NOT NULL,
  target_mcal_per_ration DECIMAL(8,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### feedingProgramIngredients
```sql
CREATE TABLE feeding_program_ingredients (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id TEXT NOT NULL REFERENCES feeding_program_phases(id) ON DELETE CASCADE,
  ingredient_id TEXT NOT NULL REFERENCES feeding_ingredients(id),
  percentage_of_ration DECIMAL(5,2) NOT NULL, -- % of total ration
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### penFeedingPrograms
```sql
CREATE TABLE pen_feeding_programs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  pen_id INTEGER NOT NULL REFERENCES pens(id),
  template_id TEXT REFERENCES feeding_program_templates(id),
  program_name VARCHAR(255) NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  feeding_times TEXT[], -- Array of feeding times like ["06:00", "17:00"]
  current_phase INTEGER DEFAULT 1,
  status VARCHAR(50) DEFAULT 'active', -- active, paused, completed
  created_by_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### penFeedingProgramPhases
```sql
CREATE TABLE pen_feeding_program_phases (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  pen_program_id TEXT NOT NULL REFERENCES pen_feeding_programs(id) ON DELETE CASCADE,
  template_phase_id TEXT REFERENCES feeding_program_phases(id),
  phase_name VARCHAR(255) NOT NULL,
  phase_order INTEGER NOT NULL,
  duration_days INTEGER NOT NULL,
  target_mcal_per_ration DECIMAL(8,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### penFeedingProgramIngredients
```sql
CREATE TABLE pen_feeding_program_ingredients (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  pen_phase_id TEXT NOT NULL REFERENCES pen_feeding_program_phases(id) ON DELETE CASCADE,
  ingredient_id TEXT NOT NULL REFERENCES feeding_ingredients(id),
  percentage_of_ration DECIMAL(5,2) NOT NULL, -- % of total ration
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## New Indexes

```sql
CREATE UNIQUE INDEX feeding_ingredients_user_name_idx ON feeding_ingredients(user_id, name);
CREATE INDEX idx_feeding_ingredients_user ON feeding_ingredients(user_id);
CREATE INDEX idx_feeding_program_templates_created_by ON feeding_program_templates(created_by_user_id);
CREATE INDEX idx_feeding_program_templates_category_tags ON feeding_program_templates USING GIN(category_tags);
CREATE INDEX idx_feeding_program_phases_template ON feeding_program_phases(template_id, phase_order);
CREATE INDEX idx_feeding_program_ingredients_phase ON feeding_program_ingredients(phase_id);
CREATE INDEX idx_pen_feeding_programs_pen ON pen_feeding_programs(pen_id);
CREATE INDEX idx_pen_feeding_programs_template ON pen_feeding_programs(template_id);
CREATE INDEX idx_pen_feeding_program_phases_program ON pen_feeding_program_phases(pen_program_id, phase_order);
CREATE INDEX idx_pen_feeding_program_ingredients_phase ON pen_feeding_program_ingredients(pen_phase_id);
CREATE INDEX idx_feeding_record_variances_pen_program ON feeding_record_variances(pen_program_id, date);
CREATE UNIQUE INDEX feeding_record_variances_unique_idx ON feeding_record_variances(pen_program_id, ingredient_id, date, feeding_time);
CREATE INDEX idx_nutritionist_tasks_user ON nutritionist_tasks(user_id, status);
CREATE INDEX idx_nutritionist_tasks_pen ON nutritionist_tasks(pen_id);
CREATE UNIQUE INDEX nutritionist_tasks_pen_task_unique_idx ON nutritionist_tasks(pen_id, task_type);
CREATE UNIQUE INDEX daily_feeding_completion_unique_idx ON daily_feeding_completion_status(pen_program_id, date, feeding_time);
```

## Task Management Tables

### nutritionistTasks
```sql
CREATE TABLE nutritionist_tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id), -- Changed from nutritionist_id
  pen_id INTEGER NOT NULL REFERENCES pens(id),
  task_type VARCHAR(50) NOT NULL, -- 'create_feeding_programs'
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, dismissed
  priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  completed_by_user_id INTEGER REFERENCES users(id),
  notes TEXT,
  UNIQUE(pen_id, task_type)
);
```

## Variance Tracking Tables

### feedingRecordVariances
```sql
CREATE TABLE feeding_record_variances (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  pen_program_id TEXT NOT NULL REFERENCES pen_feeding_programs(id),
  pen_id INTEGER NOT NULL REFERENCES pens(id),
  ingredient_id TEXT NOT NULL REFERENCES feeding_ingredients(id),
  recorded_by_user_id INTEGER NOT NULL REFERENCES users(id),
  date TEXT NOT NULL,
  feeding_time VARCHAR(10), -- "06:00" or "17:00"
  planned_amount DECIMAL(8,2) NOT NULL,
  actual_amount DECIMAL(8,2) NOT NULL,
  variance_amount DECIMAL(8,2) NOT NULL, -- actual - planned
  variance_percentage DECIMAL(5,2) NOT NULL, -- (actual - planned) / planned * 100
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(pen_program_id, ingredient_id, date, feeding_time)
);
```

### dailyFeedingCompletionStatus
```sql
CREATE TABLE daily_feeding_completion_status (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  pen_program_id TEXT NOT NULL REFERENCES pen_feeding_programs(id),
  completed_by_user_id INTEGER NOT NULL REFERENCES users(id),
  date TEXT NOT NULL,
  feeding_time VARCHAR(10) NOT NULL,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(pen_program_id, date, feeding_time)
);
```

## User and Consultant Management Tables

### users
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  user_type TEXT CHECK (user_type IN ('consultant', 'producer', 'staff')) NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

### consultantProfiles
```sql
CREATE TABLE consultant_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  specialization TEXT CHECK (specialization IN ('nutritionist', 'veterinarian')) NOT NULL,
  credentials TEXT,
  bio TEXT,
  profile_photo TEXT,
  profile_complete_percentage INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

### consultantProducerRelationships
```sql
CREATE TABLE consultant_producer_relationships (
  id SERIAL PRIMARY KEY,
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  producer_id INTEGER NOT NULL REFERENCES users(id),
  permissions JSONB DEFAULT '{"view": true, "edit": false, "admin": false}' NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE(consultant_id, producer_id)
);
```

### consultantProducerInvitations
```sql
CREATE TABLE consultant_producer_invitations (
  id SERIAL PRIMARY KEY,
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  producer_email VARCHAR(255) NOT NULL,
  producer_name VARCHAR(255) NOT NULL,
  message TEXT DEFAULT '',
  token VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  declined_at TIMESTAMP
);
```

## Deprecated Tables

### nutritionists (DEPRECATED)
- Use `users` table with `user_type='consultant'` and `consultantProfiles` table instead
- Kept for backward compatibility during migration

### feedingPlans (DEPRECATED)
- Use `penFeedingPrograms` and related tables instead

## Key Changes from Original Design

1. **User ID Types**: Using INTEGER for user references (matching PostgreSQL SERIAL type) instead of UUID
2. **Pen ID Types**: Using INTEGER for pen references (matching existing schema)
3. **Primary Keys**: Using TEXT with UUID generation for new tables, maintaining INTEGER SERIAL for existing tables
4. **Date Storage**: Using TEXT for date fields (matching existing pattern in the codebase)
5. **Nutritionist References**: Changed from `nutritionist_id` to `user_id` in tables, referencing the unified users table
6. **Consultant System**: Replaced separate nutritionists table with users + consultantProfiles pattern

## Rationale

- **Ingredient Management**: Centralized feeding_ingredients table allows consultants to maintain a reusable library of ingredients with consistent nutritional data
- **Template System**: Separates reusable templates from pen-specific implementations allowing consultants to create standardized programs
- **Pen-Specific Customization**: pen_feeding_program_phases and pen_feeding_program_ingredients allow full customization per pen while maintaining template reference
- **Multiple Daily Feedings**: feeding_times array supports operations that feed multiple times per day (morning and evening feedings)
- **Multiple Programs per Pen**: Supports sequential feeding programs (starter, grower, finisher) for the lifetime of a pen
- **Task-Driven Workflow**: nutritionist_tasks table creates automatic tasks when new pens are created, ensuring consultants are prompted to create feeding programs
- **Unified User System**: Using a single users table with user_type discrimination and separate profile tables for role-specific data
- **Consultant-Producer Relationships**: Explicit relationship management with permissions and invitation system
- **Efficient Variance Tracking**: Only stores records when actual feeding differs from planned, reducing storage needs while maintaining audit trail
- **Completion Tracking**: daily_feeding_completion_status ensures we know when feedings were completed even when no variances occurred
- **Phase-Based Design**: Supports multi-phase feeding programs with distinct nutritional requirements per phase
- **Consultant Multi-tenancy**: Templates and ingredients are user-scoped enabling consultant-specific libraries
- **Category Tags**: PostgreSQL array field enables flexible template categorization and filtering
- **Foreign Key Constraints**: Ensures data integrity with cascade deletes for template and program hierarchies