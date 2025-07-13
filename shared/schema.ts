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

export interface FeedingSchedule {
  id: string;
  penId: string;
  penName: string;
  time: string;
  totalAmount: string;
  feedType: string;
  status: 'Active' | 'Inactive';
  ingredients: FeedIngredient[];
  totalNutrition: {
    protein: string;
    fat: string;
    fiber: string;
    moisture: string;
  };
  lastUpdated: string;
  operatorEmail: string;
}

export interface DashboardStats {
  totalPens: number;
  totalCattle: number;
  activeSchedules: number;
  avgFeedPerDay: string;
  lastSync: string;
}
