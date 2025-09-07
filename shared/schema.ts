import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb, real, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Zod schemas for validation
export const insertDeathLossSchema = z.object({
  penId: z.string(),
  lossDate: z.string(),
  reason: z.string(),
  cattleCount: z.number().min(1),
  estimatedWeight: z.number().min(1),
  tagNumbers: z.string().optional(),
  notes: z.string().optional(),
  operatorEmail: z.string().email(),
});

export const insertTreatmentSchema = z.object({
  penId: z.string(),
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
  phone: varchar("phone", { length: 20 }),
  specialization: text("specialization", { enum: ["nutritionist", "veterinarian"] }).notNull(),
  credentials: text("credentials"),
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

// External system data types (read-only)
export interface WeightRecord {
  date: string;
  weight: number;
  recordedBy: string;
}

export interface Pen {
  id: string;
  name: string;
  capacity: number;
  current: number;
  status: 'Active' | 'Maintenance' | 'Inactive';
  feedType: string;
  lastFed: string;
  operatorEmail: string;
  cattleType: 'Steers' | 'Heifers' | 'Mixed';
  startingWeight: number;
  marketWeight: number;
  averageDailyGain: number;
  isCrossbred: boolean;
  currentWeight: number;
  daysOnFeed: number;
  startDate: string;
  endDate?: string;
  weightHistory: WeightRecord[];
  nutritionistId?: string;
}

export interface CreatePenRequest {
  name: string;
  capacity: number;
  current: number;
  operatorEmail: string;
  cattleType: 'Steers' | 'Heifers' | 'Mixed';
  startingWeight: number;
  marketWeight: number;
  feedType: string;
  isCrossbred: boolean;
  startDate?: string; // Optional, defaults to now
  nutritionistId?: string;
}

export interface UpdateWeightRequest {
  penId: string;
  newWeight: number;
  operatorEmail: string;
}

export interface FeedIngredient {
  name: string;
  category: 'Feedstuff' | 'Mineral' | 'Protein' | 'Grain' | 'Supplement';
  amount: string;
  unit: 'lbs' | 'kg' | 'oz' | 'g';
  percentage: string;
  nutritionalValue?: {
    protein?: string;
    fat?: string;
    fiber?: string;
    moisture?: string;
  };
}

export interface FeedingPlan {
  id: string;
  penId: string;
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
  ingredients: FeedIngredient[];
  totalNutrition: {
    protein: string;
    fat: string;
    fiber: string;
    moisture: string;
  };
}

export interface UpcomingScheduleChange {
  id: string;
  penId: string;
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
export interface FeedingRecord {
  id: string;
  operationId: number;
  penId: string;
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

export interface InsertFeedingRecord {
  operationId?: number;
  penId: string;
  scheduleId?: string;
  plannedAmount?: string;
  feedingTime?: Date;
  feedingDate?: string;
  feedType?: string;
  amount?: number;
  unit?: string;
  ingredients?: any[];
  actualIngredients?: ActualIngredient[];
  fedBy?: string;
  notes?: string;
  operatorEmail: string;
}

// Cattle Sale Records
export interface CattleSale {
  id: string;
  operationId: number;
  penId: string;
  penName: string;
  finalWeight: number;
  pricePerCwt: number;
  totalRevenue: number;
  cattleCount: number;
  cattleType: string;
  startingWeight: number;
  averageDailyGain: number;
  daysOnFeed: number;
  nutritionistId?: string;
  saleDate: string;
  penStartDate?: string;
  operatorEmail: string;
  createdAt: string;
}

export interface InsertCattleSale {
  operationId: number;
  penId: string;
  finalWeight: number;
  pricePerCwt: number;
  saleDate: string;
  operatorEmail: string;
}

// Nutritionist interface for external system integration
export interface Nutritionist {
  id: string;
  name: string;
  company: string;
  operatorEmail: string;
  status: 'active' | 'inactive' | 'pending';
  invitedAt?: string;
  acceptedAt?: string;
}

export interface AcceptInvitationRequest {
  nutritionistId: string;
  operatorEmail: string;
}

// Death Loss Records
export interface DeathLoss {
  id: string;
  operationId: number;
  penId: string;
  penName: string;
  lossDate: string;
  reason: string;
  cattleCount: number;
  estimatedWeight: number;
  tagNumbers?: string;
  notes?: string;
  operatorEmail: string;
  createdAt: string;
}

export interface InsertDeathLoss {
  operationId: number;
  penId: string;
  lossDate: string;
  reason: string;
  cattleCount: number;
  estimatedWeight: number;
  tagNumbers?: string;
  notes?: string;
  operatorEmail: string;
}

// Treatment Records
export interface TreatmentRecord {
  id: string;
  operationId: number;
  penId: string;
  penName: string;
  treatmentDate: string;
  treatmentType: string;
  product: string;
  dosage: string;
  cattleCount: number;
  tagNumbers?: string;
  treatedBy: string;
  notes?: string;
  operatorEmail: string;
  createdAt: string;
}

export interface InsertTreatmentRecord {
  operationId: number;
  penId: string;
  treatmentDate: string;
  treatmentType: string;
  product: string;
  dosage: string;
  cattleCount: number;
  tagNumbers?: string;
  treatedBy: string;
  notes?: string;
  operatorEmail: string;
}

// Partial Sale Records  
export interface PartialSale {
  id: string;
  operationId: number;
  penId: string;
  penName: string;
  saleDate: string;
  cattleCount: number;
  finalWeight: number;
  pricePerCwt: number;
  totalRevenue: number;
  tagNumbers?: string;
  buyer?: string;
  notes?: string;
  operatorEmail: string;
  createdAt: string;
}

export interface InsertPartialSale {
  operationId: number;
  penId: string;
  saleDate: string;
  cattleCount: number;
  finalWeight: number;
  pricePerCwt: number;
  totalRevenue: number;
  tagNumbers?: string;
  buyer?: string;
  notes?: string;
  operatorEmail: string;
}

// Additional Drizzle table definitions from server/db/schema.ts

// Pens table
export const pens = pgTable("pens", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  operatorEmail: text("operator_email").notNull(),
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
  nutritionistId: text("nutritionist_id"),
  startDate: timestamp("start_date").notNull().defaultNow(),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Weight records table
export const weightRecords = pgTable("weight_records", {
  id: serial("id").primaryKey(),
  penId: integer("pen_id").notNull().references(() => pens.id),
  weight: real("weight").notNull(),
  recordedBy: text("recorded_by").notNull(),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

// Feeding records table
export const feedingRecords = pgTable("feeding_records", {
  id: serial("id").primaryKey(),
  penId: text("pen_id").notNull(),
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

// Feeding plans table
export const feedingPlans = pgTable("feeding_plans", {
  id: serial("id").primaryKey(),
  penId: integer("pen_id").notNull().references(() => pens.id),
  name: text("name").notNull(),
  operatorEmail: text("operator_email").notNull(),
  ingredients: jsonb("ingredients").notNull(),
  totalCostPerTon: real("total_cost_per_ton"),
  proteinContent: real("protein_content"),
  energyContent: real("energy_content"),
  dailyFeedAmount: real("daily_feed_amount"),
  estimatedDailyGain: real("estimated_daily_gain"),
  feedConversionRatio: real("feed_conversion_ratio"),
  createdDate: text("created_date").notNull(),
  lastModified: text("last_modified").notNull(),
  notes: text("notes"),
});

// Cattle sales table
export const cattleSales = pgTable("cattle_sales", {
  id: serial("id").primaryKey(),
  penId: text("pen_id").notNull(),
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

// Death loss table
export const deathLosses = pgTable("death_losses", {
  id: serial("id").primaryKey(),
  penId: text("pen_id").notNull(),
  lossDate: text("loss_date").notNull(),
  reason: text("reason").notNull(),
  cattleCount: integer("cattle_count").notNull(),
  estimatedWeight: real("estimated_weight").notNull(),
  tagNumbers: text("tag_numbers"),
  notes: text("notes"),
  operatorEmail: text("operator_email").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Treatment records table
export const treatmentRecords = pgTable("treatment_records", {
  id: serial("id").primaryKey(),
  penId: text("pen_id").notNull(),
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

// Partial sales table
export const partialSales = pgTable("partial_sales", {
  id: serial("id").primaryKey(),
  penId: text("pen_id").notNull(),
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

// Nutritionists table
export const nutritionists = pgTable("nutritionists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  company: text("company"),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  specialties: jsonb("specialties"),
  operatorEmail: text("operator_email").notNull(),
  status: text("status", { enum: ["active", "inactive", "pending"] }).notNull().default("pending"),
  joinedDate: text("joined_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Invite codes table (for operation invites)
export const inviteCodes = pgTable("invite_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  operatorEmail: text("operator_email").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
  used: boolean("used").default(false),
});

// Session storage table for connect-pg-simple
export const session = pgTable("session", {
  sid: text("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire", { mode: "date" }).notNull(),
});

// Define relations
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

export const pensRelations = relations(pens, ({ many }) => ({
  weightRecords: many(weightRecords),
  feedingPlans: many(feedingPlans),
}));

export const weightRecordsRelations = relations(weightRecords, ({ one }) => ({
  pen: one(pens, {
    fields: [weightRecords.penId],
    references: [pens.id],
  }),
}));

export const feedingPlansRelations = relations(feedingPlans, ({ one }) => ({
  pen: one(pens, {
    fields: [feedingPlans.penId],
    references: [pens.id],
  }),
}));
