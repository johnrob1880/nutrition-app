import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const operations = pgTable("operations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  operatorEmail: text("operator_email").notNull().unique(),
  location: text("location").notNull(),
  setupDate: timestamp("setup_date").notNull().defaultNow(),
});

export const insertOperationSchema = createInsertSchema(operations).omit({
  id: true,
  setupDate: true,
});

export type InsertOperation = z.infer<typeof insertOperationSchema>;
export type Operation = typeof operations.$inferSelect;

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
