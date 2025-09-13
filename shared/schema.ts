import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb, real, varchar, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Zod schemas for validation
export const insertDeathLossSchema = z.object({
  penId: z.number(),
  lossDate: z.string(),
  reason: z.string(),
  cattleCount: z.number().min(1),
  estimatedWeight: z.number().min(1),
  tagNumbers: z.string().optional(),
  notes: z.string().optional(),
  operatorEmail: z.string().email(),
});

export const insertTreatmentSchema = z.object({
  penId: z.number(),
  treatmentDate: z.string(),
  treatmentType: z.string(),
  product: z.string(),
  dosage: z.string(),
  cattleCount: z.number().min(1),
  tagNumbers: z.string().optional(),
  treatedBy: z.string(),
  notes: z.string().optional(),
  operatorEmail: z.string().email(),
});

// Unified authentication system tables

// Users table - unified authentication for consultants, producers, and staff
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 20 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  userType: text("user_type", { enum: ["consultant", "producer", "staff"] }).notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Consultant profiles - professional information for consultants
export const consultantProfiles = pgTable("consultant_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  company: varchar("company", { length: 150 }),
  phone: varchar("phone", { length: 20 }),
  specialization: text("specialization", { enum: ["nutritionist", "veterinarian"] }).notNull(),
  credentials: text("credentials"),
  bio: text("bio"),
  profilePhoto: text("profile_photo"),
  profileCompletePercentage: integer("profile_complete_percentage").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Refresh tokens for JWT authentication
export const refreshTokens = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Email verification tokens
export const emailVerifications = pgTable("email_verifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Consultant to producer invitations
export const consultantProducerInvitations = pgTable("consultant_producer_invitations", {
  id: serial("id").primaryKey(),
  consultantId: integer("consultant_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  producerEmail: varchar("producer_email", { length: 255 }).notNull(),
  producerName: varchar("producer_name", { length: 255 }).notNull(),
  producerId: integer("producer_id").references(() => users.id, { onDelete: "set null" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  message: text("message"),
  status: text("status", { enum: ["pending", "accepted", "declined", "expired"] }).notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  declinedAt: timestamp("declined_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Active relationships between consultants and producers
export const consultantProducerRelationships = pgTable("consultant_producer_relationships", {
  id: serial("id").primaryKey(),
  consultantId: integer("consultant_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  producerId: integer("producer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  operationId: integer("operation_id").references(() => operations.id, { onDelete: "cascade" }),
  permissions: jsonb("permissions").notNull().default({ view: true, edit: false, admin: false }),
  status: text("status", { enum: ["active", "inactive", "suspended"] }).notNull().default("active"),
  establishedAt: timestamp("established_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Validation schemas for new authentication tables
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConsultantProfileSchema = createInsertSchema(consultantProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  profileCompletePercentage: true,
});

export const consultantRegistrationSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(20, "Username must be at most 20 characters").regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain at least one uppercase letter, one lowercase letter, and one number"),
  fullName: z.string().min(1, "Full name is required"),
  company: z.string().max(150, "Company name must be at most 150 characters").optional(),
  specialization: z.enum(["nutritionist", "veterinarian"], { required_error: "Please select a specialization" }),
});

export const loginSchema = z.object({
  username: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().min(1, "Password is required"),
}).refine(data => data.username || data.email, {
  message: "Either username or email is required",
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type ConsultantProfile = typeof consultantProfiles.$inferSelect;
export type InsertConsultantProfile = z.infer<typeof insertConsultantProfileSchema>;
export type ConsultantRegistration = z.infer<typeof consultantRegistrationSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;

export const operations = pgTable("operations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  operatorEmail: text("operator_email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  location: text("location").notNull(),
  inviteCode: text("invite_code").notNull(),
  setupDate: timestamp("setup_date").notNull().defaultNow(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }), // Migration field to link with users table
});

export const insertOperationSchema = createInsertSchema(operations).omit({
  id: true,
  setupDate: true,
});

export type InsertOperation = z.infer<typeof insertOperationSchema>;
export type Operation = typeof operations.$inferSelect;

// Staff members table for team management
export const staffMembers = pgTable("staff_members", {
  id: serial("id").primaryKey(),
  operationId: integer("operation_id").notNull().references(() => operations.id),
  email: text("email").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role", { enum: ["owner", "staff"] }).notNull().default("staff"),
  status: text("status", { enum: ["invited", "active"] }).notNull().default("invited"),
  invitedAt: timestamp("invited_at").notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  invitedBy: text("invited_by").notNull(),
});

// Staff invitation tokens for secure email verification
export const staffInvitations = pgTable("staff_invitations", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  operationId: integer("operation_id").notNull().references(() => operations.id),
  email: text("email").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  invitedBy: text("invited_by").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStaffMemberSchema = createInsertSchema(staffMembers).omit({
  id: true,
  invitedAt: true,
  acceptedAt: true,
});

export const insertStaffInvitationSchema = createInsertSchema(staffInvitations).omit({
  id: true,
  token: true,
  expiresAt: true,
  usedAt: true,
  createdAt: true,
});

export type InsertStaffMember = z.infer<typeof insertStaffMemberSchema>;
export type StaffMember = typeof staffMembers.$inferSelect;
export type InsertStaffInvitation = z.infer<typeof insertStaffInvitationSchema>;
export type StaffInvitation = typeof staffInvitations.$inferSelect;

// Invitation request schema for frontend forms
export const inviteStaffSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

export type InviteStaffForm = z.infer<typeof inviteStaffSchema>;

// Accept invitation schema
export const acceptStaffInvitationSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
});

export type AcceptStaffInvitationForm = z.infer<typeof acceptStaffInvitationSchema>;

// Consultant-Producer Relationship schemas
export const relationshipPermissionsSchema = z.object({
  view: z.boolean().default(true),
  edit: z.boolean().default(false),
  admin: z.boolean().default(false)
});

export const createRelationshipSchema = z.object({
  invitationId: z.number().positive(),
  operationId: z.number().positive(),
  permissions: relationshipPermissionsSchema
});

export const updateRelationshipSchema = z.object({
  permissions: relationshipPermissionsSchema
});

export const relationshipStatusSchema = z.enum(['active', 'inactive', 'suspended']);

// Validation schemas for invitation flow
export const inviteProducerSchema = z.object({
  producerEmail: z.string().email("Please enter a valid email address"),
  producerName: z.string().min(1, "Producer name is required"),
  message: z.string().optional()
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
  permissions: relationshipPermissionsSchema.optional()
});

export type RelationshipPermissions = z.infer<typeof relationshipPermissionsSchema>;
export type CreateRelationship = z.infer<typeof createRelationshipSchema>;
export type UpdateRelationship = z.infer<typeof updateRelationshipSchema>;
export type InviteProducer = z.infer<typeof inviteProducerSchema>;
export type AcceptInvitation = z.infer<typeof acceptInvitationSchema>;



// Additional Drizzle table definitions from server/db/schema.ts

// Pens table (migrated to use proper foreign keys)
export const pens = pgTable("pens", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  operationId: integer("operation_id").notNull().references(() => operations.id),
  capacity: integer("capacity").notNull(),
  current: integer("current").notNull(),
  status: text("status", { enum: ["Active", "Maintenance", "Inactive"] }).notNull().default("Active"),
  feedType: text("feed_type").notNull(),
  lastFed: timestamp("last_fed"),
  cattleType: text("cattle_type", { enum: ["Steers", "Heifers", "Mixed"] }).notNull(),
  startingWeight: real("starting_weight").notNull(),
  currentWeight: real("current_weight").notNull(),
  marketWeight: real("market_weight").notNull(),
  averageDailyGain: real("average_daily_gain").default(0),
  isCrossbred: boolean("is_crossbred").default(false),
  daysOnFeed: integer("days_on_feed").default(0),
  feedConversion: real("feed_conversion").default(0),
  projectedCloseoutDate: text("projected_closeout_date"),
  estimatedValue: real("estimated_value").default(0),
  nutritionistId: integer("nutritionist_id").references(() => users.id),
  startDate: timestamp("start_date").notNull().defaultNow(),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  operationIdx: index("idx_pens_operation").on(table.operationId),
}));

export type Pen = typeof pens.$inferSelect;
export type InsertPen = typeof pens.$inferInsert;

// Weight records table
export const weightRecords = pgTable("weight_records", {
  id: serial("id").primaryKey(),
  penId: integer("pen_id").notNull().references(() => pens.id),
  weight: real("weight").notNull(),
  recordedBy: text("recorded_by").notNull(),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

export type WeightRecord = typeof weightRecords.$inferSelect;
export type InsertWeightRecord = typeof weightRecords.$inferInsert;

// Feeding records table
export const feedingRecords = pgTable("feeding_records", {
  id: serial("id").primaryKey(),
  penId: integer("pen_id").notNull().references(() => pens.id),
  scheduleId: text("schedule_id").notNull(),
  plannedAmount: text("planned_amount").notNull(),
  feedingTime: timestamp("feeding_time").notNull(),
  feedingDate: text("feeding_date").notNull(),
  feedType: text("feed_type").notNull(),
  amount: real("amount").notNull(),
  unit: text("unit").notNull(),
  ingredients: jsonb("ingredients"),
  fedBy: text("fed_by").notNull(),
  notes: text("notes"),
  operatorEmail: text("operator_email").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type FeedingRecord = typeof feedingRecords.$inferSelect;
export type InsertFeedingRecord = typeof feedingRecords.$inferInsert;


// Cattle sales table
export const cattleSales = pgTable("cattle_sales", {
  id: serial("id").primaryKey(),
  penId: integer("pen_id").notNull().references(() => pens.id),
  saleDate: text("sale_date").notNull(),
  headCount: integer("head_count").notNull(),
  averageWeight: real("average_weight").notNull(),
  pricePerCwt: real("price_per_cwt").notNull(),
  totalRevenue: real("total_revenue").notNull(),
  daysOnFeed: integer("days_on_feed").notNull().default(0),
  averageDailyGain: real("average_daily_gain").notNull().default(0),
  buyerName: text("buyer_name"),
  transportCost: real("transport_cost"),
  notes: text("notes"),
  operatorEmail: text("operator_email").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type CattleSale = typeof cattleSales.$inferSelect;
export type InsertCattleSale = typeof cattleSales.$inferInsert;

// Death loss table
export const deathLosses = pgTable("death_losses", {
  id: serial("id").primaryKey(),
  penId: integer("pen_id").notNull().references(() => pens.id),
  lossDate: text("loss_date").notNull(),
  reason: text("reason").notNull(),
  cattleCount: integer("cattle_count").notNull(),
  estimatedWeight: real("estimated_weight").notNull(),
  tagNumbers: text("tag_numbers"),
  notes: text("notes"),
  operatorEmail: text("operator_email").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type DeathLoss = typeof deathLosses.$inferSelect;
export type InsertDeathLoss = typeof deathLosses.$inferInsert;

// Treatment records table
export const treatmentRecords = pgTable("treatment_records", {
  id: serial("id").primaryKey(),
  penId: integer("pen_id").notNull().references(() => pens.id),
  treatmentDate: text("treatment_date").notNull(),
  treatmentType: text("treatment_type").notNull(),
  product: text("product").notNull(),
  dosage: text("dosage").notNull(),
  cattleCount: integer("cattle_count").notNull(),
  tagNumbers: text("tag_numbers"),
  treatedBy: text("treated_by").notNull(),
  notes: text("notes"),
  operatorEmail: text("operator_email").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type TreatmentRecord = typeof treatmentRecords.$inferSelect;
export type InsertTreatmentRecord = typeof treatmentRecords.$inferInsert;

// Partial sales table
export const partialSales = pgTable("partial_sales", {
  id: serial("id").primaryKey(),
  penId: integer("pen_id").notNull().references(() => pens.id),
  saleDate: text("sale_date").notNull(),
  headCount: integer("head_count").notNull(),
  averageWeight: real("average_weight").notNull(),
  pricePerCwt: real("price_per_cwt").notNull(),
  totalRevenue: real("total_revenue").notNull(),
  tagNumbers: text("tag_numbers"),
  notes: text("notes"),
  operatorEmail: text("operator_email").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PartialSale = typeof partialSales.$inferSelect;
export type InsertPartialSale = typeof partialSales.$inferInsert;


// Invite codes table (for operation invites)
export const inviteCodes = pgTable("invite_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  operatorEmail: text("operator_email").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
  used: boolean("used").default(false),
});

export type InviteCode = typeof inviteCodes.$inferSelect;
export type InsertInviteCode = typeof inviteCodes.$inferInsert;

// Session storage table for connect-pg-simple
export const session = pgTable("session", {
  sid: text("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire", { mode: "date" }).notNull(),
});

// Define relations

// Users relations - includes consultant profile and other relationships
export const usersRelations = relations(users, ({ one, many }) => ({
  consultantProfile: one(consultantProfiles, {
    fields: [users.id],
    references: [consultantProfiles.userId],
  }),
  operation: one(operations, {
    fields: [users.id],
    references: [operations.userId],
  }),
  refreshTokens: many(refreshTokens),
  emailVerifications: many(emailVerifications),
  feedingIngredients: many(feedingIngredients),
  feedingProgramTemplates: many(feedingProgramTemplates),
  penFeedingPrograms: many(penFeedingPrograms),
  dailyFeedingCompletionStatuses: many(dailyFeedingCompletionStatus),
  nutritionistTasks: many(nutritionistTasks),
  consultantProducerRelationshipsAsConsultant: many(consultantProducerRelationships),
  consultantProducerRelationshipsAsProducer: many(consultantProducerRelationships),
  consultantProducerInvitations: many(consultantProducerInvitations),
}));

// Consultant profiles relations
export const consultantProfilesRelations = relations(consultantProfiles, ({ one }) => ({
  user: one(users, {
    fields: [consultantProfiles.userId],
    references: [users.id],
  }),
}));

export const operationsRelations = relations(operations, ({ many }) => ({
  staffMembers: many(staffMembers),
  staffInvitations: many(staffInvitations),
}));

export const staffMembersRelations = relations(staffMembers, ({ one }) => ({
  operation: one(operations, {
    fields: [staffMembers.operationId],
    references: [operations.id],
  }),
}));

export const pensRelations = relations(pens, ({ one, many }) => ({
  operation: one(operations, {
    fields: [pens.operationId],
    references: [operations.id],
  }),
  nutritionist: one(users, {
    fields: [pens.nutritionistId],
    references: [users.id],
  }),
  weightRecords: many(weightRecords),
  penFeedingPrograms: many(penFeedingPrograms),
  feedingRecordVariances: many(feedingRecordVariances),
  nutritionistTasks: many(nutritionistTasks),
}));

export const weightRecordsRelations = relations(weightRecords, ({ one }) => ({
  pen: one(pens, {
    fields: [weightRecords.penId],
    references: [pens.id],
  }),
}));


// Feeding Program Designer Tables

// Feeding ingredients for centralized ingredient management
export const feedingIngredients = pgTable("feeding_ingredients", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  proteinPercentage: decimal("protein_percentage", { precision: 5, scale: 2 }),
  dryMatterPercentage: decimal("dry_matter_percentage", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIngredientUnique: uniqueIndex("feeding_ingredients_user_name_idx").on(table.userId, table.name),
  userIdx: index("idx_feeding_ingredients_user").on(table.userId),
}));

// Feeding program templates for reusable program designs
export const feedingProgramTemplates = pgTable("feeding_program_templates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  categoryTags: text("category_tags").array(),
  createdByUserId: integer("created_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  isShared: boolean("is_shared").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  createdByIdx: index("idx_feeding_program_templates_created_by").on(table.createdByUserId),
  categoryTagsIdx: index("idx_feeding_program_templates_category_tags").using("gin", table.categoryTags),
}));

// Phases within feeding program templates
export const feedingProgramPhases = pgTable("feeding_program_phases", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  templateId: text("template_id").notNull().references(() => feedingProgramTemplates.id, { onDelete: "cascade" }),
  phaseName: varchar("phase_name", { length: 255 }).notNull(),
  phaseOrder: integer("phase_order").notNull(),
  durationDays: integer("duration_days").notNull(),
  targetMcalPerRation: decimal("target_mcal_per_ration", { precision: 8, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  templatePhaseIdx: index("idx_feeding_program_phases_template").on(table.templateId, table.phaseOrder),
}));

// Ingredients within feeding program phases
export const feedingProgramIngredients = pgTable("feeding_program_ingredients", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  phaseId: text("phase_id").notNull().references(() => feedingProgramPhases.id, { onDelete: "cascade" }),
  ingredientId: text("ingredient_id").notNull().references(() => feedingIngredients.id),
  percentageOfRation: decimal("percentage_of_ration", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  phaseIdx: index("idx_feeding_program_ingredients_phase").on(table.phaseId),
}));

// Pen-specific feeding programs based on templates
export const penFeedingPrograms = pgTable("pen_feeding_programs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  penId: integer("pen_id").notNull().references(() => pens.id),
  templateId: text("template_id").references(() => feedingProgramTemplates.id),
  programName: varchar("program_name", { length: 255 }).notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  feedingTimes: text("feeding_times").array(),
  currentPhase: integer("current_phase").default(1),
  status: varchar("status", { length: 50 }).default("active"),
  createdByUserId: integer("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  penIdx: index("idx_pen_feeding_programs_pen").on(table.penId),
  templateIdx: index("idx_pen_feeding_programs_template").on(table.templateId),
}));

// Pen-specific feeding program phases (customizable from template)
export const penFeedingProgramPhases = pgTable("pen_feeding_program_phases", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  penProgramId: text("pen_program_id").notNull().references(() => penFeedingPrograms.id, { onDelete: "cascade" }),
  templatePhaseId: text("template_phase_id").references(() => feedingProgramPhases.id),
  phaseName: varchar("phase_name", { length: 255 }).notNull(),
  phaseOrder: integer("phase_order").notNull(),
  durationDays: integer("duration_days").notNull(),
  targetMcalPerRation: decimal("target_mcal_per_ration", { precision: 8, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  programPhaseIdx: index("idx_pen_feeding_program_phases_program").on(table.penProgramId, table.phaseOrder),
}));

// Pen-specific feeding program ingredients (customizable from template)
export const penFeedingProgramIngredients = pgTable("pen_feeding_program_ingredients", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  penPhaseId: text("pen_phase_id").notNull().references(() => penFeedingProgramPhases.id, { onDelete: "cascade" }),
  ingredientId: text("ingredient_id").notNull().references(() => feedingIngredients.id),
  percentageOfRation: decimal("percentage_of_ration", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  phaseIdx: index("idx_pen_feeding_program_ingredients_phase").on(table.penPhaseId),
}));

// Variance tracking - only records when actual differs from planned
export const feedingRecordVariances = pgTable("feeding_record_variances", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  penProgramId: text("pen_program_id").notNull().references(() => penFeedingPrograms.id),
  penId: integer("pen_id").notNull().references(() => pens.id),
  ingredientId: text("ingredient_id").notNull().references(() => feedingIngredients.id),
  recordedByUserId: integer("recorded_by_user_id").notNull().references(() => users.id),
  date: text("date").notNull(),
  feedingTime: varchar("feeding_time", { length: 10 }),
  plannedAmount: decimal("planned_amount", { precision: 8, scale: 2 }).notNull(),
  actualAmount: decimal("actual_amount", { precision: 8, scale: 2 }).notNull(),
  varianceAmount: decimal("variance_amount", { precision: 8, scale: 2 }).notNull(),
  variancePercentage: decimal("variance_percentage", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  penProgramDateIdx: index("idx_feeding_record_variances_pen_program").on(table.penProgramId, table.date),
  uniqueVariance: uniqueIndex("feeding_record_variances_unique_idx").on(table.penProgramId, table.ingredientId, table.date, table.feedingTime),
}));

// Daily feeding completion status tracking
export const dailyFeedingCompletionStatus = pgTable("daily_feeding_completion_status", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  penProgramId: text("pen_program_id").notNull().references(() => penFeedingPrograms.id),
  completedByUserId: integer("completed_by_user_id").notNull().references(() => users.id),
  date: text("date").notNull(),
  feedingTime: varchar("feeding_time", { length: 10 }).notNull(),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
}, (table) => ({
  uniqueCompletion: uniqueIndex("daily_feeding_completion_unique_idx").on(table.penProgramId, table.date, table.feedingTime),
}));

// Nutritionist task management
// Consultant/Nutritionist task management
// Updated to use userId instead of nutritionistId for consistency with users table
export const nutritionistTasks = pgTable("nutritionist_tasks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: integer("user_id").notNull().references(() => users.id), // Changed from nutritionistId to userId
  penId: integer("pen_id").notNull().references(() => pens.id),
  taskType: varchar("task_type", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending"),
  priority: varchar("priority", { length: 20 }).default("normal"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  completedByUserId: integer("completed_by_user_id").references(() => users.id),
  notes: text("notes"),
}, (table) => ({
  userStatusIdx: index("idx_nutritionist_tasks_user").on(table.userId, table.status),
  penIdx: index("idx_nutritionist_tasks_pen").on(table.penId),
  uniqueTask: uniqueIndex("nutritionist_tasks_pen_task_unique_idx").on(table.penId, table.taskType),
}));

// ===========================================
// NEW FEEDING SYSTEM TYPE EXPORTS
// ===========================================

// Ingredient types
export type FeedingIngredient = typeof feedingIngredients.$inferSelect;
export type InsertFeedingIngredient = typeof feedingIngredients.$inferInsert;

// Template types
export type FeedingProgramTemplate = typeof feedingProgramTemplates.$inferSelect;
export type InsertFeedingProgramTemplate = typeof feedingProgramTemplates.$inferInsert;

// Template phase types
export type FeedingProgramPhase = typeof feedingProgramPhases.$inferSelect;
export type InsertFeedingProgramPhase = typeof feedingProgramPhases.$inferInsert;

// Template ingredient types  
export type FeedingProgramIngredient = typeof feedingProgramIngredients.$inferSelect;
export type InsertFeedingProgramIngredient = typeof feedingProgramIngredients.$inferInsert;

// Pen program types
export type PenFeedingProgram = typeof penFeedingPrograms.$inferSelect;
export type InsertPenFeedingProgram = typeof penFeedingPrograms.$inferInsert;

// Pen phase types
export type PenFeedingProgramPhase = typeof penFeedingProgramPhases.$inferSelect;
export type InsertPenFeedingProgramPhase = typeof penFeedingProgramPhases.$inferInsert;

// Pen ingredient types
export type PenFeedingProgramIngredient = typeof penFeedingProgramIngredients.$inferSelect;
export type InsertPenFeedingProgramIngredient = typeof penFeedingProgramIngredients.$inferInsert;

// Variance types
export type FeedingRecordVariance = typeof feedingRecordVariances.$inferSelect;
export type InsertFeedingRecordVariance = typeof feedingRecordVariances.$inferInsert;

// Completion types
export type DailyFeedingCompletionStatus = typeof dailyFeedingCompletionStatus.$inferSelect;
export type InsertDailyFeedingCompletionStatus = typeof dailyFeedingCompletionStatus.$inferInsert;

// Relations for new feeding program tables
export const feedingIngredientsRelations = relations(feedingIngredients, ({ one, many }) => ({
  user: one(users, {
    fields: [feedingIngredients.userId],
    references: [users.id],
  }),
  programIngredients: many(feedingProgramIngredients),
  penProgramIngredients: many(penFeedingProgramIngredients),
  variances: many(feedingRecordVariances),
}));

export const feedingProgramTemplatesRelations = relations(feedingProgramTemplates, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [feedingProgramTemplates.createdByUserId],
    references: [users.id],
  }),
  phases: many(feedingProgramPhases),
  penPrograms: many(penFeedingPrograms),
}));

export const feedingProgramPhasesRelations = relations(feedingProgramPhases, ({ one, many }) => ({
  template: one(feedingProgramTemplates, {
    fields: [feedingProgramPhases.templateId],
    references: [feedingProgramTemplates.id],
  }),
  ingredients: many(feedingProgramIngredients),
  penPhases: many(penFeedingProgramPhases),
}));

export const feedingProgramIngredientsRelations = relations(feedingProgramIngredients, ({ one }) => ({
  phase: one(feedingProgramPhases, {
    fields: [feedingProgramIngredients.phaseId],
    references: [feedingProgramPhases.id],
  }),
  ingredient: one(feedingIngredients, {
    fields: [feedingProgramIngredients.ingredientId],
    references: [feedingIngredients.id],
  }),
}));

export const penFeedingProgramsRelations = relations(penFeedingPrograms, ({ one, many }) => ({
  pen: one(pens, {
    fields: [penFeedingPrograms.penId],
    references: [pens.id],
  }),
  template: one(feedingProgramTemplates, {
    fields: [penFeedingPrograms.templateId],
    references: [feedingProgramTemplates.id],
  }),
  createdBy: one(users, {
    fields: [penFeedingPrograms.createdByUserId],
    references: [users.id],
  }),
  phases: many(penFeedingProgramPhases),
  variances: many(feedingRecordVariances),
  completionStatus: many(dailyFeedingCompletionStatus),
}));

export const penFeedingProgramPhasesRelations = relations(penFeedingProgramPhases, ({ one, many }) => ({
  penProgram: one(penFeedingPrograms, {
    fields: [penFeedingProgramPhases.penProgramId],
    references: [penFeedingPrograms.id],
  }),
  templatePhase: one(feedingProgramPhases, {
    fields: [penFeedingProgramPhases.templatePhaseId],
    references: [feedingProgramPhases.id],
  }),
  ingredients: many(penFeedingProgramIngredients),
}));

export const penFeedingProgramIngredientsRelations = relations(penFeedingProgramIngredients, ({ one }) => ({
  penPhase: one(penFeedingProgramPhases, {
    fields: [penFeedingProgramIngredients.penPhaseId],
    references: [penFeedingProgramPhases.id],
  }),
  ingredient: one(feedingIngredients, {
    fields: [penFeedingProgramIngredients.ingredientId],
    references: [feedingIngredients.id],
  }),
}));

export const feedingRecordVariancesRelations = relations(feedingRecordVariances, ({ one }) => ({
  penProgram: one(penFeedingPrograms, {
    fields: [feedingRecordVariances.penProgramId],
    references: [penFeedingPrograms.id],
  }),
  pen: one(pens, {
    fields: [feedingRecordVariances.penId],
    references: [pens.id],
  }),
  ingredient: one(feedingIngredients, {
    fields: [feedingRecordVariances.ingredientId],
    references: [feedingIngredients.id],
  }),
  recordedBy: one(users, {
    fields: [feedingRecordVariances.recordedByUserId],
    references: [users.id],
  }),
}));

export const dailyFeedingCompletionStatusRelations = relations(dailyFeedingCompletionStatus, ({ one }) => ({
  penProgram: one(penFeedingPrograms, {
    fields: [dailyFeedingCompletionStatus.penProgramId],
    references: [penFeedingPrograms.id],
  }),
  completedBy: one(users, {
    fields: [dailyFeedingCompletionStatus.completedByUserId],
    references: [users.id],
  }),
}));

export const nutritionistTasksRelations = relations(nutritionistTasks, ({ one }) => ({
  user: one(users, {
    fields: [nutritionistTasks.userId],
    references: [users.id],
  }),
  pen: one(pens, {
    fields: [nutritionistTasks.penId],
    references: [pens.id],
  }),
  completedBy: one(users, {
    fields: [nutritionistTasks.completedByUserId],
    references: [users.id],
  }),
}));

// Type exports for feeding program designer
export type NutritionistTask = typeof nutritionistTasks.$inferSelect;
export type InsertNutritionistTask = typeof nutritionistTasks.$inferInsert;

// Legacy types - temporarily kept for compatibility during cleanup
// TODO: Remove these once all references are updated
export interface FeedingPlan {
  id: number;
  penId: number;
  name: string;
  operatorEmail: string;
  ingredients: any;
  totalCostPerTon?: number;
  proteinContent?: number;
  energyContent?: number;
  dailyFeedAmount?: number;
  estimatedDailyGain?: number;
  feedConversionRatio?: number;
  createdDate: string;
  lastModified: string;
  notes?: string;
}

export interface FeedingPlan2 {
  id: string;
  penId: number;
  penName: string;
  planName: string;
  startDate: string;
  daysToFeed: number;
  currentDay: number;
  status: 'Active' | 'Upcoming' | 'Completed';
  feedType: string;
  schedules: FeedingSchedule[];
  operatorEmail: string;
}

export interface FeedingSchedule {
  id: string;
  time: string;
  totalAmount: string;
  ingredients: FeedingIngredient[];
  totalNutrition: {
    protein: string;
    fat: string;
    fiber: string;
    moisture: string;
  };
}

export interface Nutritionist {
  id: string;
  name: string;
  company?: string;
  email: string;
  phone?: string;
  specialties?: any;
  operatorEmail: string;
  status: 'active' | 'inactive' | 'pending';
  joinedDate?: string;
  createdAt: Date;
}

export interface AcceptInvitationRequest {
  nutritionistId: string;
  operatorEmail: string;
}

// Zod schemas for feeding program designer
export const insertFeedingIngredientSchema = createInsertSchema(feedingIngredients);
export const insertFeedingProgramTemplateSchema = createInsertSchema(feedingProgramTemplates);
export const insertFeedingProgramPhaseSchema = createInsertSchema(feedingProgramPhases);
export const insertFeedingProgramIngredientSchema = createInsertSchema(feedingProgramIngredients);
export const insertPenFeedingProgramSchema = createInsertSchema(penFeedingPrograms);
export const insertPenFeedingProgramPhaseSchema = createInsertSchema(penFeedingProgramPhases);
export const insertPenFeedingProgramIngredientSchema = createInsertSchema(penFeedingProgramIngredients);
export const insertFeedingRecordVarianceSchema = createInsertSchema(feedingRecordVariances);
export const insertDailyFeedingCompletionStatusSchema = createInsertSchema(dailyFeedingCompletionStatus);
export const insertNutritionistTaskSchema = createInsertSchema(nutritionistTasks);


// External system data types (read-only)
// export interface WeightRecord {
//   date: string;
//   weight: number;
//   recordedBy: string;
// }

// export interface Pen2 {
//   id: number;
//   name: string;
//   capacity: number;
//   current: number;
//   status: 'Active' | 'Maintenance' | 'Inactive';
//   feedType: string;
//   lastFed: string;
//   operatorEmail: string;
//   cattleType: 'Steers' | 'Heifers' | 'Mixed';
//   startingWeight: number;
//   marketWeight: number;
//   averageDailyGain: number;
//   isCrossbred: boolean;
//   currentWeight: number;
//   daysOnFeed: number;
//   startDate: string;
//   endDate?: string;
//   weightHistory: WeightRecord[];
//   nutritionistId?: string;
// }

export interface CreatePenRequest {
  name: string;
  capacity: number;
  current: number;
  operatorEmail: string;
  operationId: number;
  cattleType: 'Steers' | 'Heifers' | 'Mixed';
  startingWeight: number;
  marketWeight: number;
  feedType: string;
  isCrossbred: boolean;
  startDate?: string; // Optional, defaults to now
  nutritionistId?: string;
}

export interface UpdateWeightRequest {
  penId: number;
  newWeight: number;
  operatorEmail: string;
  operationId: number;
}

// export interface FeedIngredient2 {
//   name: string;
//   category: 'Feedstuff' | 'Mineral' | 'Protein' | 'Grain' | 'Supplement';
//   amount: string;
//   unit: 'lbs' | 'kg' | 'oz' | 'g';
//   percentage: string;
//   nutritionalValue?: {
//     protein?: string;
//     fat?: string;
//     fiber?: string;
//     moisture?: string;
//   };
// }


export interface UpcomingScheduleChange {
  id: string;
  penId: number;
  penName: string;
  changeType: 'Plan Start' | 'Plan End' | 'Feed Change';
  changeDate: string;
  daysFromNow: number;
  currentPlan?: string;
  newPlan?: string;
  description: string;
  operatorEmail: string;
}

export interface DashboardStats {
  totalPens: number;
  totalCattle: number;
  activeSchedules: number;
  staffCount: number;
  avgFeedPerDay: string;
  lastSync: string;
}

// Feeding records for tracking actual feeding events
export interface FeedingRecord2 {
  id: string;
  operationId: number;
  penId: number;
  scheduleId: string;
  plannedAmount: string;
  actualIngredients: ActualIngredient[];
  feedingTime: string;
  operatorEmail: string;
  createdAt: string;
}

export interface ActualIngredient {
  name: string;
  plannedAmount: string;
  actualAmount: string;
  unit: string;
  category: string;
}

// export interface InsertFeedingRecord {
//   operationId?: number;
//   penId: number;
//   scheduleId?: string;
//   plannedAmount?: string;
//   feedingTime?: Date;
//   feedingDate?: string;
//   feedType?: string;
//   amount?: number;
//   unit?: string;
//   ingredients?: any[];
//   actualIngredients?: ActualIngredient[];
//   fedBy?: string;
//   notes?: string;
//   operatorEmail: string;
// }

// Cattle Sale Records
// export interface CattleSale {
//   id: string;
//   operationId: number;
//   penId: number;
//   penName: string;
//   finalWeight: number;
//   pricePerCwt: number;
//   totalRevenue: number;
//   cattleCount: number;
//   cattleType: string;
//   startingWeight: number;
//   averageDailyGain: number;
//   daysOnFeed: number;
//   nutritionistId?: string;
//   saleDate: string;
//   penStartDate?: string;
//   operatorEmail: string;
//   createdAt: string;
// }

// export interface InsertCattleSale {
//   operationId: number;
//   penId: number;
//   finalWeight: number;
//   pricePerCwt: number;
//   saleDate: string;
//   operatorEmail: string;
// }

// Nutritionist interface for external system integration
// export interface Nutritionist {
//   id: string;
//   name: string;
//   company: string;
//   operatorEmail: string;
//   status: 'active' | 'inactive' | 'pending';
//   invitedAt?: string;
//   acceptedAt?: string;
// }


// Death Loss Records
// export interface DeathLoss {
//   id: string;
//   operationId: number;
//   penId: number;
//   penName: string;
//   lossDate: string;
//   reason: string;
//   cattleCount: number;
//   estimatedWeight: number;
//   tagNumbers?: string;
//   notes?: string;
//   operatorEmail: string;
//   createdAt: string;
// }

// export interface InsertDeathLoss {
//   operationId: number;
//   penId: number;
//   lossDate: string;
//   reason: string;
//   cattleCount: number;
//   estimatedWeight: number;
//   tagNumbers?: string;
//   notes?: string;
//   operatorEmail: string;
// }

// Treatment Records
// export interface TreatmentRecord {
//   id: string;
//   operationId: number;
//   penId: number;
//   penName: string;
//   treatmentDate: string;
//   treatmentType: string;
//   product: string;
//   dosage: string;
//   cattleCount: number;
//   tagNumbers?: string;
//   treatedBy: string;
//   notes?: string;
//   operatorEmail: string;
//   createdAt: string;
// }

// export interface InsertTreatmentRecord {
//   operationId: number;
//   penId: number;
//   treatmentDate: string;
//   treatmentType: string;
//   product: string;
//   dosage: string;
//   cattleCount: number;
//   tagNumbers?: string;
//   treatedBy: string;
//   notes?: string;
//   operatorEmail: string;
// }

// Partial Sale Records  
// export interface PartialSale {
//   id: string;
//   operationId: number;
//   penId: number;
//   penName: string;
//   saleDate: string;
//   cattleCount: number;
//   finalWeight: number;
//   pricePerCwt: number;
//   totalRevenue: number;
//   tagNumbers?: string;
//   buyer?: string;
//   notes?: string;
//   operatorEmail: string;
//   createdAt: string;
// }

// export interface InsertPartialSale {
//   operationId: number;
//   penId: number;
//   saleDate: string;
//   cattleCount: number;
//   finalWeight: number;
//   pricePerCwt: number;
//   totalRevenue: number;
//   tagNumbers?: string;
//   buyer?: string;
//   notes?: string;
//   operatorEmail: string;
// }