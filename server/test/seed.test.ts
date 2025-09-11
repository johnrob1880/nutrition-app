import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { seedDatabase, clearDatabase, generateSeedData } from '../db/seed';
import { getDb, closeConnection } from '../db/connection';
import { operations, pens, feedingRecords, treatmentRecords, deathLosses, staffMembers } from '@shared/schema';
import { count, eq } from 'drizzle-orm';

describe('Database Seeding', () => {
  beforeEach(async () => {
    // Ensure we're using PostgreSQL for these tests
    process.env.STORAGE_TYPE = 'postgresql';
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/cattlerxdb_test';
    }
    
    // Clear the database before each test
    await clearDatabase();
  });

  afterEach(async () => {
    // Clean up after each test
    await clearDatabase();
  });

  describe('generateSeedData', () => {
    test('should generate seed data with proper structure', () => {
      const seedData = generateSeedData();

      // Test operation data
      expect(seedData.operation).toBeDefined();
      expect(seedData.operation.name).toBe('Demo Ranch');
      expect(seedData.operation.operatorEmail).toBe('demo@demoranch.com');
      expect(seedData.operation.firstName).toBe('John');
      expect(seedData.operation.lastName).toBe('Demo');
      expect(seedData.operation.location).toBe('Texas, USA');
      expect(seedData.operation.inviteCode).toMatch(/^DEMO-\d{4}$/);

      // Test staff member data
      expect(seedData.staffMember).toBeDefined();
      expect(seedData.staffMember.email).toBe('manager@demoranch.com');
      expect(seedData.staffMember.firstName).toBe('Sarah');
      expect(seedData.staffMember.lastName).toBe('Johnson');
      expect(seedData.staffMember.role).toBe('staff');
      expect(seedData.staffMember.status).toBe('active');

      // Test pen data
      expect(seedData.pens).toHaveLength(3);
      
      // Test Pen 1 - Premium Angus Steers
      const pen1 = seedData.pens[0];
      expect(pen1.name).toBe('North Pen A');
      expect(pen1.cattleType).toBe('Steers');
      expect(pen1.capacity).toBe(150);
      expect(pen1.current).toBe(125);
      expect(pen1.isCrossbred).toBe(false);
      expect(pen1.startingWeight).toBe(850);
      expect(pen1.feedType).toBe('High Energy Corn-Based');

      // Test Pen 2 - Commercial Heifers
      const pen2 = seedData.pens[1];
      expect(pen2.name).toBe('South Pen B');
      expect(pen2.cattleType).toBe('Heifers');
      expect(pen2.capacity).toBe(120);
      expect(pen2.current).toBe(110);
      expect(pen2.isCrossbred).toBe(true);
      expect(pen2.startingWeight).toBe(750);
      expect(pen2.feedType).toBe('Moderate Energy Mixed Ration');

      // Test Pen 3 - Mixed Group
      const pen3 = seedData.pens[2];
      expect(pen3.name).toBe('East Pen C');
      expect(pen3.cattleType).toBe('Mixed');
      expect(pen3.capacity).toBe(100);
      expect(pen3.current).toBe(85);
      expect(pen3.isCrossbred).toBe(true);
      expect(pen3.startingWeight).toBe(700);
      expect(pen3.feedType).toBe('Custom Finishing Ration');

      // Test feeding records (30 days)
      expect(seedData.feedingRecords).toHaveLength(90); // 3 pens × 30 days
      
      // Test treatment records
      expect(seedData.treatments).toHaveLength(6);
      const treatment1 = seedData.treatments[0];
      expect(treatment1.treatmentType).toBe('Vaccination');
      expect(treatment1.product).toBe('BOVI-SHIELD Gold FP5 L5');
      
      // Test death loss records
      expect(seedData.deathLosses).toHaveLength(2);
      const deathLoss1 = seedData.deathLosses[0];
      expect(deathLoss1.reason).toBe('Respiratory illness');
      expect(deathLoss1.cattleCount).toBe(1);
    });

    test('should generate unique pen IDs', () => {
      const seedData = generateSeedData();
      const penIds = seedData.pens.map(pen => pen.id);
      const uniqueIds = [...new Set(penIds)];
      expect(uniqueIds).toHaveLength(penIds.length);
    });

    test('should generate feeding records for all pens across 30 days', () => {
      const seedData = generateSeedData();
      const penIds = seedData.pens.map(pen => pen.id);
      
      // Check that each pen has 30 feeding records
      for (const penId of penIds) {
        const penRecords = seedData.feedingRecords.filter(record => record.penId === penId);
        expect(penRecords).toHaveLength(30);
      }
    });

    test('should generate historical data with proper dates', () => {
      const seedData = generateSeedData();
      
      // Check that feeding records span 30 days
      const dates = seedData.feedingRecords.map(record => new Date(record.feedingDate));
      const uniqueDates = [...new Set(dates.map(d => d.toISOString().split('T')[0]))];
      expect(uniqueDates).toHaveLength(30);
      
      // Check that the most recent date is today or yesterday
      const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      expect(maxDate >= yesterday).toBe(true);
    });
  });

  describe('seedDatabase', () => {
    test('should seed database with all data successfully', async () => {
      // Skip if no database URL is configured
      if (!process.env.DATABASE_URL) {
        return;
      }

      const result = await seedDatabase();
      expect(result.success).toBe(true);
      expect(result.operation).toBeDefined();
      expect(result.staffMember).toBeDefined();
      expect(result.pens).toHaveLength(3);
      expect(result.feedingRecords).toHaveLength(90);
      expect(result.treatments).toHaveLength(6);
      expect(result.deathLosses).toHaveLength(2);
    });

    test('should handle duplicate seeding gracefully', async () => {
      // Skip if no database URL is configured
      if (!process.env.DATABASE_URL) {
        return;
      }

      // Seed once
      const firstResult = await seedDatabase();
      expect(firstResult.success).toBe(true);

      // Seed again - should not create duplicates
      const secondResult = await seedDatabase();
      expect(secondResult.success).toBe(true);

      // Check that only one operation exists
      const db = getDb();
      const operationCount = await db.select({ count: count() }).from(operations);
      expect(operationCount[0].count).toBe(1);
    });

    test('should validate seeded data integrity', async () => {
      // Skip if no database URL is configured
      if (!process.env.DATABASE_URL) {
        return;
      }

      await seedDatabase();
      const db = getDb();

      // Check operation exists
      const operationRecords = await db.select().from(operations);
      expect(operationRecords).toHaveLength(1);
      expect(operationRecords[0].name).toBe('Demo Ranch');

      // Check pens exist
      const penRecords = await db.select().from(pens);
      expect(penRecords).toHaveLength(3);

      // Check feeding records exist
      const feedingRecordsCount = await db.select({ count: count() }).from(feedingRecords);
      expect(feedingRecordsCount[0].count).toBe(90);

      // Check treatments exist
      const treatmentRecordsCount = await db.select({ count: count() }).from(treatmentRecords);
      expect(treatmentRecordsCount[0].count).toBe(6);

      // Check death losses exist
      const deathLossCount = await db.select({ count: count() }).from(deathLosses);
      expect(deathLossCount[0].count).toBe(2);

      // Check staff member exists
      const staffCount = await db.select({ count: count() }).from(staffMembers);
      expect(staffCount[0].count).toBe(1);
    });
  });

  describe('clearDatabase', () => {
    test('should clear all seeded data', async () => {
      // Skip if no database URL is configured
      if (!process.env.DATABASE_URL) {
        return;
      }

      // First seed the database
      await seedDatabase();
      
      // Verify data exists
      const db = getDb();
      const operationsBefore = await db.select({ count: count() }).from(operations);
      expect(operationsBefore[0].count).toBe(1);

      // Clear the database
      await clearDatabase();

      // Verify all data is cleared
      const operationsAfter = await db.select({ count: count() }).from(operations);
      const pensAfter = await db.select({ count: count() }).from(pens);
      const feedingRecordsAfter = await db.select({ count: count() }).from(feedingRecords);
      const treatmentsAfter = await db.select({ count: count() }).from(treatmentRecords);
      const deathLossesAfter = await db.select({ count: count() }).from(deathLosses);
      const staffAfter = await db.select({ count: count() }).from(staffMembers);

      expect(operationsAfter[0].count).toBe(0);
      expect(pensAfter[0].count).toBe(0);
      expect(feedingRecordsAfter[0].count).toBe(0);
      expect(treatmentsAfter[0].count).toBe(0);
      expect(deathLossesAfter[0].count).toBe(0);
      expect(staffAfter[0].count).toBe(0);
    });
  });

  // Cleanup connections after all tests
  afterAll(async () => {
    await closeConnection();
  });
});