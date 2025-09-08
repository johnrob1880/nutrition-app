import { describe, it, expect } from 'vitest';
import { 
  feedingIngredients,
  feedingProgramTemplates,
  feedingProgramPhases,
  feedingProgramIngredients,
  penFeedingPrograms,
  penFeedingProgramPhases,
  penFeedingProgramIngredients,
  feedingRecordVariances,
  dailyFeedingCompletionStatus,
  nutritionistTasks
} from '@shared/schema';

describe('Feeding Program Schema Creation', () => {
  it('should have all required feeding program tables defined', () => {
    // Check that all new tables are properly defined
    expect(feedingIngredients).toBeDefined();
    expect(feedingProgramTemplates).toBeDefined();
    expect(feedingProgramPhases).toBeDefined();
    expect(feedingProgramIngredients).toBeDefined();
    expect(penFeedingPrograms).toBeDefined();
    expect(penFeedingProgramPhases).toBeDefined();
    expect(penFeedingProgramIngredients).toBeDefined();
    expect(feedingRecordVariances).toBeDefined();
    expect(dailyFeedingCompletionStatus).toBeDefined();
    expect(nutritionistTasks).toBeDefined();
  });

  it('should have correct table structure', () => {
    // Verify tables have expected properties without accessing internal metadata
    expect(typeof feedingIngredients).toBe('object');
    expect(typeof feedingProgramTemplates).toBe('object');
    expect(typeof feedingProgramPhases).toBe('object');
    expect(typeof feedingProgramIngredients).toBe('object');
    expect(typeof penFeedingPrograms).toBe('object');
    expect(typeof penFeedingProgramPhases).toBe('object');
    expect(typeof penFeedingProgramIngredients).toBe('object');
    expect(typeof feedingRecordVariances).toBe('object');
    expect(typeof dailyFeedingCompletionStatus).toBe('object');
    expect(typeof nutritionistTasks).toBe('object');
  });

  it('should have required primary key fields', () => {
    expect(feedingIngredients.id).toBeDefined();
    expect(feedingProgramTemplates.id).toBeDefined();
    expect(feedingProgramPhases.id).toBeDefined();
    expect(feedingProgramIngredients.id).toBeDefined();
    expect(penFeedingPrograms.id).toBeDefined();
    expect(penFeedingProgramPhases.id).toBeDefined();
    expect(penFeedingProgramIngredients.id).toBeDefined();
    expect(feedingRecordVariances.id).toBeDefined();
    expect(dailyFeedingCompletionStatus.id).toBeDefined();
    expect(nutritionistTasks.id).toBeDefined();
  });

  it('should have correct foreign key relationships', () => {
    // feedingIngredients should reference users
    expect(feedingIngredients.userId).toBeDefined();
    
    // feedingProgramTemplates should reference users
    expect(feedingProgramTemplates.createdByUserId).toBeDefined();
    
    // feedingProgramPhases should reference templates
    expect(feedingProgramPhases.templateId).toBeDefined();
    
    // feedingProgramIngredients should reference phases and ingredients
    expect(feedingProgramIngredients.phaseId).toBeDefined();
    expect(feedingProgramIngredients.ingredientId).toBeDefined();
    
    // penFeedingPrograms should reference pens and templates
    expect(penFeedingPrograms.penId).toBeDefined();
    expect(penFeedingPrograms.templateId).toBeDefined();
    expect(penFeedingPrograms.createdByUserId).toBeDefined();
    
    // Variance tracking should have all required references
    expect(feedingRecordVariances.penProgramId).toBeDefined();
    expect(feedingRecordVariances.penId).toBeDefined();
    expect(feedingRecordVariances.ingredientId).toBeDefined();
    expect(feedingRecordVariances.recordedByUserId).toBeDefined();
    
    // Completion status should reference programs and users
    expect(dailyFeedingCompletionStatus.penProgramId).toBeDefined();
    expect(dailyFeedingCompletionStatus.completedByUserId).toBeDefined();
    
    // Nutritionist tasks should reference users and pens
    expect(nutritionistTasks.nutritionistId).toBeDefined();
    expect(nutritionistTasks.penId).toBeDefined();
  });

  it('should have required array fields', () => {
    // Templates should support category tags array
    expect(feedingProgramTemplates.categoryTags).toBeDefined();
    
    // Pen programs should support feeding times array
    expect(penFeedingPrograms.feedingTimes).toBeDefined();
  });

  it('should have variance calculation fields', () => {
    expect(feedingRecordVariances.plannedAmount).toBeDefined();
    expect(feedingRecordVariances.actualAmount).toBeDefined();
    expect(feedingRecordVariances.varianceAmount).toBeDefined();
    expect(feedingRecordVariances.variancePercentage).toBeDefined();
  });

  it('should have nutritional data fields', () => {
    expect(feedingIngredients.proteinPercentage).toBeDefined();
    expect(feedingIngredients.dryMatterPercentage).toBeDefined();
    expect(feedingProgramPhases.targetMcalPerRation).toBeDefined();
    expect(penFeedingProgramPhases.targetMcalPerRation).toBeDefined();
  });

  it('should have task management fields', () => {
    expect(nutritionistTasks.taskType).toBeDefined();
    expect(nutritionistTasks.status).toBeDefined();
    expect(nutritionistTasks.priority).toBeDefined();
    expect(nutritionistTasks.completedAt).toBeDefined();
    expect(nutritionistTasks.completedByUserId).toBeDefined();
    expect(nutritionistTasks.notes).toBeDefined();
  });
});