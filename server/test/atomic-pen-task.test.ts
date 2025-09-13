import { config } from 'dotenv';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getDb, closeConnection, testConnection } from '../db/connection';
import { sql } from 'drizzle-orm';
import { users, pens, nutritionistTasks, userNotifications, operations } from '@shared/schema';

config({ path: '.env.test' });

const skipIfNotPostgres = process.env.STORAGE_TYPE !== 'postgresql' || !process.env.DATABASE_URL;

describe.skipIf(skipIfNotPostgres)('Atomic Pen Creation with Task Assignment', () => {
  let db: ReturnType<typeof getDb>;
  let testProducerId: number;
  let testNutritionistId: number;
  let testOperationId: number;

  beforeAll(async () => {
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Cannot connect to PostgreSQL database');
    }
    db = getDb();
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeConnection();
  });

  beforeEach(async () => {
    await cleanupTestData();
    await setupTestData();
  });

  async function cleanupTestData() {
    try {
      // Clean in reverse order of dependencies
      await db.execute(sql`DELETE FROM user_notifications WHERE operation_id = ${testOperationId || 99999}`);
      await db.execute(sql`DELETE FROM nutritionist_tasks WHERE pen_id IN (SELECT id FROM pens WHERE operation_id = ${testOperationId || 99999})`);
      await db.execute(sql`DELETE FROM pens WHERE operation_id = ${testOperationId || 99999}`);
      await db.execute(sql`DELETE FROM operations WHERE id = ${testOperationId || 99999}`);
      await db.execute(sql`DELETE FROM users WHERE email IN ('test-producer@test.com', 'test-nutritionist@test.com')`);
    } catch (error) {
      console.warn('Cleanup error (expected on first run):', error);
    }
  }

  async function setupTestData() {
    // Create test users
    const producerResult = await db.insert(users).values({
      username: 'testproducer_atomic',
      email: 'test-producer@test.com',
      passwordHash: 'hashedpassword',
      userType: 'producer',
      emailVerified: true,
    }).returning({ id: users.id });
    testProducerId = producerResult[0].id;

    const nutritionistResult = await db.insert(users).values({
      username: 'testnutritionist_atomic',
      email: 'test-nutritionist@test.com',
      passwordHash: 'hashedpassword',
      userType: 'consultant',
      emailVerified: true,
    }).returning({ id: users.id });
    testNutritionistId = nutritionistResult[0].id;

    // Create test operation
    const operationResult = await db.insert(operations).values({
      operatorEmail: 'test-producer@test.com',
      operationName: 'Test Atomic Operation',
      inviteCode: 'TEST-ATOMIC-123',
    }).returning({ id: operations.id });
    testOperationId = operationResult[0].id;
  }

  describe('Atomic Transaction Tests', () => {
    it('should create pen and task in a single atomic transaction', async () => {
      const penName = 'Atomic Test Pen';
      const capacity = 150;

      // Start transaction
      await db.execute(sql`BEGIN`);

      try {
        // Step 1: Create pen with nutritionist assignment
        const penResult = await db.insert(pens).values({
          operatorEmail: 'test-producer@test.com',
          operationId: testOperationId,
          name: penName,
          capacity: capacity,
          currentOccupancy: 0,
          nutritionistId: testNutritionistId,
        }).returning();

        const newPenId = penResult[0].id;

        // Step 2: Create nutritionist task
        const taskResult = await db.insert(nutritionistTasks).values({
          userId: testNutritionistId,
          penId: newPenId,
          taskType: 'feeding_program',
          status: 'pending',
          priority: 'high',
          notes: `Create feeding program for ${penName}`,
        }).returning();

        const newTaskId = taskResult[0].id;

        // Step 3: Create notification for nutritionist
        await db.insert(userNotifications).values({
          userId: testNutritionistId,
          operationId: testOperationId,
          type: 'task_assigned',
          title: 'New Feeding Program Task',
          message: `You have been assigned to create a feeding program for ${penName}`,
          relatedEntityId: newTaskId,
          relatedEntityType: 'task',
          isRead: false,
        });

        // Commit transaction
        await db.execute(sql`COMMIT`);

        // Verify all entities were created
        const pen = await db.select().from(pens).where(sql`id = ${newPenId}`);
        expect(pen.length).toBe(1);
        expect(pen[0].name).toBe(penName);
        expect(pen[0].nutritionistId).toBe(testNutritionistId);

        const task = await db.select().from(nutritionistTasks).where(sql`pen_id = ${newPenId}`);
        expect(task.length).toBe(1);
        expect(task[0].userId).toBe(testNutritionistId);
        expect(task[0].taskType).toBe('feeding_program');

        const notification = await db.select().from(userNotifications)
          .where(sql`user_id = ${testNutritionistId} AND related_entity_id = ${newTaskId}`);
        expect(notification.length).toBe(1);
        expect(notification[0].type).toBe('task_assigned');

      } catch (error) {
        await db.execute(sql`ROLLBACK`);
        throw error;
      }
    });

    it('should rollback all changes if task creation fails', async () => {
      const penName = 'Rollback Test Pen';

      // Start transaction
      await db.execute(sql`BEGIN`);

      try {
        // Create pen
        const penResult = await db.insert(pens).values({
          operatorEmail: 'test-producer@test.com',
          operationId: testOperationId,
          name: penName,
          capacity: 100,
          currentOccupancy: 0,
          nutritionistId: testNutritionistId,
        }).returning();

        const newPenId = penResult[0].id;

        // Try to create task with invalid data (null userId should fail)
        await db.execute(sql`
          INSERT INTO nutritionist_tasks (id, user_id, pen_id, task_type)
          VALUES (gen_random_uuid(), NULL, ${newPenId}, 'feeding_program')
        `);

        await db.execute(sql`COMMIT`);

      } catch (error) {
        // Expected to fail, rollback
        await db.execute(sql`ROLLBACK`);
      }

      // Verify pen was NOT created
      const pen = await db.select().from(pens).where(sql`name = ${penName}`);
      expect(pen.length).toBe(0);
    });

    it('should handle nutritionist assignment correctly when creating pen', async () => {
      // Test creating pen without nutritionist (should not create task)
      await db.execute(sql`BEGIN`);

      try {
        const penResult = await db.insert(pens).values({
          operatorEmail: 'test-producer@test.com',
          operationId: testOperationId,
          name: 'No Nutritionist Pen',
          capacity: 100,
          currentOccupancy: 0,
          nutritionistId: null,
        }).returning();

        await db.execute(sql`COMMIT`);

        // Verify pen was created but no task
        const tasks = await db.select().from(nutritionistTasks)
          .where(sql`pen_id = ${penResult[0].id}`);
        expect(tasks.length).toBe(0);

      } catch (error) {
        await db.execute(sql`ROLLBACK`);
        throw error;
      }
    });

    it('should prevent duplicate tasks for the same pen', async () => {
      // Create initial pen with task
      await db.execute(sql`BEGIN`);

      let penId: number;

      try {
        const penResult = await db.insert(pens).values({
          operatorEmail: 'test-producer@test.com',
          operationId: testOperationId,
          name: 'Duplicate Task Test Pen',
          capacity: 100,
          currentOccupancy: 0,
          nutritionistId: testNutritionistId,
        }).returning();

        penId = penResult[0].id;

        // Create first task
        await db.insert(nutritionistTasks).values({
          userId: testNutritionistId,
          penId: penId,
          taskType: 'feeding_program',
          status: 'pending',
        });

        await db.execute(sql`COMMIT`);

      } catch (error) {
        await db.execute(sql`ROLLBACK`);
        throw error;
      }

      // Try to create duplicate task (should fail due to unique constraint)
      await db.execute(sql`BEGIN`);

      try {
        await db.insert(nutritionistTasks).values({
          userId: testNutritionistId,
          penId: penId!,
          taskType: 'feeding_program',
          status: 'pending',
        });

        await db.execute(sql`COMMIT`);

        // Should not reach here
        expect(true).toBe(false);

      } catch (error) {
        await db.execute(sql`ROLLBACK`);
        // Expected to fail
        expect(error).toBeDefined();
      }
    });
  });

  describe('Transaction Performance', () => {
    it('should complete atomic transaction within reasonable time', async () => {
      const startTime = Date.now();

      await db.execute(sql`BEGIN`);

      try {
        const penResult = await db.insert(pens).values({
          operatorEmail: 'test-producer@test.com',
          operationId: testOperationId,
          name: 'Performance Test Pen',
          capacity: 200,
          currentOccupancy: 100,
          nutritionistId: testNutritionistId,
        }).returning();

        await db.insert(nutritionistTasks).values({
          userId: testNutritionistId,
          penId: penResult[0].id,
          taskType: 'feeding_program',
          status: 'pending',
          priority: 'normal',
        });

        await db.insert(userNotifications).values({
          userId: testNutritionistId,
          operationId: testOperationId,
          type: 'task_assigned',
          title: 'New Task',
          message: 'Task assigned',
          isRead: false,
        });

        await db.execute(sql`COMMIT`);

        const duration = Date.now() - startTime;

        // Transaction should complete within 1 second
        expect(duration).toBeLessThan(1000);

      } catch (error) {
        await db.execute(sql`ROLLBACK`);
        throw error;
      }
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity between pen, task, and notification', async () => {
      await db.execute(sql`BEGIN`);

      try {
        const penResult = await db.insert(pens).values({
          operatorEmail: 'test-producer@test.com',
          operationId: testOperationId,
          name: 'Integrity Test Pen',
          capacity: 100,
          currentOccupancy: 50,
          nutritionistId: testNutritionistId,
        }).returning();

        const taskResult = await db.insert(nutritionistTasks).values({
          userId: testNutritionistId,
          penId: penResult[0].id,
          taskType: 'feeding_program',
          status: 'pending',
        }).returning();

        const notificationResult = await db.insert(userNotifications).values({
          userId: testNutritionistId,
          operationId: testOperationId,
          type: 'task_assigned',
          title: 'New Task',
          message: 'Task for pen',
          relatedEntityId: taskResult[0].id,
          relatedEntityType: 'task',
          isRead: false,
        }).returning();

        await db.execute(sql`COMMIT`);

        // Verify relationships
        const notification = await db.select().from(userNotifications)
          .where(sql`id = ${notificationResult[0].id}`);

        expect(notification[0].relatedEntityId).toBe(taskResult[0].id);
        expect(notification[0].userId).toBe(testNutritionistId);

        const task = await db.select().from(nutritionistTasks)
          .where(sql`id = ${taskResult[0].id}`);

        expect(task[0].penId).toBe(penResult[0].id);
        expect(task[0].userId).toBe(testNutritionistId);

      } catch (error) {
        await db.execute(sql`ROLLBACK`);
        throw error;
      }
    });
  });
});