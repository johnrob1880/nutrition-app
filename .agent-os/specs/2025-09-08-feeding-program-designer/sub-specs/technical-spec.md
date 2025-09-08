# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-08-feeding-program-designer/spec.md

## Technical Requirements

- **Ingredient Library Management**: React components for managing centralized feeding ingredients with nutritional data (protein %, dry matter %)
- **Template Management UI**: React components using shadcn/ui for creating, editing, and organizing feeding program templates with drag-and-drop ration phase management
- **Program Designer Interface**: Visual timeline editor built with React and Recharts for designing multi-phase feeding schedules with nutritional specifications per phase
- **Template Categorization**: Tag-based filtering system using React Hook Form and Zod validation for template organization by cattle category and operation type
- **Pen Program Assignment**: Integration with existing pen management to apply and customize templates for specific pens with multiple daily feeding times
- **Pen-Specific Customization**: UI for adjusting phases and ingredient ratios from template defaults for individual pen requirements
- **Nutritional Data Entry**: Form components for mcal per total ration with ingredient selection from centralized library
- **Variance Recording System**: Interface for recording only feeding variances when actual amounts differ from planned
- **Feeding Completion Tracking**: UI components for marking daily feedings as complete with user attribution
- **Report Generation**: React-based reporting interface using Recharts for variance visualization and completion status tracking
- **Database Integration**: Extend existing Drizzle ORM schema to support:
  - Centralized ingredient management (feeding_ingredients)
  - Feeding program templates with phases
  - Pen-specific program customization (pen_feeding_program_phases, pen_feeding_program_ingredients)
  - Variance-only tracking (feeding_record_variances)
  - Completion status tracking (daily_feeding_completion_status)
- **Real-time Updates**: WebSocket integration for live variance and completion status updates
- **Consultant Multi-client Access**: Template sharing and assignment across consultant's client operations through existing multi-tenant architecture

## Migration from Existing System

### Tables to Deprecate
The following existing tables will be replaced by the new schema:
- `feedingPlans` → Replaced by `pen_feeding_programs` and `pen_feeding_program_phases`
- `feedingSchedules` → Replaced by `pen_feeding_programs` with feeding_times array
- `ingredients` (if exists) → Replaced by centralized `feeding_ingredients`
- String-based `nutritionistId` → Migrated to UUID foreign key
- String-based `operatorEmail` → Migrated to `operation_id` foreign key

### Client App Migration Steps

1. **Update Type Definitions**:
   - Remove old types: `FeedingPlan`, `FeedingSchedule`, `Ingredient`
   - Add new types: `PenFeedingProgram`, `PenFeedingProgramPhase`, `FeedingIngredient`
   - Update `Pen` type to use `operationId` instead of `operatorEmail`
   - Update `Pen` type to use `nutritionistId` as UUID instead of string

2. **Update API Hooks**:
   - Replace feeding plan queries with pen feeding program queries
   - Update feeding schedule hooks to use new program-based endpoints
   - Add new hooks for variance recording and completion tracking
   - Add hooks for ingredient library management

3. **Update Components**:
   - **Feeding Page**: Refactor to use pen feeding programs instead of feeding plans
   - **Schedule Display**: Update to show multiple daily feeding times
   - **Feeding Form**: Modify to record only variances, not all feeding records
   - **Completion UI**: Add interface for marking feedings as complete
   - Remove components that relied on deprecated tables

4. **Data Migration**:
   - Migrate existing feeding plans to pen feeding programs
   - Convert feeding schedules to program phases
   - Import existing ingredients into centralized library
   - Update all operatorEmail references to operation_id
   - Convert nutritionistId strings to UUID references

5. **Testing Requirements**:
   - Verify all feeding workflows function with new schema
   - Test variance recording and completion tracking
   - Ensure backward compatibility during migration period
   - Validate that no data is lost during migration