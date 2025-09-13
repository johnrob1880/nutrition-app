import { config } from 'dotenv';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getDb, closeConnection, testConnection } from '../db/connection';
import { sql } from 'drizzle-orm';
import { users, userNotifications, pens, nutritionistTasks } from '@shared/schema';

config({ path: '.env.test' });

const skipIfNotPostgres = process.env.STORAGE_TYPE !== 'postgresql' || !process.env.DATABASE_URL;

describe.skipIf(skipIfNotPostgres)('User Notifications System', () => {
  let db: ReturnType<typeof getDb>;
  let testUserId: number;
  let testProducerId: number;
  let testNutritionistId: number;
  let testOperationId: number;
  let testPenId: number;

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
      await db.execute(sql`DELETE FROM user_notifications WHERE operation_id = ${testOperationId || 99999}`);
      await db.execute(sql`DELETE FROM nutritionist_tasks WHERE pen_id = ${testPenId || 99999}`);
      await db.execute(sql`DELETE FROM pens WHERE id = ${testPenId || 99999}`);
      await db.execute(sql`DELETE FROM operations WHERE id = ${testOperationId || 99999}`);
      await db.execute(sql`DELETE FROM users WHERE id IN (${testUserId || 99999}, ${testProducerId || 99999}, ${testNutritionistId || 99999})`);
    } catch (error) {
      console.warn('Error during cleanup:', error);
    }
  }

  async function setupTestData() {
    // Create test users
    const producerResult = await db.insert(users).values({
      username: 'testproducer',
      email: 'producer@test.com',
      passwordHash: 'hashedpassword',
      userType: 'producer',
      emailVerified: true,
    }).returning({ id: users.id });
    testProducerId = producerResult[0].id;

    const nutritionistResult = await db.insert(users).values({
      username: 'testnutritionist',
      email: 'nutritionist@test.com',
      passwordHash: 'hashedpassword',
      userType: 'consultant',
      emailVerified: true,
    }).returning({ id: users.id });
    testNutritionistId = nutritionistResult[0].id;

    const staffResult = await db.insert(users).values({
      username: 'teststaff',
      email: 'staff@test.com',
      passwordHash: 'hashedpassword',
      userType: 'staff',
      emailVerified: true,
    }).returning({ id: users.id });
    testUserId = staffResult[0].id;

    // Create test operation
    const operationResult = await db.execute(sql`
      INSERT INTO operations (operator_email, operation_name)
      VALUES ('producer@test.com', 'Test Operation')
      RETURNING id
    `);
    testOperationId = operationResult.rows[0].id;

    // Create test pen
    const penResult = await db.insert(pens).values({
      operatorEmail: 'producer@test.com',
      name: 'Test Pen',
      capacity: 100,
      currentOccupancy: 50,
      nutritionistId: testNutritionistId,
    }).returning({ id: pens.id });
    testPenId = penResult[0].id;
  }

  describe('userNotifications table', () => {
    it('should create userNotifications table with correct structure', async () => {
      // Create the userNotifications table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS user_notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          operation_id INTEGER NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL CHECK (type IN ('task_assigned', 'task_completed', 'feeding_program_ready')),
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          related_entity_id UUID,
          related_entity_type VARCHAR(50) CHECK (related_entity_type IN ('pen', 'task', 'feeding_program')),
          is_read BOOLEAN DEFAULT FALSE NOT NULL,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          read_at TIMESTAMP
        )
      `);

      // Create indexes
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_user_notifications_user
        ON user_notifications(user_id, is_read, created_at)
      `);

      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_user_notifications_operation
        ON user_notifications(operation_id, type, created_at)
      `);

      // Verify table exists
      const result = await db.execute(sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'user_notifications'
        ORDER BY ordinal_position
      `);

      expect(result.rows).toBeDefined();
      expect(result.rows.length).toBeGreaterThan(0);

      const columnNames = result.rows.map(row => row.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('user_id');
      expect(columnNames).toContain('operation_id');
      expect(columnNames).toContain('type');
      expect(columnNames).toContain('title');
      expect(columnNames).toContain('message');
      expect(columnNames).toContain('is_read');
      expect(columnNames).toContain('created_at');
    });
  });

  describe('Notification CRUD operations', () => {
    beforeEach(async () => {
      // Ensure table exists
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS user_notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          operation_id INTEGER NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL CHECK (type IN ('task_assigned', 'task_completed', 'feeding_program_ready')),
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          related_entity_id UUID,
          related_entity_type VARCHAR(50) CHECK (related_entity_type IN ('pen', 'task', 'feeding_program')),
          is_read BOOLEAN DEFAULT FALSE NOT NULL,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          read_at TIMESTAMP
        )
      `);
    });

    it('should create a notification for task assignment', async () => {
      // Create a task first
      const taskResult = await db.insert(nutritionistTasks).values({
        userId: testNutritionistId,
        penId: testPenId,
        taskType: 'feeding_program',
        status: 'pending',
        priority: 'normal',
      }).returning({ id: nutritionistTasks.id });

      const taskId = taskResult[0].id;

      // Create notification
      const result = await db.execute(sql`
        INSERT INTO user_notifications (
          user_id,
          operation_id,
          type,
          title,
          message,
          related_entity_id,
          related_entity_type
        ) VALUES (
          ${testNutritionistId},
          ${testOperationId},
          'task_assigned',
          'New Feeding Program Task',
          'You have been assigned to create a feeding program for Test Pen',
          ${taskId}::UUID,
          'task'
        )
        RETURNING *
      `);

      expect(result.rows[0]).toBeDefined();
      expect(result.rows[0].type).toBe('task_assigned');
      expect(result.rows[0].is_read).toBe(false);
      expect(result.rows[0].user_id).toBe(testNutritionistId);
    });

    it('should retrieve unread notifications for a user', async () => {
      // Create multiple notifications
      await db.execute(sql`
        INSERT INTO user_notifications (
          user_id, operation_id, type, title, message
        ) VALUES
        (${testProducerId}, ${testOperationId}, 'feeding_program_ready', 'Program Ready', 'Feeding program is complete'),
        (${testProducerId}, ${testOperationId}, 'task_completed', 'Task Done', 'Nutritionist completed the task')
      `);

      // Mark one as read
      await db.execute(sql`
        UPDATE user_notifications
        SET is_read = true, read_at = NOW()
        WHERE type = 'task_completed' AND user_id = ${testProducerId}
      `);

      // Query unread notifications
      const result = await db.execute(sql`
        SELECT * FROM user_notifications
        WHERE user_id = ${testProducerId} AND is_read = false
        ORDER BY created_at DESC
      `);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].type).toBe('feeding_program_ready');
    });

    it('should mark notification as read', async () => {
      // Create notification
      const insertResult = await db.execute(sql`
        INSERT INTO user_notifications (
          user_id, operation_id, type, title, message
        ) VALUES (
          ${testProducerId}, ${testOperationId}, 'feeding_program_ready',
          'Program Ready', 'Your feeding program is ready'
        )
        RETURNING id
      `);

      const notificationId = insertResult.rows[0].id;

      // Mark as read
      const updateResult = await db.execute(sql`
        UPDATE user_notifications
        SET is_read = true, read_at = NOW()
        WHERE id = ${notificationId}
        RETURNING *
      `);

      expect(updateResult.rows[0].is_read).toBe(true);
      expect(updateResult.rows[0].read_at).toBeDefined();
    });

    it('should delete notifications when user is deleted (cascade)', async () => {
      // Create a new user for deletion test
      const tempUserResult = await db.insert(users).values({
        username: 'tempuser',
        email: 'temp@test.com',
        passwordHash: 'hashedpassword',
        userType: 'producer',
      }).returning({ id: users.id });

      const tempUserId = tempUserResult[0].id;

      // Create notification for temp user
      await db.execute(sql`
        INSERT INTO user_notifications (
          user_id, operation_id, type, title, message
        ) VALUES (
          ${tempUserId}, ${testOperationId}, 'task_assigned',
          'Test', 'Test message'
        )
      `);

      // Verify notification exists
      const beforeDelete = await db.execute(sql`
        SELECT COUNT(*) as count FROM user_notifications WHERE user_id = ${tempUserId}
      `);
      expect(Number(beforeDelete.rows[0].count)).toBe(1);

      // Delete user
      await db.execute(sql`DELETE FROM users WHERE id = ${tempUserId}`);

      // Verify notification is deleted
      const afterDelete = await db.execute(sql`
        SELECT COUNT(*) as count FROM user_notifications WHERE user_id = ${tempUserId}
      `);
      expect(Number(afterDelete.rows[0].count)).toBe(0);
    });
  });

  describe('Atomic pen creation with task assignment', () => {
    it('should create pen and task in atomic transaction', async () => {
      const penName = 'Atomic Test Pen';
      const taskType = 'feeding_program';

      // Start transaction
      await db.execute(sql`BEGIN`);

      try {
        // Create pen
        const penResult = await db.insert(pens).values({
          operatorEmail: 'producer@test.com',
          name: penName,
          capacity: 200,
          currentOccupancy: 100,
          nutritionistId: testNutritionistId,
        }).returning({ id: pens.id });

        const newPenId = penResult[0].id;

        // Create task for nutritionist
        const taskResult = await db.insert(nutritionistTasks).values({
          userId: testNutritionistId,
          penId: newPenId,
          taskType: taskType,
          status: 'pending',
          priority: 'high',
          notes: `Create feeding program for ${penName}`,
        }).returning({ id: nutritionistTasks.id });

        const newTaskId = taskResult[0].id;

        // Create notification for nutritionist
        await db.execute(sql`
          INSERT INTO user_notifications (
            user_id, operation_id, type, title, message,
            related_entity_id, related_entity_type
          ) VALUES (
            ${testNutritionistId}, ${testOperationId}, 'task_assigned',
            'New Feeding Program Task',
            'You have been assigned to create a feeding program for ${penName}',
            ${newTaskId}::UUID, 'task'
          )
        `);

        // Commit transaction
        await db.execute(sql`COMMIT`);

        // Verify pen was created
        const penCheck = await db.execute(sql`
          SELECT * FROM pens WHERE id = ${newPenId}
        `);
        expect(penCheck.rows[0].name).toBe(penName);

        // Verify task was created
        const taskCheck = await db.execute(sql`
          SELECT * FROM nutritionist_tasks WHERE pen_id = ${newPenId}
        `);
        expect(taskCheck.rows[0].task_type).toBe(taskType);

        // Verify notification was created
        const notificationCheck = await db.execute(sql`
          SELECT * FROM user_notifications
          WHERE user_id = ${testNutritionistId}
          AND related_entity_id = ${newTaskId}::UUID
        `);
        expect(notificationCheck.rows[0].type).toBe('task_assigned');

      } catch (error) {
        // Rollback on error
        await db.execute(sql`ROLLBACK`);
        throw error;
      }
    });

    it('should rollback all changes if any part fails', async () => {
      // Start transaction
      await db.execute(sql`BEGIN`);

      let newPenId: number;

      try {
        // Create pen
        const penResult = await db.insert(pens).values({
          operatorEmail: 'producer@test.com',
          name: 'Rollback Test Pen',
          capacity: 200,
          currentOccupancy: 100,
          nutritionistId: testNutritionistId,
        }).returning({ id: pens.id });

        newPenId = penResult[0].id;

        // Try to create task with invalid data (duplicate unique constraint)
        await db.insert(nutritionistTasks).values({
          userId: testNutritionistId,
          penId: testPenId, // Using existing pen to trigger unique constraint
          taskType: 'feeding_program',
          status: 'pending',
        });

        // This should fail due to unique constraint
        await db.insert(nutritionistTasks).values({
          userId: testNutritionistId,
          penId: testPenId, // Same pen and task type - should violate unique constraint
          taskType: 'feeding_program',
          status: 'pending',
        });

        await db.execute(sql`COMMIT`);
      } catch (error) {
        // Rollback on error
        await db.execute(sql`ROLLBACK`);
      }

      // Verify pen was not created (rolled back)
      const penCheck = await db.execute(sql`
        SELECT COUNT(*) as count FROM pens WHERE name = 'Rollback Test Pen'
      `);
      expect(Number(penCheck.rows[0].count)).toBe(0);
    });
  });

  describe('Feeding program completion workflow', () => {
    it('should create notification when feeding program status changes to completed', async () => {
      // Create a feeding program
      const programResult = await db.execute(sql`
        INSERT INTO pen_feeding_programs (
          pen_id, program_name, start_date, end_date,
          status, created_by_user_id
        ) VALUES (
          ${testPenId}, 'Test Program', '2025-01-01', '2025-03-01',
          'in_progress', ${testNutritionistId}
        )
        RETURNING id
      `);

      const programId = programResult.rows[0].id;

      // Update status to completed
      await db.execute(sql`
        UPDATE pen_feeding_programs
        SET status = 'completed'
        WHERE id = ${programId}
      `);

      // Create notification for producer
      await db.execute(sql`
        INSERT INTO user_notifications (
          user_id, operation_id, type, title, message,
          related_entity_id, related_entity_type
        ) VALUES (
          ${testProducerId}, ${testOperationId}, 'feeding_program_ready',
          'Feeding Program Complete',
          'The feeding program for Test Pen is now ready',
          ${programId}::UUID, 'feeding_program'
        )
      `);

      // Verify notification was created
      const notificationCheck = await db.execute(sql`
        SELECT * FROM user_notifications
        WHERE user_id = ${testProducerId}
        AND type = 'feeding_program_ready'
      `);

      expect(notificationCheck.rows[0]).toBeDefined();
      expect(notificationCheck.rows[0].related_entity_type).toBe('feeding_program');
    });
  });
});