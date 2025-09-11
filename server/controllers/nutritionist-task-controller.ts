import { Request, Response } from 'express';
import { getDb } from '../db/connection';
import { nutritionistTasks, pens, users } from '@shared/schema';
import { sql, eq, and, inArray, desc } from 'drizzle-orm';
import { z } from 'zod';

// Validation schemas
const updateTaskSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'dismissed']),
  notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional()
});

const createTaskSchema = z.object({
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional()
});

const taskFiltersSchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  penId: z.string().optional()
});

export class NutritionistTaskController {
  /**
   * GET /api/nutritionist-tasks
   * Retrieves pending and in-progress tasks for the authenticated nutritionist
   */
  static async getTasks(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const filters = taskFiltersSchema.parse(req.query);
      const penId = filters.penId ? Number(filters.penId) : undefined;

      const db = getDb();

      // Build where conditions
      let whereConditions = [eq(nutritionistTasks.nutritionistId, userId)];

      if (filters.status && ['pending', 'in_progress', 'completed', 'dismissed'].includes(filters.status)) {
        whereConditions.push(eq(nutritionistTasks.status, filters.status));
      } else {
        // Default to non-completed tasks
        whereConditions.push(sql`${nutritionistTasks.status} IN ('pending', 'in_progress')`);
      }

      if (filters.priority && ['low', 'normal', 'high', 'urgent'].includes(filters.priority)) {
        whereConditions.push(eq(nutritionistTasks.priority, filters.priority));
      }

      if (penId) {
        whereConditions.push(eq(nutritionistTasks.penId, penId));
      }

      // Get tasks with pen details
      const tasks = await db
        .select({
          id: nutritionistTasks.id,
          penId: nutritionistTasks.penId,
          taskType: nutritionistTasks.taskType,
          status: nutritionistTasks.status,
          priority: nutritionistTasks.priority,
          notes: nutritionistTasks.notes,
          createdAt: nutritionistTasks.createdAt,
          completedAt: nutritionistTasks.completedAt,
          completedByUserId: nutritionistTasks.completedByUserId,
          pen: {
            id: pens.id,
            name: pens.name,
            capacity: pens.capacity,
            current: pens.current,
            cattleType: pens.cattleType,
            startingWeight: pens.startingWeight,
            currentWeight: pens.currentWeight,
            marketWeight: pens.marketWeight,
            daysOnFeed: pens.daysOnFeed
          }
        })
        .from(nutritionistTasks)
        .innerJoin(pens, eq(nutritionistTasks.penId, pens.id))
        .where(and(...whereConditions))
        .orderBy(
          sql`CASE ${nutritionistTasks.priority} 
              WHEN 'urgent' THEN 1 
              WHEN 'high' THEN 2 
              WHEN 'normal' THEN 3 
              WHEN 'low' THEN 4 
              END`,
          desc(nutritionistTasks.createdAt)
        );

      res.json(tasks);
    } catch (error) {
      console.error('Error fetching nutritionist tasks:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * PUT /api/nutritionist-tasks/:taskId
   * Updates task status and notes
   */
  static async updateTaskStatus(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { taskId } = req.params;

      // Validate request body
      const validationResult = updateTaskSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: validationResult.error.issues.map(issue => issue.message).join(', ')
        });
      }

      const { status, notes } = validationResult.data;

      const db = getDb();

      // Check if task exists and belongs to user
      const existingTask = await db
        .select()
        .from(nutritionistTasks)
        .where(and(
          eq(nutritionistTasks.id, taskId),
          eq(nutritionistTasks.nutritionistId, userId)
        ))
        .limit(1);

      if (existingTask.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Prepare update data
      const updateData: any = { status };
      
      if (notes !== undefined) {
        updateData.notes = notes;
      }

      // Set completion timestamp if marking as completed
      if (status === 'completed') {
        updateData.completedAt = new Date();
        updateData.completedByUserId = userId;
      } else {
        // Clear completion data if not completed
        updateData.completedAt = null;
        updateData.completedByUserId = null;
      }

      // Update task
      const updatedTask = await db
        .update(nutritionistTasks)
        .set(updateData)
        .where(eq(nutritionistTasks.id, taskId))
        .returning();

      if (updatedTask.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Fetch complete task with pen details
      const completeTask = await db
        .select({
          id: nutritionistTasks.id,
          penId: nutritionistTasks.penId,
          taskType: nutritionistTasks.taskType,
          status: nutritionistTasks.status,
          priority: nutritionistTasks.priority,
          notes: nutritionistTasks.notes,
          createdAt: nutritionistTasks.createdAt,
          completedAt: nutritionistTasks.completedAt,
          completedByUserId: nutritionistTasks.completedByUserId,
          pen: {
            id: pens.id,
            name: pens.name,
            capacity: pens.capacity,
            current: pens.current,
            cattleType: pens.cattleType
          }
        })
        .from(nutritionistTasks)
        .innerJoin(pens, eq(nutritionistTasks.penId, pens.id))
        .where(eq(nutritionistTasks.id, taskId))
        .limit(1);

      res.json(completeTask[0]);
    } catch (error) {
      console.error('Error updating task status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * POST /api/pens/:penId/request-feeding-programs
   * Manually creates a task for nutritionist to create feeding programs
   */
  static async createTask(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { penId } = req.params;
      const penIdNum = Number(penId);

      if (isNaN(penIdNum)) {
        return res.status(400).json({ error: 'Invalid pen ID' });
      }

      // Validate request body
      const validationResult = createTaskSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: validationResult.error.issues.map(issue => issue.message).join(', ')
        });
      }

      const { priority, notes } = validationResult.data;

      const db = getDb();

      // Verify pen exists and get nutritionist
      const pen = await db
        .select()
        .from(pens)
        .where(eq(pens.id, penIdNum))
        .limit(1);

      if (pen.length === 0) {
        return res.status(404).json({ error: 'Pen not found' });
      }

      if (!pen[0].nutritionistId) {
        return res.status(400).json({ error: 'No nutritionist assigned to this pen' });
      }

      // Check if task already exists for this pen
      const existingTask = await db
        .select()
        .from(nutritionistTasks)
        .where(and(
          eq(nutritionistTasks.penId, penIdNum),
          eq(nutritionistTasks.taskType, 'create_feeding_programs'),
          sql`${nutritionistTasks.status} IN ('pending', 'in_progress')`
        ))
        .limit(1);

      if (existingTask.length > 0) {
        return res.status(409).json({ 
          error: 'Task already exists for this pen',
          existingTask: existingTask[0]
        });
      }

      // Create task
      const newTask = await db
        .insert(nutritionistTasks)
        .values({
          id: crypto.randomUUID(),
          nutritionistId: pen[0].nutritionistId,
          penId: penIdNum,
          taskType: 'create_feeding_programs',
          status: 'pending',
          priority: priority || 'normal',
          notes
        })
        .returning();

      // Fetch complete task with pen details
      const completeTask = await db
        .select({
          id: nutritionistTasks.id,
          penId: nutritionistTasks.penId,
          taskType: nutritionistTasks.taskType,
          status: nutritionistTasks.status,
          priority: nutritionistTasks.priority,
          notes: nutritionistTasks.notes,
          createdAt: nutritionistTasks.createdAt,
          pen: {
            id: pens.id,
            name: pens.name,
            capacity: pens.capacity,
            current: pens.current,
            cattleType: pens.cattleType
          }
        })
        .from(nutritionistTasks)
        .innerJoin(pens, eq(nutritionistTasks.penId, pens.id))
        .where(eq(nutritionistTasks.id, newTask[0].id))
        .limit(1);

      res.status(201).json(completeTask[0]);
    } catch (error) {
      console.error('Error creating task:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Auto-create task when pen is created (webhook/trigger functionality)
   * This would be called when a new pen is created with a nutritionist assigned
   */
  static async onPenCreated(penId: number, nutritionistId: number, priority: string = 'normal') {
    try {
      const db = getDb();

      // Check if task already exists
      const existingTask = await db
        .select()
        .from(nutritionistTasks)
        .where(and(
          eq(nutritionistTasks.penId, penId),
          eq(nutritionistTasks.taskType, 'create_feeding_programs')
        ))
        .limit(1);

      if (existingTask.length > 0) {
        return existingTask[0];
      }

      // Create task
      const newTask = await db
        .insert(nutritionistTasks)
        .values({
          id: crypto.randomUUID(),
          nutritionistId,
          penId,
          taskType: 'create_feeding_programs',
          status: 'pending',
          priority: priority as 'low' | 'normal' | 'high' | 'urgent',
          notes: 'Automatically created when pen was added. Please create feeding programs for this pen.'
        })
        .returning();

      return newTask[0];
    } catch (error) {
      console.error('Error auto-creating task:', error);
      throw error;
    }
  }

  /**
   * GET /api/nutritionist-tasks/summary
   * Gets task summary statistics for dashboard
   */
  static async getTaskSummary(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const db = getDb();

      // Get counts by status
      const taskCounts = await db
        .select({
          status: nutritionistTasks.status,
          priority: nutritionistTasks.priority,
          count: sql<number>`count(*)`
        })
        .from(nutritionistTasks)
        .where(eq(nutritionistTasks.nutritionistId, userId))
        .groupBy(nutritionistTasks.status, nutritionistTasks.priority);

      // Organize the data
      const summary = {
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        dismissed: 0,
        byPriority: {
          urgent: 0,
          high: 0,
          normal: 0,
          low: 0
        },
        activeTasks: 0 // pending + in_progress
      };

      taskCounts.forEach(row => {
        const count = parseInt(row.count.toString());
        summary.total += count;
        
        switch (row.status) {
          case 'pending':
            summary.pending += count;
            summary.activeTasks += count;
            break;
          case 'in_progress':
            summary.inProgress += count;
            summary.activeTasks += count;
            break;
          case 'completed':
            summary.completed += count;
            break;
          case 'dismissed':
            summary.dismissed += count;
            break;
        }

        if (row.status === 'pending' || row.status === 'in_progress') {
          switch (row.priority) {
            case 'urgent':
              summary.byPriority.urgent += count;
              break;
            case 'high':
              summary.byPriority.high += count;
              break;
            case 'normal':
              summary.byPriority.normal += count;
              break;
            case 'low':
              summary.byPriority.low += count;
              break;
          }
        }
      });

      res.json(summary);
    } catch (error) {
      console.error('Error getting task summary:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}