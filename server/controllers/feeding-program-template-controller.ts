import { Request, Response } from 'express';
import { getDb } from '../db/connection';
import { 
  feedingProgramTemplates, 
  feedingProgramPhases,
  feedingProgramIngredients,
  feedingIngredients
} from '@shared/schema';
import { sql, eq, and, inArray, desc, asc } from 'drizzle-orm';
import { z } from 'zod';

// Validation schemas
const ingredientSchema = z.object({
  ingredientId: z.string().uuid('Invalid ingredient ID'),
  percentageOfRation: z.number()
    .min(0, 'Percentage must be non-negative')
    .max(100, 'Percentage cannot exceed 100%')
});

const phaseSchema = z.object({
  phaseName: z.string().min(1, 'Phase name is required'),
  phaseOrder: z.number().int().positive('Phase order must be a positive integer'),
  durationDays: z.number().int().positive('Duration must be a positive integer'),
  targetMcalPerRation: z.number().positive('Target Mcal must be positive').optional(),
  ingredients: z.array(ingredientSchema).min(1, 'At least one ingredient is required')
});

const createTemplateSchema = z.object({
  name: z.string()
    .min(1, 'Template name is required')
    .max(255, 'Template name must be less than 255 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  categoryTags: z.array(z.string()).optional(),
  phases: z.array(phaseSchema).min(1, 'At least one phase is required')
});

const updateTemplateSchema = createTemplateSchema.partial();

const templateFiltersSchema = z.object({
  categoryTags: z.string().optional(),
  shared: z.string().transform(val => val === 'true').optional()
});

export class FeedingProgramTemplateController {
  /**
   * GET /api/feeding-program-templates
   * Retrieves feeding program templates for the authenticated consultant
   */
  static async getTemplates(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const filters = templateFiltersSchema.parse(req.query);
      const db = getDb();

      // Base query - get templates created by user
      let whereConditions = [eq(feedingProgramTemplates.createdByUserId, userId)];

      // Add shared templates if requested
      if (filters.shared) {
        whereConditions = [
          eq(feedingProgramTemplates.createdByUserId, userId),
          eq(feedingProgramTemplates.isShared, true)
        ];
      }

      // Build the main query
      let query = db
        .select()
        .from(feedingProgramTemplates)
        .where(sql`${feedingProgramTemplates.createdByUserId} = ${userId}${filters.shared ? sql` OR ${feedingProgramTemplates.isShared} = true` : sql``}`)
        .orderBy(desc(feedingProgramTemplates.updatedAt));

      const templates = await query;

      // Get phases and ingredients for each template
      const templatesWithDetails = await Promise.all(
        templates.map(async (template) => {
          // Get phases
          const phases = await db
            .select()
            .from(feedingProgramPhases)
            .where(eq(feedingProgramPhases.templateId, template.id))
            .orderBy(asc(feedingProgramPhases.phaseOrder));

          // Get ingredients for each phase
          const phasesWithIngredients = await Promise.all(
            phases.map(async (phase) => {
              const phaseIngredients = await db
                .select({
                  id: feedingProgramIngredients.id,
                  ingredientId: feedingProgramIngredients.ingredientId,
                  percentageOfRation: feedingProgramIngredients.percentageOfRation,
                  ingredientName: feedingIngredients.name,
                  proteinPercentage: feedingIngredients.proteinPercentage,
                  dryMatterPercentage: feedingIngredients.dryMatterPercentage
                })
                .from(feedingProgramIngredients)
                .innerJoin(feedingIngredients, eq(feedingProgramIngredients.ingredientId, feedingIngredients.id))
                .where(eq(feedingProgramIngredients.phaseId, phase.id));

              return {
                ...phase,
                ingredients: phaseIngredients
              };
            })
          );

          return {
            ...template,
            phases: phasesWithIngredients
          };
        })
      );

      // Filter by category tags if requested
      let filteredTemplates = templatesWithDetails;
      if (filters.categoryTags) {
        const requestedTags = filters.categoryTags.split(',').map(tag => tag.trim().toLowerCase());
        filteredTemplates = templatesWithDetails.filter(template => {
          if (!template.categoryTags || template.categoryTags.length === 0) return false;
          const templateTags = template.categoryTags.map(tag => tag.toLowerCase());
          return requestedTags.some(tag => templateTags.includes(tag));
        });
      }

      res.json(filteredTemplates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * POST /api/feeding-program-templates
   * Creates new feeding program template
   */
  static async createTemplate(req: Request, res: Response) {
    const db = getDb();
    
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Validate request body
      const validationResult = createTemplateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: validationResult.error.issues.map(issue => 
            `${issue.path.join('.')}: ${issue.message}`
          ).join(', ')
        });
      }

      const { name, description, categoryTags, phases } = validationResult.data;

      // Validate phase order is sequential
      const sortedPhases = [...phases].sort((a, b) => a.phaseOrder - b.phaseOrder);
      for (let i = 0; i < sortedPhases.length; i++) {
        if (sortedPhases[i].phaseOrder !== i + 1) {
          return res.status(400).json({
            error: 'Phase orders must be sequential starting from 1'
          });
        }
      }

      // Validate ingredient percentages sum to ~100% for each phase
      for (const phase of phases) {
        const totalPercentage = phase.ingredients.reduce((sum, ing) => sum + ing.percentageOfRation, 0);
        if (Math.abs(totalPercentage - 100) > 0.1) {
          return res.status(400).json({
            error: `Phase "${phase.phaseName}" ingredient percentages must sum to 100% (current: ${totalPercentage}%)`
          });
        }
      }

      // Validate all ingredient IDs exist and belong to the user
      const allIngredientIds = phases.flatMap(phase => phase.ingredients.map(ing => ing.ingredientId));
      const uniqueIngredientIds = Array.from(new Set(allIngredientIds));
      
      if (uniqueIngredientIds.length > 0) {
        const existingIngredients = await db
          .select({ id: feedingIngredients.id })
          .from(feedingIngredients)
          .where(and(
            inArray(feedingIngredients.id, uniqueIngredientIds),
            eq(feedingIngredients.userId, userId)
          ));

        if (existingIngredients.length !== uniqueIngredientIds.length) {
          return res.status(400).json({
            error: 'One or more ingredient IDs are invalid or do not belong to you'
          });
        }
      }

      // Begin transaction
      const templateId = crypto.randomUUID();
      
      // Create template
      const newTemplate = await db
        .insert(feedingProgramTemplates)
        .values({
          id: templateId,
          name,
          description,
          categoryTags: categoryTags || [],
          createdByUserId: userId,
          isShared: false
        })
        .returning();

      // Create phases
      const phaseIds: string[] = [];
      for (const phase of phases) {
        const phaseId = crypto.randomUUID();
        phaseIds.push(phaseId);
        
        await db
          .insert(feedingProgramPhases)
          .values({
            id: phaseId,
            templateId,
            phaseName: phase.phaseName,
            phaseOrder: phase.phaseOrder,
            durationDays: phase.durationDays,
            targetMcalPerRation: phase.targetMcalPerRation?.toString()
          });

        // Create phase ingredients
        for (const ingredient of phase.ingredients) {
          await db
            .insert(feedingProgramIngredients)
            .values({
              id: crypto.randomUUID(),
              phaseId,
              ingredientId: ingredient.ingredientId,
              percentageOfRation: ingredient.percentageOfRation.toString()
            });
        }
      }

      // Fetch the complete template with phases and ingredients
      const completeTemplate = await FeedingProgramTemplateController.getTemplateById(templateId);
      
      res.status(201).json(completeTemplate);
    } catch (error) {
      console.error('Error creating template:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * PUT /api/feeding-program-templates/:templateId
   * Updates existing feeding program template
   */
  static async updateTemplate(req: Request, res: Response) {
    const db = getDb();
    
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { templateId } = req.params;

      // Validate request body
      const validationResult = updateTemplateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: validationResult.error.issues.map(issue => 
            `${issue.path.join('.')}: ${issue.message}`
          ).join(', ')
        });
      }

      // Check if template exists and belongs to user
      const existingTemplate = await db
        .select()
        .from(feedingProgramTemplates)
        .where(and(
          eq(feedingProgramTemplates.id, templateId),
          eq(feedingProgramTemplates.createdByUserId, userId)
        ));

      if (existingTemplate.length === 0) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const updates = validationResult.data;

      // If phases are being updated, validate them
      if (updates.phases) {
        // Same validation as create
        const sortedPhases = [...updates.phases].sort((a, b) => a.phaseOrder - b.phaseOrder);
        for (let i = 0; i < sortedPhases.length; i++) {
          if (sortedPhases[i].phaseOrder !== i + 1) {
            return res.status(400).json({
              error: 'Phase orders must be sequential starting from 1'
            });
          }
        }

        // Validate ingredient percentages
        for (const phase of updates.phases) {
          const totalPercentage = phase.ingredients.reduce((sum, ing) => sum + ing.percentageOfRation, 0);
          if (Math.abs(totalPercentage - 100) > 0.1) {
            return res.status(400).json({
              error: `Phase "${phase.phaseName}" ingredient percentages must sum to 100% (current: ${totalPercentage}%)`
            });
          }
        }

        // Validate ingredient IDs
        const allIngredientIds = updates.phases.flatMap(phase => phase.ingredients.map(ing => ing.ingredientId));
        const uniqueIngredientIds = Array.from(new Set(allIngredientIds));

        if (uniqueIngredientIds.length > 0) {
          const existingIngredients = await db
            .select({ id: feedingIngredients.id })
            .from(feedingIngredients)
            .where(and(
              inArray(feedingIngredients.id, uniqueIngredientIds),
              eq(feedingIngredients.userId, userId)
            ));

          if (existingIngredients.length !== uniqueIngredientIds.length) {
            return res.status(400).json({
              error: 'One or more ingredient IDs are invalid or do not belong to you'
            });
          }
        }

        // Delete existing phases and ingredients
        await db
          .delete(feedingProgramPhases)
          .where(eq(feedingProgramPhases.templateId, templateId));

        // Create new phases
        for (const phase of updates.phases) {
          const phaseId = crypto.randomUUID();
          
          await db
            .insert(feedingProgramPhases)
            .values({
              id: phaseId,
              templateId,
              phaseName: phase.phaseName,
              phaseOrder: phase.phaseOrder,
              durationDays: phase.durationDays,
              targetMcalPerRation: phase.targetMcalPerRation?.toString()
            });

          // Create phase ingredients
          for (const ingredient of phase.ingredients) {
            await db
              .insert(feedingProgramIngredients)
              .values({
                id: crypto.randomUUID(),
                phaseId,
                ingredientId: ingredient.ingredientId,
                percentageOfRation: ingredient.percentageOfRation.toString()
              });
          }
        }
      }

      // Update template metadata
      const updateData: any = { updatedAt: new Date() };
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.categoryTags !== undefined) updateData.categoryTags = updates.categoryTags;

      if (Object.keys(updateData).length > 1) { // More than just updatedAt
        await db
          .update(feedingProgramTemplates)
          .set(updateData)
          .where(eq(feedingProgramTemplates.id, templateId));
      }

      // Fetch updated template
      const updatedTemplate = await FeedingProgramTemplateController.getTemplateById(templateId);
      
      res.json(updatedTemplate);
    } catch (error) {
      console.error('Error updating template:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * DELETE /api/feeding-program-templates/:templateId
   * Deletes feeding program template
   */
  static async deleteTemplate(req: Request, res: Response) {
    const db = getDb();
    
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { templateId } = req.params;

      // Check if template exists and belongs to user
      const existingTemplate = await db
        .select()
        .from(feedingProgramTemplates)
        .where(and(
          eq(feedingProgramTemplates.id, templateId),
          eq(feedingProgramTemplates.createdByUserId, userId)
        ));

      if (existingTemplate.length === 0) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // TODO: Check if template is in use by pen feeding programs
      // For now, allow deletion (cascade will handle phases and ingredients)

      // Delete template (cascade will delete phases and ingredients)
      await db
        .delete(feedingProgramTemplates)
        .where(eq(feedingProgramTemplates.id, templateId));

      res.json({ success: true, message: 'Template deleted successfully' });
    } catch (error) {
      console.error('Error deleting template:', error);
      
      if (error instanceof Error && error.message.includes('foreign key')) {
        return res.status(409).json({
          error: 'Cannot delete template: it is currently in use by feeding programs'
        });
      }
      
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Helper method to get complete template by ID
   */
  private static async getTemplateById(templateId: string) {
    const db = getDb();
    
    const template = await db
      .select()
      .from(feedingProgramTemplates)
      .where(eq(feedingProgramTemplates.id, templateId))
      .limit(1);

    if (template.length === 0) {
      return null;
    }

    // Get phases
    const phases = await db
      .select()
      .from(feedingProgramPhases)
      .where(eq(feedingProgramPhases.templateId, templateId))
      .orderBy(asc(feedingProgramPhases.phaseOrder));

    // Get ingredients for each phase
    const phasesWithIngredients = await Promise.all(
      phases.map(async (phase) => {
        const phaseIngredients = await db
          .select({
            id: feedingProgramIngredients.id,
            ingredientId: feedingProgramIngredients.ingredientId,
            percentageOfRation: feedingProgramIngredients.percentageOfRation,
            ingredientName: feedingIngredients.name,
            proteinPercentage: feedingIngredients.proteinPercentage,
            dryMatterPercentage: feedingIngredients.dryMatterPercentage
          })
          .from(feedingProgramIngredients)
          .innerJoin(feedingIngredients, eq(feedingProgramIngredients.ingredientId, feedingIngredients.id))
          .where(eq(feedingProgramIngredients.phaseId, phase.id));

        return {
          ...phase,
          ingredients: phaseIngredients
        };
      })
    );

    return {
      ...template[0],
      phases: phasesWithIngredients
    };
  }
}