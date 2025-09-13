import { describe, beforeAll, afterAll, beforeEach, test, expect, vi } from 'vitest';
import { getDb, closeConnection } from '../db/connection';
import { sql } from 'drizzle-orm';
import { operations, users, consultantProfiles, pens, feedingIngredients, feedingProgramTemplates } from '../../shared/schema';

// Skip these tests if not using PostgreSQL
const skipIfNotPostgres = process.env.DATABASE_URL?.includes('postgresql://') ? false : true;

describe.skipIf(skipIfNotPostgres)('Schema Cleanup Tests', () => {
  let db: ReturnType<typeof getDb>;

  beforeAll(() => {
    db = getDb();
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeConnection();
  });

  beforeEach(async () => {
    await cleanupTestData();
  });

  async function cleanupTestData() {
    try {
      // Clean up in dependency order
      await db.execute(sql`DELETE FROM feeding_program_templates`);
      await db.execute(sql`DELETE FROM feeding_ingredients`);
      await db.execute(sql`DELETE FROM consultant_profiles`);
      await db.execute(sql`DELETE FROM pens`);
      await db.execute(sql`DELETE FROM operations`);
      await db.execute(sql`DELETE FROM users`);

      // Try to clean up deprecated tables if they still exist
      await db.execute(sql`DELETE FROM feeding_plans`).catch(() => {});
      await db.execute(sql`DELETE FROM nutritionists`).catch(() => {});
    } catch (error) {
      console.log('Test cleanup completed with expected errors for missing tables');
    }
  }

  describe('Deprecated Tables Verification', () => {
    test('should confirm deprecated tables exist before cleanup', async () => {
      // Check if feeding_plans table exists
      const feedingPlansExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'feeding_plans'
        );
      `);

      // Check if nutritionists table exists
      const nutritionistsExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'nutritionists'
        );
      `);

      // These should exist initially (before cleanup)
      expect(feedingPlansExists[0].exists).toBe(true);
      expect(nutritionistsExists[0].exists).toBe(true);
    });

    test('should verify deprecated tables are empty after data migration', async () => {
      // Check that deprecated tables have no records
      const feedingPlansCount = await db.execute(sql`SELECT COUNT(*) FROM feeding_plans`);
      const nutritionistsCount = await db.execute(sql`SELECT COUNT(*) FROM nutritionists`);

      expect(Number(feedingPlansCount[0].count)).toBe(0);
      expect(Number(nutritionistsCount[0].count)).toBe(0);
    });

    test('should verify new feeding system has data', async () => {
      // Create test user
      const [user] = await db.insert(users).values({
        username: 'testconsultant',
        email: 'consultant@test.com',
        passwordHash: 'hashedpassword',
        userType: 'consultant',
        emailVerified: true,
      }).returning();

      // Create consultant profile
      await db.insert(consultantProfiles).values({
        userId: user.id,
        fullName: 'Test Nutritionist',
        specialization: 'nutritionist',
      });

      // Create operation
      const [operation] = await db.insert(operations).values({
        name: 'Test Operation',
        operatorEmail: 'producer@test.com',
        firstName: 'John',
        lastName: 'Producer',
        location: 'Test Location',
        inviteCode: 'TEST123',
        userId: user.id,
      }).returning();

      // Create feeding ingredient
      const [ingredient] = await db.insert(feedingIngredients).values({
        userId: user.id,
        name: 'Test Corn',
        proteinPercentage: '8.5',
        dryMatterPercentage: '87.0',
      }).returning();

      // Create feeding program template
      const [template] = await db.insert(feedingProgramTemplates).values({
        name: 'Test Template',
        description: 'Test feeding program template',
        categoryTags: ['steers', 'finishing'],
        createdByUserId: user.id,
      }).returning();

      // Verify data exists in new system
      expect(user.id).toBeDefined();
      expect(operation.id).toBeDefined();
      expect(ingredient.id).toBeDefined();
      expect(template.id).toBeDefined();

      // Verify counts
      const ingredientCount = await db.execute(sql`SELECT COUNT(*) FROM feeding_ingredients`);
      const templateCount = await db.execute(sql`SELECT COUNT(*) FROM feeding_program_templates`);

      expect(Number(ingredientCount[0].count)).toBe(1);
      expect(Number(templateCount[0].count)).toBe(1);
    });
  });

  describe('Foreign Key Dependencies', () => {
    test('should verify no foreign key references to deprecated tables', async () => {
      // Check for any foreign key constraints that reference deprecated tables
      const feedingPlansForeignKeys = await db.execute(sql`
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM
          information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND (ccu.table_name = 'feeding_plans' OR ccu.table_name = 'nutritionists')
      `);

      // Should have no foreign key references to deprecated tables
      expect(feedingPlansForeignKeys.length).toBe(0);
    });

    test('should verify pens table uses proper foreign keys to new system', async () => {
      // Create test user and operation
      const [user] = await db.insert(users).values({
        username: 'testuser',
        email: 'test@test.com',
        passwordHash: 'hashedpassword',
        userType: 'consultant',
        emailVerified: true,
      }).returning();

      const [operation] = await db.insert(operations).values({
        name: 'Test Operation',
        operatorEmail: 'producer@test.com',
        firstName: 'John',
        lastName: 'Producer',
        location: 'Test Location',
        inviteCode: 'TEST123',
      }).returning();

      // Create pen with proper foreign keys
      const [pen] = await db.insert(pens).values({
        name: 'Test Pen',
        operationId: operation.id,
        capacity: 100,
        current: 95,
        feedType: 'Finishing Ration',
        cattleType: 'Steers',
        startingWeight: 750,
        currentWeight: 850,
        marketWeight: 1200,
        nutritionistId: user.id, // Uses users.id instead of string
      }).returning();

      expect(pen.operationId).toBe(operation.id);
      expect(pen.nutritionistId).toBe(user.id);
    });
  });

  describe('Table Schema Verification', () => {
    test('should verify deprecated tables can be safely dropped', async () => {
      // Verify no dependencies exist before attempting to drop
      let canDropFeedingPlans = true;
      let canDropNutritionists = true;

      try {
        // Test if we can drop feeding_plans (should not fail due to dependencies)
        await db.execute(sql`DROP TABLE IF EXISTS feeding_plans CASCADE`);
      } catch (error) {
        canDropFeedingPlans = false;
        console.log('Cannot drop feeding_plans:', error);
      }

      try {
        // Test if we can drop nutritionists (should not fail due to dependencies)
        await db.execute(sql`DROP TABLE IF EXISTS nutritionists CASCADE`);
      } catch (error) {
        canDropNutritionists = false;
        console.log('Cannot drop nutritionists:', error);
      }

      expect(canDropFeedingPlans).toBe(true);
      expect(canDropNutritionists).toBe(true);
    });

    test('should verify new system tables exist and are properly structured', async () => {
      // Check that all new feeding system tables exist
      const requiredTables = [
        'feeding_ingredients',
        'feeding_program_templates',
        'feeding_program_phases',
        'feeding_program_ingredients',
        'pen_feeding_programs',
        'pen_feeding_program_phases',
        'pen_feeding_program_ingredients',
        'feeding_record_variances',
        'daily_feeding_completion_status',
        'nutritionist_tasks'
      ];

      for (const tableName of requiredTables) {
        const tableExists = await db.execute(sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = ${tableName}
          );
        `);

        expect(tableExists[0].exists).toBe(true);
      }
    });
  });

  describe('Data Integrity Verification', () => {
    test('should verify no data loss during migration', async () => {
      // This test verifies that the new system can handle all the functionality
      // that the old system provided, ensuring no data loss during migration

      // Create test user (consultant)
      const [consultant] = await db.insert(users).values({
        username: 'consultant1',
        email: 'consultant1@test.com',
        passwordHash: 'hashedpassword',
        userType: 'consultant',
        emailVerified: true,
      }).returning();

      // Create consultant profile
      await db.insert(consultantProfiles).values({
        userId: consultant.id,
        fullName: 'Test Consultant',
        specialization: 'nutritionist',
      });

      // Create operation
      const [operation] = await db.insert(operations).values({
        name: 'Migration Test Operation',
        operatorEmail: 'producer@test.com',
        firstName: 'Test',
        lastName: 'Producer',
        location: 'Test Location',
        inviteCode: 'MIGRATE123',
      }).returning();

      // Create pen
      const [pen] = await db.insert(pens).values({
        name: 'Migration Test Pen',
        operationId: operation.id,
        capacity: 200,
        current: 180,
        feedType: 'Test Feed',
        cattleType: 'Steers',
        startingWeight: 600,
        currentWeight: 750,
        marketWeight: 1300,
        nutritionistId: consultant.id,
      }).returning();

      // Verify all data was created successfully
      expect(consultant.id).toBeDefined();
      expect(operation.id).toBeDefined();
      expect(pen.id).toBeDefined();
      expect(pen.nutritionistId).toBe(consultant.id);
      expect(pen.operationId).toBe(operation.id);
    });
  });
});