import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
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

export const operations = pgTable("operations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  operatorEmail: text("operator_email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  location: text("location").notNull(),
  inviteCode: text("invite_code").notNull(),
  setupDate: timestamp("setup_date").notNull().defaultNow(),
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
  operationId: integer("operation_id").notNull(),
  email: text("email").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role", { enum: ["owner", "staff"] }).notNull().default("staff"),
  status: text("status", { enum: ["invited", "active"] }).notNull().default("invited"),
  invitedAt: timestamp("invited_at").notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  invitedBy: text("invited_by").notNull(), // Email of who sent the invitation
});

// Staff invitation tokens for secure email verification
export const staffInvitations = pgTable("staff_invitations", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  operationId: integer("operation_id").notNull(),
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
  operationId: number;
  penId: string;
  scheduleId: string;
  plannedAmount: string;
  actualIngredients: ActualIngredient[];
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
  personalName: string;
  businessName: string;
  operatorEmail: string;
  status: 'Invited' | 'Active';
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
  tagNumbers?: string;
  buyer?: string;
  notes?: string;
  operatorEmail: string;
}
