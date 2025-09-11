import { Request, Response } from 'express';
import { getDb } from '../db/connection';
import { feedingIngredients, insertFeedingIngredientSchema } from '@shared/schema';
import { sql, eq, and } from 'drizzle-orm';
import { z } from 'zod';

// Validation schemas
const createIngredientSchema = z.object({
  name: z.string()
    .min(1, 'Ingredient name is required')
    .max(255, 'Ingredient name must be less than 255 characters'),
  proteinPercentage: z.number()
    .min(0, 'Protein percentage must be non-negative')
    .max(100, 'Protein percentage cannot exceed 100%')
    .optional(),
  dryMatterPercentage: z.number()
    .min(0, 'Dry matter percentage must be non-negative')
    .max(100, 'Dry matter percentage cannot exceed 100%')
    .optional()
});

const updateIngredientSchema = createIngredientSchema.partial();

export class FeedingIngredientController {
  /**
   * GET /api/feeding-ingredients
   * Retrieves user's ingredient library
   */
  static async getIngredients(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const db = getDb();
      const ingredients = await db
        .select()
        .from(feedingIngredients)
        .where(eq(feedingIngredients.userId, userId))
        .orderBy(feedingIngredients.name);

      res.json(ingredients);
    } catch (error) {
      console.error('Error fetching ingredients:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * POST /api/feeding-ingredients
   * Creates new ingredient with nutritional data
   */
  static async createIngredient(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Validate request body
      const validationResult = createIngredientSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: validationResult.error.issues.map(issue => issue.message).join(', ')
        });
      }

      const { name, proteinPercentage, dryMatterPercentage } = validationResult.data;

      const db = getDb();
      
      // Check for duplicate name for this user
      const existingIngredient = await db
        .select()
        .from(feedingIngredients)
        .where(and(
          eq(feedingIngredients.userId, userId),
          eq(feedingIngredients.name, name)
        ));

      if (existingIngredient.length > 0) {
        return res.status(409).json({ 
          error: 'Ingredient with this name already exists in your library' 
        });
      }

      // Create ingredient
      const newIngredient = await db
        .insert(feedingIngredients)
        .values({
          id: crypto.randomUUID(),
          userId,
          name,
          proteinPercentage: proteinPercentage?.toString(),
          dryMatterPercentage: dryMatterPercentage?.toString()
        })
        .returning();

      res.status(201).json(newIngredient[0]);
    } catch (error) {
      console.error('Error creating ingredient:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * PUT /api/feeding-ingredients/:ingredientId
   * Updates existing ingredient
   */
  static async updateIngredient(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { ingredientId } = req.params;

      // Validate request body
      const validationResult = updateIngredientSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: validationResult.error.issues.map(issue => issue.message).join(', ')
        });
      }

      const updates = validationResult.data;

      const db = getDb();
      
      // Check if ingredient exists and belongs to user
      const existingIngredient = await db
        .select()
        .from(feedingIngredients)
        .where(and(
          eq(feedingIngredients.id, ingredientId),
          eq(feedingIngredients.userId, userId)
        ));

      if (existingIngredient.length === 0) {
        return res.status(404).json({ error: 'Ingredient not found' });
      }

      // Check for duplicate name if name is being updated
      if (updates.name && updates.name !== existingIngredient[0].name) {
        const duplicateCheck = await db
          .select()
          .from(feedingIngredients)
          .where(and(
            eq(feedingIngredients.userId, userId),
            eq(feedingIngredients.name, updates.name)
          ));

        if (duplicateCheck.length > 0) {
          return res.status(409).json({ 
            error: 'Ingredient with this name already exists in your library' 
          });
        }
      }

      // Prepare update data
      const updateData: any = {
        updatedAt: new Date()
      };

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.proteinPercentage !== undefined) {
        updateData.proteinPercentage = updates.proteinPercentage.toString();
      }
      if (updates.dryMatterPercentage !== undefined) {
        updateData.dryMatterPercentage = updates.dryMatterPercentage.toString();
      }

      // Update ingredient
      const updatedIngredient = await db
        .update(feedingIngredients)
        .set(updateData)
        .where(and(
          eq(feedingIngredients.id, ingredientId),
          eq(feedingIngredients.userId, userId)
        ))
        .returning();

      if (updatedIngredient.length === 0) {
        return res.status(404).json({ error: 'Ingredient not found' });
      }

      res.json(updatedIngredient[0]);
    } catch (error) {
      console.error('Error updating ingredient:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * DELETE /api/feeding-ingredients/:ingredientId
   * Deletes ingredient if not in use
   */
  static async deleteIngredient(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { ingredientId } = req.params;

      const db = getDb();
      
      // Check if ingredient exists and belongs to user
      const existingIngredient = await db
        .select()
        .from(feedingIngredients)
        .where(and(
          eq(feedingIngredients.id, ingredientId),
          eq(feedingIngredients.userId, userId)
        ));

      if (existingIngredient.length === 0) {
        return res.status(404).json({ error: 'Ingredient not found' });
      }

      // TODO: Check if ingredient is in use by templates or pen programs
      // This will be implemented after the template and program tables are set up
      // For now, we'll allow deletion

      // Delete ingredient
      const deletedIngredient = await db
        .delete(feedingIngredients)
        .where(and(
          eq(feedingIngredients.id, ingredientId),
          eq(feedingIngredients.userId, userId)
        ))
        .returning();

      if (deletedIngredient.length === 0) {
        return res.status(404).json({ error: 'Ingredient not found' });
      }

      res.json({ success: true, message: 'Ingredient deleted successfully' });
    } catch (error) {
      console.error('Error deleting ingredient:', error);
      
      // Check if error is due to foreign key constraint
      if (error instanceof Error && error.message.includes('foreign key')) {
        return res.status(409).json({ 
          error: 'Cannot delete ingredient: it is currently in use by feeding programs or templates' 
        });
      }
      
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Helper method to check if ingredient is in use
   * This will be expanded once template and program systems are implemented
   */
  private static async isIngredientInUse(ingredientId: string): Promise<boolean> {
    // TODO: Implement checks for:
    // - feedingProgramIngredients table
    // - penFeedingProgramIngredients table
    // For now, return false to allow deletion
    return false;
  }
}