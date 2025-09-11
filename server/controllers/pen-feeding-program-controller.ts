import { Request, Response } from 'express';
import { getDb } from '../db/connection';
import { 
  penFeedingPrograms,
  penFeedingProgramPhases,
  penFeedingProgramIngredients,
  feedingProgramTemplates,
  feedingProgramPhases,
  feedingProgramIngredients,
  feedingIngredients,
  pens,
  feedingRecordVariances,
  dailyFeedingCompletionStatus
} from '@shared/schema';
import { sql, eq, and, inArray, desc, asc } from 'drizzle-orm';
import { z } from 'zod';

// Validation schemas
const phaseIngredientSchema = z.object({
  ingredientId: z.string().uuid('Invalid ingredient ID'),
  percentageOfRation: z.number()
    .min(0, 'Percentage must be non-negative')
    .max(100, 'Percentage cannot exceed 100%')
});

const customPhaseSchema = z.object({
  templatePhaseId: z.string().uuid().optional(),
  phaseName: z.string().min(1, 'Phase name is required'),
  phaseOrder: z.number().int().positive('Phase order must be a positive integer'),
  durationDays: z.number().int().positive('Duration must be a positive integer'),
  targetMcalPerRation: z.number().positive('Target Mcal must be positive').optional(),
  ingredients: z.array(phaseIngredientSchema).min(1, 'At least one ingredient is required')
});

const assignProgramSchema = z.object({
  templateId: z.string().uuid().optional(),
  programName: z.string().min(1, 'Program name is required'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  feedingTimes: z.array(z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)'))
    .min(1, 'At least one feeding time is required'),
  phases: z.array(customPhaseSchema).min(1, 'At least one phase is required').optional()
});

const updateProgramSchema = z.object({
  programName: z.string().min(1).optional(),
  currentPhase: z.number().int().positive().optional(),
  status: z.enum(['active', 'paused', 'completed']).optional(),
  feedingTimes: z.array(z.string().regex(/^\d{2}:\d{2}$/)).optional()
});

const varianceRecordSchema = z.object({
  ingredientId: z.string().uuid(),
  plannedAmount: z.number().positive('Planned amount must be positive'),
  actualAmount: z.number().min(0, 'Actual amount must be non-negative')
});

const recordVariancesSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  feedingTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  variances: z.array(varianceRecordSchema).min(1, 'At least one variance is required')
});

const markCompletionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  feedingTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format')
});

export class PenFeedingProgramController {
  /**
   * GET /api/pens/:penId/feeding-programs
   * Retrieves feeding programs assigned to a specific pen
   */
  static async getPenPrograms(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { penId } = req.params;
      const { status } = req.query;

      const penIdNum = Number(penId);
      if (isNaN(penIdNum)) {
        return res.status(400).json({ error: 'Invalid pen ID' });
      }

      const db = getDb();

      // Verify pen access (user must be the nutritionist for the pen)
      const pen = await db
        .select()
        .from(pens)
        .where(eq(pens.id, penIdNum))
        .limit(1);

      if (pen.length === 0) {
        return res.status(404).json({ error: 'Pen not found' });
      }

      if (pen[0].nutritionistId !== userId) {
        return res.status(403).json({ error: 'Access denied: you are not the nutritionist for this pen' });
      }

      // Build query
      let whereConditions = [eq(penFeedingPrograms.penId, penIdNum)];
      if (status && ['active', 'paused', 'completed'].includes(status as string)) {
        whereConditions.push(eq(penFeedingPrograms.status, status as string));
      }

      const programs = await db
        .select()
        .from(penFeedingPrograms)
        .where(and(...whereConditions))
        .orderBy(desc(penFeedingPrograms.createdAt));

      // Get phases and ingredients for each program
      const programsWithDetails = await Promise.all(
        programs.map(async (program) => {
          const phases = await db
            .select()
            .from(penFeedingProgramPhases)
            .where(eq(penFeedingProgramPhases.penProgramId, program.id))
            .orderBy(asc(penFeedingProgramPhases.phaseOrder));

          const phasesWithIngredients = await Promise.all(
            phases.map(async (phase) => {
              const phaseIngredients = await db
                .select({
                  id: penFeedingProgramIngredients.id,
                  ingredientId: penFeedingProgramIngredients.ingredientId,
                  percentageOfRation: penFeedingProgramIngredients.percentageOfRation,
                  ingredientName: feedingIngredients.name,
                  proteinPercentage: feedingIngredients.proteinPercentage,
                  dryMatterPercentage: feedingIngredients.dryMatterPercentage
                })
                .from(penFeedingProgramIngredients)
                .innerJoin(feedingIngredients, eq(penFeedingProgramIngredients.ingredientId, feedingIngredients.id))
                .where(eq(penFeedingProgramIngredients.penPhaseId, phase.id));

              return {
                ...phase,
                ingredients: phaseIngredients
              };
            })
          );

          return {
            ...program,
            phases: phasesWithIngredients
          };
        })
      );

      res.json(programsWithDetails);
    } catch (error) {
      console.error('Error fetching pen programs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * POST /api/pens/:penId/feeding-programs
   * Assigns and customizes a feeding program template to a pen
   */
  static async assignProgram(req: Request, res: Response) {
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
      const validationResult = assignProgramSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: validationResult.error.issues.map(issue => 
            `${issue.path.join('.')}: ${issue.message}`
          ).join(', ')
        });
      }

      const { templateId, programName, startDate, endDate, feedingTimes, phases } = validationResult.data;

      const db = getDb();

      // Verify pen access
      const pen = await db
        .select()
        .from(pens)
        .where(eq(pens.id, penIdNum))
        .limit(1);

      if (pen.length === 0) {
        return res.status(404).json({ error: 'Pen not found' });
      }

      if (pen[0].nutritionistId !== userId) {
        return res.status(403).json({ error: 'Access denied: you are not the nutritionist for this pen' });
      }

      // Validate date range
      if (new Date(startDate) >= new Date(endDate)) {
        return res.status(400).json({ error: 'End date must be after start date' });
      }

      let templateData = null;
      let phasesToCreate = phases || [];

      // If template ID is provided, fetch template data
      if (templateId) {
        const template = await db
          .select()
          .from(feedingProgramTemplates)
          .where(eq(feedingProgramTemplates.id, templateId))
          .limit(1);

        if (template.length === 0) {
          return res.status(404).json({ error: 'Template not found' });
        }

        templateData = template[0];

        // If no custom phases provided, use template phases
        if (!phases || phases.length === 0) {
          const templatePhases = await db
            .select()
            .from(feedingProgramPhases)
            .where(eq(feedingProgramPhases.templateId, templateId))
            .orderBy(asc(feedingProgramPhases.phaseOrder));

          for (const templatePhase of templatePhases) {
            const templateIngredients = await db
              .select()
              .from(feedingProgramIngredients)
              .where(eq(feedingProgramIngredients.phaseId, templatePhase.id));

            phasesToCreate.push({
              templatePhaseId: templatePhase.id,
              phaseName: templatePhase.phaseName,
              phaseOrder: templatePhase.phaseOrder,
              durationDays: templatePhase.durationDays,
              targetMcalPerRation: templatePhase.targetMcalPerRation ? parseFloat(templatePhase.targetMcalPerRation) : undefined,
              ingredients: templateIngredients.map(ing => ({
                ingredientId: ing.ingredientId,
                percentageOfRation: parseFloat(ing.percentageOfRation)
              }))
            });
          }
        }
      }

      // Validate phases
      if (phasesToCreate.length === 0) {
        return res.status(400).json({ error: 'No phases provided for the feeding program' });
      }

      // Validate phase order is sequential
      const sortedPhases = [...phasesToCreate].sort((a, b) => a.phaseOrder - b.phaseOrder);
      for (let i = 0; i < sortedPhases.length; i++) {
        if (sortedPhases[i].phaseOrder !== i + 1) {
          return res.status(400).json({
            error: 'Phase orders must be sequential starting from 1'
          });
        }
      }

      // Create pen feeding program
      const programId = crypto.randomUUID();
      
      const newProgram = await db
        .insert(penFeedingPrograms)
        .values({
          id: programId,
          penId: penIdNum,
          templateId,
          programName,
          startDate,
          endDate,
          feedingTimes,
          currentPhase: 1,
          status: 'active',
          createdByUserId: userId
        })
        .returning();

      // Create phases
      for (const phase of phasesToCreate) {
        const phaseId = crypto.randomUUID();
        
        await db
          .insert(penFeedingProgramPhases)
          .values({
            id: phaseId,
            penProgramId: programId,
            templatePhaseId: phase.templatePhaseId,
            phaseName: phase.phaseName,
            phaseOrder: phase.phaseOrder,
            durationDays: phase.durationDays,
            targetMcalPerRation: phase.targetMcalPerRation?.toString()
          });

        // Create phase ingredients
        for (const ingredient of phase.ingredients) {
          await db
            .insert(penFeedingProgramIngredients)
            .values({
              id: crypto.randomUUID(),
              penPhaseId: phaseId,
              ingredientId: ingredient.ingredientId,
              percentageOfRation: ingredient.percentageOfRation.toString()
            });
        }
      }

      // Fetch the complete program
      const completeProgram = await PenFeedingProgramController.getProgramById(programId);
      
      res.status(201).json(completeProgram);
    } catch (error) {
      console.error('Error assigning program:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * PUT /api/pen-feeding-programs/:programId
   * Updates pen feeding program
   */
  static async updateProgram(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { programId } = req.params;

      const validationResult = updateProgramSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: validationResult.error.issues.map(issue => issue.message).join(', ')
        });
      }

      const db = getDb();

      // Verify program exists and user has access
      const program = await db
        .select()
        .from(penFeedingPrograms)
        .innerJoin(pens, eq(penFeedingPrograms.penId, pens.id))
        .where(eq(penFeedingPrograms.id, programId))
        .limit(1);

      if (program.length === 0) {
        return res.status(404).json({ error: 'Program not found' });
      }

      if (program[0].pens.nutritionistId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updates = validationResult.data;
      const updateData: any = { updatedAt: new Date() };

      if (updates.programName) updateData.programName = updates.programName;
      if (updates.currentPhase) updateData.currentPhase = updates.currentPhase;
      if (updates.status) updateData.status = updates.status;
      if (updates.feedingTimes) updateData.feedingTimes = updates.feedingTimes;

      await db
        .update(penFeedingPrograms)
        .set(updateData)
        .where(eq(penFeedingPrograms.id, programId));

      const updatedProgram = await PenFeedingProgramController.getProgramById(programId);
      res.json(updatedProgram);
    } catch (error) {
      console.error('Error updating program:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * POST /api/pen-feeding-programs/:programId/variances
   * Records feeding variances for ingredients that differ from plan
   */
  static async recordVariances(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { programId } = req.params;

      const validationResult = recordVariancesSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: validationResult.error.issues.map(issue => issue.message).join(', ')
        });
      }

      const { date, feedingTime, variances } = validationResult.data;

      const db = getDb();

      // Verify program exists and user has access
      const program = await db
        .select()
        .from(penFeedingPrograms)
        .innerJoin(pens, eq(penFeedingPrograms.penId, pens.id))
        .where(eq(penFeedingPrograms.id, programId))
        .limit(1);

      if (program.length === 0) {
        return res.status(404).json({ error: 'Program not found' });
      }

      // Allow the nutritionist or any user with pen access to record variances
      // In practice, this would be used by the producer/staff recording actual feeding

      const createdVariances = [];

      for (const variance of variances) {
        const varianceAmount = variance.actualAmount - variance.plannedAmount;
        const variancePercentage = variance.plannedAmount > 0 
          ? (varianceAmount / variance.plannedAmount) * 100 
          : 0;

        // Only record variances that are significantly different (more than 1% or 0.1 units)
        if (Math.abs(varianceAmount) > 0.1 && Math.abs(variancePercentage) > 1) {
          const newVariance = await db
            .insert(feedingRecordVariances)
            .values({
              id: crypto.randomUUID(),
              penProgramId: programId,
              penId: program[0].pen_feeding_programs.penId,
              ingredientId: variance.ingredientId,
              recordedByUserId: userId,
              date,
              feedingTime,
              plannedAmount: variance.plannedAmount.toString(),
              actualAmount: variance.actualAmount.toString(),
              varianceAmount: varianceAmount.toString(),
              variancePercentage: variancePercentage.toString()
            })
            .returning();

          createdVariances.push(newVariance[0]);
        }
      }

      res.status(201).json({
        success: true,
        recordedVariances: createdVariances.length,
        variances: createdVariances
      });
    } catch (error) {
      console.error('Error recording variances:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * POST /api/pen-feeding-programs/:programId/completion
   * Marks a scheduled feeding as completed
   */
  static async markCompletion(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { programId } = req.params;

      const validationResult = markCompletionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: validationResult.error.issues.map(issue => issue.message).join(', ')
        });
      }

      const { date, feedingTime } = validationResult.data;

      const db = getDb();

      // Check if already marked complete
      const existing = await db
        .select()
        .from(dailyFeedingCompletionStatus)
        .where(and(
          eq(dailyFeedingCompletionStatus.penProgramId, programId),
          eq(dailyFeedingCompletionStatus.date, date),
          eq(dailyFeedingCompletionStatus.feedingTime, feedingTime)
        ))
        .limit(1);

      if (existing.length > 0) {
        return res.status(409).json({ error: 'Feeding already marked as completed' });
      }

      // Create completion record
      const completion = await db
        .insert(dailyFeedingCompletionStatus)
        .values({
          id: crypto.randomUUID(),
          penProgramId: programId,
          completedByUserId: userId,
          date,
          feedingTime
        })
        .returning();

      res.status(201).json(completion[0]);
    } catch (error) {
      console.error('Error marking completion:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * GET /api/pen-feeding-programs/:programId/variances
   * Retrieves recorded variances for a pen feeding program
   */
  static async getVariances(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { programId } = req.params;
      const { startDate, endDate } = req.query;

      const db = getDb();

      let whereConditions = [eq(feedingRecordVariances.penProgramId, programId)];
      
      if (startDate) {
        whereConditions.push(sql`${feedingRecordVariances.date} >= ${startDate}`);
      }
      if (endDate) {
        whereConditions.push(sql`${feedingRecordVariances.date} <= ${endDate}`);
      }

      const variances = await db
        .select({
          id: feedingRecordVariances.id,
          date: feedingRecordVariances.date,
          feedingTime: feedingRecordVariances.feedingTime,
          plannedAmount: feedingRecordVariances.plannedAmount,
          actualAmount: feedingRecordVariances.actualAmount,
          varianceAmount: feedingRecordVariances.varianceAmount,
          variancePercentage: feedingRecordVariances.variancePercentage,
          createdAt: feedingRecordVariances.createdAt,
          ingredientName: feedingIngredients.name,
          recordedBy: {
            id: sql`users.id`,
            email: sql`users.email`
          }
        })
        .from(feedingRecordVariances)
        .innerJoin(feedingIngredients, eq(feedingRecordVariances.ingredientId, feedingIngredients.id))
        .innerJoin(sql`users`, sql`feeding_record_variances.recorded_by_user_id = users.id`)
        .where(and(...whereConditions))
        .orderBy(desc(feedingRecordVariances.date), asc(feedingRecordVariances.feedingTime));

      res.json(variances);
    } catch (error) {
      console.error('Error fetching variances:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Helper method to get complete program by ID
   */
  private static async getProgramById(programId: string) {
    const db = getDb();
    
    const program = await db
      .select()
      .from(penFeedingPrograms)
      .where(eq(penFeedingPrograms.id, programId))
      .limit(1);

    if (program.length === 0) {
      return null;
    }

    const phases = await db
      .select()
      .from(penFeedingProgramPhases)
      .where(eq(penFeedingProgramPhases.penProgramId, programId))
      .orderBy(asc(penFeedingProgramPhases.phaseOrder));

    const phasesWithIngredients = await Promise.all(
      phases.map(async (phase) => {
        const phaseIngredients = await db
          .select({
            id: penFeedingProgramIngredients.id,
            ingredientId: penFeedingProgramIngredients.ingredientId,
            percentageOfRation: penFeedingProgramIngredients.percentageOfRation,
            ingredientName: feedingIngredients.name,
            proteinPercentage: feedingIngredients.proteinPercentage,
            dryMatterPercentage: feedingIngredients.dryMatterPercentage
          })
          .from(penFeedingProgramIngredients)
          .innerJoin(feedingIngredients, eq(penFeedingProgramIngredients.ingredientId, feedingIngredients.id))
          .where(eq(penFeedingProgramIngredients.penPhaseId, phase.id));

        return {
          ...phase,
          ingredients: phaseIngredients
        };
      })
    );

    return {
      ...program[0],
      phases: phasesWithIngredients
    };
  }
}