# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-09-08-feeding-program-designer/spec.md

## New Tables

### feedingIngredients
```sql
CREATE TABLE feeding_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_tags TEXT[], -- Array of tags like ["finishing", "steers", "high-energy"]
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  is_shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### feedingProgramPhases
```sql
CREATE TABLE feeding_program_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES feeding_program_templates(id) ON DELETE CASCADE,
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES feeding_program_phases(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES feeding_ingredients(id),
  percentage_of_ration DECIMAL(5,2) NOT NULL, -- % of total ration
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### penFeedingPrograms
```sql
CREATE TABLE pen_feeding_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pen_id UUID NOT NULL REFERENCES pens(id),
  template_id UUID REFERENCES feeding_program_templates(id),
  program_name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  feeding_times TEXT[], -- Array of feeding times like ["06:00", "17:00"]
  current_phase INTEGER DEFAULT 1,
  status VARCHAR(50) DEFAULT 'active', -- active, paused, completed
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### penFeedingProgramPhases
```sql
CREATE TABLE pen_feeding_program_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pen_program_id UUID NOT NULL REFERENCES pen_feeding_programs(id) ON DELETE CASCADE,
  template_phase_id UUID REFERENCES feeding_program_phases(id),
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pen_phase_id UUID NOT NULL REFERENCES pen_feeding_program_phases(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES feeding_ingredients(id),
  percentage_of_ration DECIMAL(5,2) NOT NULL, -- % of total ration
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## New Indexes

```sql
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
CREATE INDEX idx_nutritionist_tasks_nutritionist ON nutritionist_tasks(nutritionist_id, status);
CREATE INDEX idx_nutritionist_tasks_pen ON nutritionist_tasks(pen_id);
```

## Task Management Tables

### nutritionistTasks
```sql
CREATE TABLE nutritionist_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nutritionist_id UUID NOT NULL REFERENCES users(id),
  pen_id UUID NOT NULL REFERENCES pens(id),
  task_type VARCHAR(50) NOT NULL, -- 'create_feeding_programs'
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, dismissed
  priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  completed_by_user_id UUID REFERENCES users(id),
  notes TEXT,
  UNIQUE(pen_id, task_type)
);
```

## Schema Modifications

### Update pens table
```sql
-- Change nutritionistId from string to UUID reference
ALTER TABLE pens 
ALTER COLUMN nutritionist_id TYPE UUID USING nutritionist_id::uuid,
ADD CONSTRAINT fk_pens_nutritionist FOREIGN KEY (nutritionist_id) REFERENCES users(id);

-- Change operatorEmail to operation_id reference
ALTER TABLE pens
DROP COLUMN operator_email,
ADD COLUMN operation_id UUID NOT NULL REFERENCES operations(id);

-- Add index for operation lookup
CREATE INDEX idx_pens_operation ON pens(operation_id);
```

### Update all tables using operatorEmail
```sql
-- Apply same pattern to any other tables that currently use operatorEmail
-- Replace string operatorEmail with operation_id UUID foreign key
-- This ensures proper relational integrity across the system
-- Examples: feeding_records, treatment_records, or any other operation-linked tables
```

## Variance Tracking Tables

### feedingRecordVariances
```sql
CREATE TABLE feeding_record_variances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pen_program_id UUID NOT NULL REFERENCES pen_feeding_programs(id),
  pen_id UUID NOT NULL REFERENCES pens(id),
  ingredient_id UUID NOT NULL REFERENCES feeding_ingredients(id),
  recorded_by_user_id UUID NOT NULL REFERENCES users(id), -- User who performed the feeding
  date DATE NOT NULL,
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pen_program_id UUID NOT NULL REFERENCES pen_feeding_programs(id),
  completed_by_user_id UUID NOT NULL REFERENCES users(id), -- User who completed the feeding
  date DATE NOT NULL,
  feeding_time VARCHAR(10) NOT NULL,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(pen_program_id, date, feeding_time)
);
```

## Rationale

- **Ingredient Management**: Centralized feeding_ingredients table allows nutritionists to maintain a reusable library of ingredients with consistent nutritional data
- **Template System**: Separates reusable templates from pen-specific implementations allowing consultants to create standardized programs
- **Pen-Specific Customization**: pen_feeding_program_phases and pen_feeding_program_ingredients allow full customization per pen while maintaining template reference
- **Multiple Daily Feedings**: feeding_times array supports operations that feed multiple times per day (morning and evening feedings)
- **Multiple Programs per Pen**: Supports sequential feeding programs (starter, grower, finisher) for the lifetime of a pen
- **Task-Driven Workflow**: nutritionist_tasks table creates automatic tasks when new pens are created, ensuring nutritionists are prompted to create feeding programs
- **Proper Foreign Key Relations**: Replace all operatorEmail string fields with operation_id UUID foreign keys for data integrity
- **Nutritionist Relationship**: Updated pens table to properly reference nutritionist as UUID foreign key to users table instead of string
- **Operation Relationship**: Updated all tables to use operation_id foreign key instead of operatorEmail string
- **Efficient Variance Tracking**: Only stores records when actual feeding differs from planned, reducing storage needs while maintaining audit trail
- **Completion Tracking**: daily_feeding_completion_status ensures we know when feedings were completed even when no variances occurred
- **Phase-Based Design**: Supports multi-phase feeding programs with distinct nutritional requirements per phase
- **Consultant Multi-tenancy**: Templates and ingredients are user-scoped enabling consultant-specific libraries
- **Category Tags**: PostgreSQL array field enables flexible template categorization and filtering
- **Foreign Key Constraints**: Ensures data integrity with cascade deletes for template and program hierarchies