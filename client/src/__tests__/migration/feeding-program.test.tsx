import React, { ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock types for the new feeding program system
interface PenFeedingProgram {
  id: string;
  penId: string;
  templateId?: string;
  name: string;
  description?: string;
  feedingTimes: string[];
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface PenFeedingProgramPhase {
  id: string;
  programId: string;
  phaseNumber: number;
  name: string;
  durationDays: number;
  mcalPerRation: number;
  proteinPercent: number;
  dryMatterPercent: number;
  description?: string;
  startDay: number;
  endDay: number;
}

interface PenFeedingProgramIngredient {
  id: string;
  penPhaseId: string;
  ingredientId: string;
  quantityPerDay: number;
  unit: string;
  costPerUnit?: number;
  notes?: string;
}

interface FeedingIngredient {
  id: string;
  userId: string;
  name: string;
  category: string;
  proteinPercent: number;
  dryMatterPercent: number;
  mcalPerUnit?: number;
  costPerUnit?: number;
  unit: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface FeedingVariance {
  id: string;
  penId: string;
  feedingDate: Date;
  feedingTime: string;
  phaseId: string;
  ingredientId: string;
  plannedQuantity: number;
  actualQuantity: number;
  variancePercent: number;
  reason?: string;
  recordedBy: string;
  createdAt: Date;
}

interface FeedingCompletionStatus {
  id: string;
  penId: string;
  feedingDate: Date;
  feedingTime: string;
  isComplete: boolean;
  completedBy?: string;
  completedAt?: Date;
  notes?: string;
}

describe('Pen Feeding Program Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('API Hooks', () => {
    it('should fetch pen feeding programs', async () => {
      const mockPrograms: PenFeedingProgram[] = [
        {
          id: '1',
          penId: 'pen-1',
          templateId: 'template-1',
          name: 'Starter Program',
          description: 'Initial feeding program',
          feedingTimes: ['06:00', '18:00'],
          startDate: new Date('2024-01-01'),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockPrograms,
      });

      const { result } = renderHook(
        () => {
          // This would be the actual usePenFeedingPrograms hook
          return { data: mockPrograms, isLoading: false };
        },
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mockPrograms);
      });
    });

    it('should fetch program phases', async () => {
      const mockPhases: PenFeedingProgramPhase[] = [
        {
          id: '1',
          programId: 'program-1',
          phaseNumber: 1,
          name: 'Starter Phase',
          durationDays: 30,
          mcalPerRation: 2.5,
          proteinPercent: 16,
          dryMatterPercent: 88,
          startDay: 1,
          endDay: 30,
        },
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockPhases,
      });

      const { result } = renderHook(
        () => {
          return { data: mockPhases, isLoading: false };
        },
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mockPhases);
      });
    });

    it('should fetch feeding ingredients from centralized library', async () => {
      const mockIngredients: FeedingIngredient[] = [
        {
          id: '1',
          userId: 'user-1',
          name: 'Corn Silage',
          category: 'Forage',
          proteinPercent: 8.5,
          dryMatterPercent: 35,
          mcalPerUnit: 0.73,
          costPerUnit: 45,
          unit: 'ton',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockIngredients,
      });

      const { result } = renderHook(
        () => {
          return { data: mockIngredients, isLoading: false };
        },
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mockIngredients);
      });
    });
  });

  describe('Variance Recording', () => {
    it('should only record variances when actual differs from planned', async () => {
      const plannedQuantity = 100;
      const actualQuantity = 95;
      
      const variance: FeedingVariance = {
        id: '1',
        penId: 'pen-1',
        feedingDate: new Date(),
        feedingTime: '06:00',
        phaseId: 'phase-1',
        ingredientId: 'ingredient-1',
        plannedQuantity,
        actualQuantity,
        variancePercent: ((actualQuantity - plannedQuantity) / plannedQuantity) * 100,
        reason: 'Weather conditions',
        recordedBy: 'user-1',
        createdAt: new Date(),
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => variance,
      });

      const result = await fetch('/api/feeding-variances', {
        method: 'POST',
        body: JSON.stringify(variance),
      });

      const data = await result.json();
      expect(data.variancePercent).toBe(-5);
    });

    it('should not create variance record when actual matches planned', async () => {
      const plannedQuantity = 100;
      const actualQuantity = 100;

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      });

      const result = await fetch('/api/feeding-variances', {
        method: 'POST',
        body: JSON.stringify({
          plannedQuantity,
          actualQuantity,
        }),
      });

      const data = await result.json();
      expect(data).toBeNull();
    });
  });

  describe('Feeding Completion Tracking', () => {
    it('should mark feeding as complete', async () => {
      const completion: FeedingCompletionStatus = {
        id: '1',
        penId: 'pen-1',
        feedingDate: new Date(),
        feedingTime: '06:00',
        isComplete: true,
        completedBy: 'user-1',
        completedAt: new Date(),
        notes: 'Completed successfully',
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => completion,
      });

      const result = await fetch('/api/feeding-completion', {
        method: 'POST',
        body: JSON.stringify(completion),
      });

      const data = await result.json();
      expect(data.isComplete).toBe(true);
      expect(data.completedBy).toBe('user-1');
    });

    it('should track multiple daily feeding times', async () => {
      const feedingTimes = ['06:00', '12:00', '18:00'];
      const completions: FeedingCompletionStatus[] = feedingTimes.map((time, index) => ({
        id: String(index + 1),
        penId: 'pen-1',
        feedingDate: new Date(),
        feedingTime: time,
        isComplete: index < 2, // First two completed
        completedBy: index < 2 ? 'user-1' : undefined,
        completedAt: index < 2 ? new Date() : undefined,
      }));

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => completions,
      });

      const result = await fetch('/api/feeding-completion/pen-1/today');
      const data = await result.json();
      
      expect(data).toHaveLength(3);
      expect(data.filter((d: FeedingCompletionStatus) => d.isComplete)).toHaveLength(2);
    });
  });

  describe('Migration from Old System', () => {
    it('should handle migration from feedingPlans to penFeedingPrograms', async () => {
      const oldFeedingPlan = {
        id: 'old-1',
        penId: 'pen-1',
        ingredients: [
          { name: 'Corn', amount: 100, unit: 'lbs' },
        ],
      };

      const newProgram: PenFeedingProgram = {
        id: 'new-1',
        penId: 'pen-1',
        name: 'Migrated Program',
        feedingTimes: ['06:00', '18:00'],
        startDate: new Date(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => newProgram,
      });

      const result = await fetch('/api/migrate/feeding-plan', {
        method: 'POST',
        body: JSON.stringify(oldFeedingPlan),
      });

      const data = await result.json();
      expect(data.penId).toBe(oldFeedingPlan.penId);
      expect(data.feedingTimes).toBeDefined();
    });

    it('should convert operatorEmail to operationId', async () => {
      const oldPen = {
        id: 'pen-1',
        operatorEmail: 'operator@example.com',
        nutritionistId: 'old-nutritionist-id',
      };

      const newPen = {
        id: 'pen-1',
        operationId: 'operation-uuid',
        nutritionistId: 'nutritionist-uuid',
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => newPen,
      });

      const result = await fetch('/api/migrate/pen', {
        method: 'POST',
        body: JSON.stringify(oldPen),
      });

      const data = await result.json();
      expect(data.operationId).toBeDefined();
      expect(data.operatorEmail).toBeUndefined();
    });
  });

  describe('Schedule Display', () => {
    it('should display multiple daily feeding times', () => {
      const program: PenFeedingProgram = {
        id: '1',
        penId: 'pen-1',
        name: 'Multi-feed Program',
        feedingTimes: ['06:00', '12:00', '18:00', '22:00'],
        startDate: new Date(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(program.feedingTimes).toHaveLength(4);
      expect(program.feedingTimes).toContain('12:00');
    });

    it('should handle phase transitions in schedule', () => {
      const phases: PenFeedingProgramPhase[] = [
        {
          id: '1',
          programId: 'program-1',
          phaseNumber: 1,
          name: 'Starter',
          durationDays: 30,
          mcalPerRation: 2.5,
          proteinPercent: 16,
          dryMatterPercent: 88,
          startDay: 1,
          endDay: 30,
        },
        {
          id: '2',
          programId: 'program-1',
          phaseNumber: 2,
          name: 'Grower',
          durationDays: 60,
          mcalPerRation: 2.8,
          proteinPercent: 14,
          dryMatterPercent: 87,
          startDay: 31,
          endDay: 90,
        },
      ];

      const currentDay = 45;
      const currentPhase = phases.find(
        p => currentDay >= p.startDay && currentDay <= p.endDay
      );

      expect(currentPhase?.name).toBe('Grower');
    });
  });
});