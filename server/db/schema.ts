import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Operations table
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

// Staff members table
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

// Staff invitation tokens
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
  penId: text("pen_id").notNull(), // Using text to match existing interface
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