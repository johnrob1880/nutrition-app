# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-09-08-feeding-program-designer/spec.md

## Endpoints

### Ingredient Management

### GET /api/feeding-ingredients

**Purpose:** Retrieve feeding ingredients library for the authenticated user
**Parameters:** None
**Response:** Array of ingredient objects with nutritional data
**Errors:** 401 Unauthorized, 500 Internal Server Error

### POST /api/feeding-ingredients

**Purpose:** Create a new feeding ingredient
**Parameters:** 
- Body: `{ name, proteinPercentage, dryMatterPercentage }`
**Response:** Created ingredient object with generated ID
**Errors:** 400 Bad Request, 401 Unauthorized, 409 Conflict (duplicate name), 500 Internal Server Error

### PUT /api/feeding-ingredients/:ingredientId

**Purpose:** Update an existing feeding ingredient
**Parameters:** 
- `ingredientId`: UUID of ingredient to update
- Body: Updated ingredient data
**Response:** Updated ingredient object
**Errors:** 400 Bad Request, 401 Unauthorized, 404 Not Found, 500 Internal Server Error

### DELETE /api/feeding-ingredients/:ingredientId

**Purpose:** Delete a feeding ingredient
**Parameters:** 
- `ingredientId`: UUID of ingredient to delete
**Response:** Success confirmation
**Errors:** 401 Unauthorized, 404 Not Found, 409 Conflict (in use), 500 Internal Server Error

### Template Management

### GET /api/feeding-program-templates

**Purpose:** Retrieve feeding program templates for the authenticated consultant
**Parameters:** 
- `categoryTags` (optional): Filter by category tags
- `shared` (optional): Include shared templates from other consultants
**Response:** Array of template objects with phases and ingredients
**Errors:** 401 Unauthorized, 500 Internal Server Error

### POST /api/feeding-program-templates

**Purpose:** Create a new feeding program template
**Parameters:** 
- Body: `{ name, description, categoryTags, phases: [{ phaseName, phaseOrder, durationDays, targetMcalPerRation, ingredients: [{ ingredientId, percentageOfRation }] }] }`
**Response:** Created template object with generated ID
**Errors:** 400 Bad Request, 401 Unauthorized, 500 Internal Server Error

### PUT /api/feeding-program-templates/:templateId

**Purpose:** Update an existing feeding program template
**Parameters:** 
- `templateId`: UUID of template to update
- Body: Updated template data
**Response:** Updated template object
**Errors:** 400 Bad Request, 401 Unauthorized, 404 Not Found, 500 Internal Server Error

### DELETE /api/feeding-program-templates/:templateId

**Purpose:** Delete a feeding program template
**Parameters:** 
- `templateId`: UUID of template to delete
**Response:** Success confirmation
**Errors:** 401 Unauthorized, 404 Not Found, 500 Internal Server Error

### GET /api/pens/:penId/feeding-programs

**Purpose:** Retrieve feeding programs assigned to a specific pen
**Parameters:** 
- `penId`: UUID of the pen
- `status` (optional): Filter by program status (active, paused, completed)
**Response:** Array of pen feeding program objects
**Errors:** 401 Unauthorized, 404 Not Found, 500 Internal Server Error

### POST /api/pens/:penId/feeding-programs

**Purpose:** Assign and customize a feeding program template to a pen
**Parameters:** 
- `penId`: UUID of the pen
- Body: `{ templateId, programName, startDate, endDate, feedingTimes: ["06:00", "17:00"], phases: [{ templatePhaseId, phaseName, phaseOrder, durationDays, targetMcalPerRation, ingredients: [{ ingredientId, percentageOfRation }] }] }`
**Response:** Created pen feeding program object with customized phases
**Errors:** 400 Bad Request, 401 Unauthorized, 404 Not Found, 500 Internal Server Error

### PUT /api/pen-feeding-programs/:programId

**Purpose:** Update pen feeding program (phase transitions, status changes)
**Parameters:** 
- `programId`: UUID of pen feeding program
- Body: Updated program data
**Response:** Updated pen feeding program object
**Errors:** 400 Bad Request, 401 Unauthorized, 404 Not Found, 500 Internal Server Error

### GET /api/pen-feeding-programs/:programId/variances

**Purpose:** Retrieve recorded variances for a pen feeding program
**Parameters:** 
- `programId`: UUID of pen feeding program
- `dateRange` (optional): Filter variance data by date range
**Response:** Array of variance records with user tracking
**Errors:** 401 Unauthorized, 404 Not Found, 500 Internal Server Error

### POST /api/pen-feeding-programs/:programId/variances

**Purpose:** Record feeding variances for ingredients that differ from plan
**Parameters:** 
- `programId`: UUID of pen feeding program
- Body: `{ date, feedingTime, variances: [{ ingredientId, plannedAmount, actualAmount }] }`
**Response:** Created variance records
**Errors:** 400 Bad Request, 401 Unauthorized, 404 Not Found, 500 Internal Server Error

### Task Management

### GET /api/nutritionist-tasks

**Purpose:** Retrieve pending and in-progress tasks for the authenticated nutritionist
**Parameters:** 
- `status` (optional): Filter by task status (pending, in_progress, completed, dismissed)
- `priority` (optional): Filter by priority (low, normal, high, urgent)
**Response:** Array of task objects with pen details
**Errors:** 401 Unauthorized, 500 Internal Server Error

### PUT /api/nutritionist-tasks/:taskId

**Purpose:** Update task status (mark as in_progress, completed, or dismissed)
**Parameters:** 
- `taskId`: UUID of the task
- Body: `{ status, notes }`
**Response:** Updated task object
**Errors:** 400 Bad Request, 401 Unauthorized, 404 Not Found, 500 Internal Server Error

### POST /api/pens/:penId/request-feeding-programs

**Purpose:** Manually create a task for nutritionist to create feeding programs (if not auto-created)
**Parameters:** 
- `penId`: UUID of the pen
- Body: `{ priority, notes }`
**Response:** Created task object
**Errors:** 400 Bad Request, 401 Unauthorized, 404 Not Found, 409 Conflict (task exists), 500 Internal Server Error

### Feeding Completion

### POST /api/pen-feeding-programs/:programId/completion

**Purpose:** Mark a scheduled feeding as completed
**Parameters:** 
- `programId`: UUID of pen feeding program
- Body: `{ date, feedingTime }`
**Response:** Completion status record
**Errors:** 400 Bad Request, 401 Unauthorized, 404 Not Found, 409 Conflict (already marked), 500 Internal Server Error

### GET /api/pen-feeding-programs/:programId/completion-status

**Purpose:** Get feeding completion status for a date range
**Parameters:** 
- `programId`: UUID of pen feeding program
- `startDate` (optional): Start of date range
- `endDate` (optional): End of date range
**Response:** Array of completion status records
**Errors:** 401 Unauthorized, 404 Not Found, 500 Internal Server Error

## Controllers

### FeedingIngredientController
- **createIngredient**: Creates new ingredient with nutritional data for user's library
- **getIngredients**: Retrieves user's ingredient library
- **updateIngredient**: Updates ingredient nutritional data
- **deleteIngredient**: Removes ingredient if not in use by templates or programs

### FeedingProgramTemplateController
- **createTemplate**: Validates template data, creates template with phases referencing ingredient library
- **getTemplates**: Retrieves user's templates with optional filtering by category tags
- **updateTemplate**: Updates existing template while preserving relationships
- **deleteTemplate**: Soft delete template and cascade to associated data

### PenFeedingProgramController
- **assignProgram**: Creates pen-specific program from template with customized phases and feeding times
- **assignMultiplePrograms**: Creates multiple sequential programs (starter, grower, finisher) for a pen
- **getPenPrograms**: Retrieves all feeding programs for specific pen
- **updateProgram**: Handles phase transitions and status updates
- **recordVariances**: Records variances for ingredients that differ from planned amounts
- **markCompletion**: Records feeding completion status with user tracking

### NutritionistTaskController
- **getTasks**: Retrieves nutritionist's task list with filtering options
- **updateTaskStatus**: Updates task status and adds notes
- **createTask**: Manually creates a task for feeding program creation
- **onPenCreated**: Webhook/trigger that automatically creates task when new pen is created

### VarianceAnalysisController
- **getVarianceRecords**: Retrieves stored variance records for analysis
- **getVarianceSummary**: Provides high-level variance metrics for dashboard display
- **getCompletionStatus**: Returns feeding completion status for date ranges

## Business Logic

- Ingredient management ensures consistent nutritional data across all programs
- Template creation validates nutritional data and phase ordering
- Pen program assignment allows full customization of phases and ingredients from template
- Multiple sequential programs per pen supported (starter → grower → finisher progression)
- Multiple daily feeding times supported through feedingTimes array
- Automatic task creation when producer creates new pen with assigned nutritionist
- Task workflow ensures nutritionists are prompted to create feeding programs for new pens
- Only variances from planned amounts are recorded, reducing storage requirements
- Completion status tracking ensures feeding accountability
- Category tag filtering supports consultant workflow organization
- Template sharing enables best practice distribution across consultant network