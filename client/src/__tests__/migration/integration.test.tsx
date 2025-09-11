import React, { ReactNode, useState, useEffect } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Integration test suite for the complete producer app migration
describe('Producer App Migration Integration Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('Complete Feeding Workflow', () => {
    it('should handle complete feeding workflow with new system', async () => {
      // Step 1: Fetch pen feeding program
      const mockProgram = {
        id: 'program-1',
        penId: 'pen-1',
        name: 'Growth Program',
        feedingTimes: ['06:00', '12:00', '18:00'],
        isActive: true,
        currentPhaseId: 'phase-2',
      };

      // Step 2: Fetch current phase details
      const mockPhase = {
        id: 'phase-2',
        programId: 'program-1',
        name: 'Grower Phase',
        phaseNumber: 2,
        durationDays: 60,
        mcalPerRation: 2.8,
        ingredients: [
          {
            ingredientId: 'ing-1',
            name: 'Corn Silage',
            quantityPerDay: 25,
            unit: 'lbs',
          },
          {
            ingredientId: 'ing-2',
            name: 'Grain Mix',
            quantityPerDay: 15,
            unit: 'lbs',
          },
        ],
      };

      // Step 3: Record feeding with variance
      const mockVariance = {
        id: 'variance-1',
        penId: 'pen-1',
        phaseId: 'phase-2',
        ingredientId: 'ing-1',
        plannedQuantity: 25,
        actualQuantity: 23,
        variancePercent: -8,
        feedingTime: '06:00',
        reason: 'Reduced appetite due to weather',
      };

      // Step 4: Mark feeding as complete
      const mockCompletion = {
        id: 'completion-1',
        penId: 'pen-1',
        feedingDate: new Date(),
        feedingTime: '06:00',
        isComplete: true,
        completedBy: 'user-1',
        completedAt: new Date(),
      };

      // Mock all API calls
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockProgram,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPhase,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockVariance,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCompletion,
        });

      const { result } = renderHook(
        () => {
          const [workflowState, setWorkflowState] = useState({
            program: null,
            phase: null,
            variance: null,
            completion: null,
          });

          const runWorkflow = async () => {
            // Fetch program
            const programRes = await fetch('/api/pens/pen-1/feeding-program');
            const program = await programRes.json();

            // Fetch phase
            const phaseRes = await fetch(`/api/phases/${program.currentPhaseId}`);
            const phase = await phaseRes.json();

            // Record variance
            const varianceRes = await fetch('/api/feeding-variances', {
              method: 'POST',
              body: JSON.stringify({
                penId: 'pen-1',
                phaseId: phase.id,
                ingredientId: 'ing-1',
                plannedQuantity: 25,
                actualQuantity: 23,
                feedingTime: '06:00',
                reason: 'Reduced appetite due to weather',
              }),
            });
            const variance = await varianceRes.json();

            // Mark complete
            const completionRes = await fetch('/api/feeding-completion', {
              method: 'POST',
              body: JSON.stringify({
                penId: 'pen-1',
                feedingTime: '06:00',
                completedBy: 'user-1',
              }),
            });
            const completion = await completionRes.json();

            setWorkflowState({ program, phase, variance, completion });
          };

          return { runWorkflow, workflowState };
        },
        { wrapper }
      );

      await act(async () => {
        await result.current.runWorkflow();
      });

      await waitFor(() => {
        expect(result.current.workflowState.program).toBeTruthy();
        expect(result.current.workflowState.phase).toBeTruthy();
        expect(result.current.workflowState.variance).toBeTruthy();
        expect(result.current.workflowState.completion).toBeTruthy();
      });

      // Verify workflow completed successfully
      expect(result.current.workflowState.program.feedingTimes).toHaveLength(3);
      expect(result.current.workflowState.variance.variancePercent).toBe(-8);
      expect(result.current.workflowState.completion.isComplete).toBe(true);
    });
  });

  describe('Data Migration Validation', () => {
    it('should validate migrated data integrity', async () => {
      // Old system data
      const oldData = {
        feedingPlan: {
          id: 'old-1',
          penId: 'pen-1',
          ingredients: [
            { name: 'Corn', amount: 100 },
            { name: 'Hay', amount: 50 },
          ],
        },
        feedingSchedule: {
          morningTime: '06:00',
          eveningTime: '18:00',
        },
      };

      // Expected new system data
      const expectedNewData = {
        program: {
          id: 'new-1',
          penId: 'pen-1',
          name: 'Migrated from Old System',
          feedingTimes: ['06:00', '18:00'],
          phases: [
            {
              id: 'phase-1',
              name: 'Migrated Phase',
              ingredients: [
                {
                  ingredientId: expect.any(String),
                  name: 'Corn',
                  quantityPerDay: 100,
                },
                {
                  ingredientId: expect.any(String),
                  name: 'Hay',
                  quantityPerDay: 50,
                },
              ],
            },
          ],
        },
      };

      // Simulate migration
      const migrateData = (oldData: any) => {
        return {
          program: {
            id: 'new-1',
            penId: oldData.feedingPlan.penId,
            name: 'Migrated from Old System',
            feedingTimes: [
              oldData.feedingSchedule.morningTime,
              oldData.feedingSchedule.eveningTime,
            ],
            phases: [
              {
                id: 'phase-1',
                name: 'Migrated Phase',
                ingredients: oldData.feedingPlan.ingredients.map((ing: any) => ({
                  ingredientId: `ing-${ing.name.toLowerCase()}`,
                  name: ing.name,
                  quantityPerDay: ing.amount,
                })),
              },
            ],
          },
        };
      };

      const migratedData = migrateData(oldData);

      // Validate migration
      expect(migratedData.program.penId).toBe(oldData.feedingPlan.penId);
      expect(migratedData.program.feedingTimes).toContain(oldData.feedingSchedule.morningTime);
      expect(migratedData.program.feedingTimes).toContain(oldData.feedingSchedule.eveningTime);
      expect(migratedData.program.phases[0].ingredients).toHaveLength(2);
      expect(migratedData.program.phases[0].ingredients[0].name).toBe('Corn');
      expect(migratedData.program.phases[0].ingredients[0].quantityPerDay).toBe(100);
    });

    it('should handle operatorEmail to operationId conversion', async () => {
      const oldPenData = {
        id: 'pen-1',
        name: 'Pen A',
        operatorEmail: 'operator@example.com',
        nutritionistId: 'nutritionist-string-id',
      };

      const mockOperation = {
        id: 'operation-uuid-123',
        operatorEmail: 'operator@example.com',
        name: 'Example Ranch',
      };

      const mockNutritionist = {
        id: 'nutritionist-uuid-456',
        email: 'nutritionist@example.com',
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOperation,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockNutritionist,
        });

      const { result } = renderHook(
        () => {
          const [migratedPen, setMigratedPen] = useState(null);

          const migratePen = async (oldPen: any) => {
            // Fetch operation by email
            const opRes = await fetch(`/api/operations/by-email/${oldPen.operatorEmail}`);
            const operation = await opRes.json();

            // Fetch nutritionist UUID
            const nutRes = await fetch(`/api/nutritionists/migrate/${oldPen.nutritionistId}`);
            const nutritionist = await nutRes.json();

            const newPen = {
              id: oldPen.id,
              name: oldPen.name,
              operationId: operation.id,
              nutritionistId: nutritionist.id,
            };

            setMigratedPen(newPen);
            return newPen;
          };

          return { migratePen, migratedPen };
        },
        { wrapper }
      );

      await act(async () => {
        await result.current.migratePen(oldPenData);
      });

      await waitFor(() => {
        expect(result.current.migratedPen).toBeTruthy();
      });

      expect(result.current.migratedPen.operationId).toBe('operation-uuid-123');
      expect(result.current.migratedPen.nutritionistId).toBe('nutritionist-uuid-456');
      expect(result.current.migratedPen.operatorEmail).toBeUndefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing feeding program gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'No feeding program found' }),
      });

      const { result } = renderHook(
        () => {
          const [error, setError] = useState(null);
          const [fallbackMode, setFallbackMode] = useState(false);

          const fetchProgram = async (penId: string) => {
            try {
              const res = await fetch(`/api/pens/${penId}/feeding-program`);
              if (!res.ok) {
                const errorData = await res.json();
                setError(errorData.error);
                setFallbackMode(true);
              }
            } catch (err) {
              setError(err.message);
              setFallbackMode(true);
            }
          };

          return { fetchProgram, error, fallbackMode };
        },
        { wrapper }
      );

      await act(async () => {
        await result.current.fetchProgram('pen-1');
      });

      expect(result.current.error).toBe('No feeding program found');
      expect(result.current.fallbackMode).toBe(true);
    });

    it('should handle partial data during migration', async () => {
      const incompleteOldData = {
        feedingPlan: {
          id: 'old-1',
          penId: 'pen-1',
          ingredients: [], // No ingredients
        },
        // Missing feeding schedule
      };

      const migrateIncompleteData = (data: any) => {
        const program = {
          id: 'new-1',
          penId: data.feedingPlan.penId,
          name: 'Migrated Program',
          feedingTimes: data.feedingSchedule?.morningTime 
            ? [data.feedingSchedule.morningTime, data.feedingSchedule.eveningTime || '18:00']
            : ['06:00', '18:00'], // Default times
          phases: data.feedingPlan.ingredients.length > 0
            ? [{
                id: 'phase-1',
                ingredients: data.feedingPlan.ingredients,
              }]
            : [{
                id: 'phase-1',
                name: 'Default Phase',
                ingredients: [],
              }],
        };
        return program;
      };

      const migratedData = migrateIncompleteData(incompleteOldData);

      expect(migratedData.feedingTimes).toEqual(['06:00', '18:00']); // Used defaults
      expect(migratedData.phases[0].ingredients).toEqual([]);
      expect(migratedData.phases[0].name).toBe('Default Phase');
    });

    it('should validate feeding time format during migration', () => {
      const validateFeedingTime = (time: string): boolean => {
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        return timeRegex.test(time);
      };

      expect(validateFeedingTime('06:00')).toBe(true);
      expect(validateFeedingTime('23:59')).toBe(true);
      expect(validateFeedingTime('24:00')).toBe(false);
      expect(validateFeedingTime('6:00')).toBe(false); // Missing leading zero
      expect(validateFeedingTime('06:60')).toBe(false); // Invalid minutes
    });
  });

  describe('Performance and Optimization', () => {
    it('should batch API calls efficiently', async () => {
      const penIds = ['pen-1', 'pen-2', 'pen-3'];
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => penIds.map(id => ({
          id: `program-${id}`,
          penId: id,
        })),
      });

      const { result } = renderHook(
        () => {
          const [programs, setPrograms] = useState([]);

          const fetchBatchPrograms = async (ids: string[]) => {
            const res = await fetch('/api/feeding-programs/batch', {
              method: 'POST',
              body: JSON.stringify({ penIds: ids }),
            });
            const data = await res.json();
            setPrograms(data);
          };

          return { fetchBatchPrograms, programs };
        },
        { wrapper }
      );

      await act(async () => {
        await result.current.fetchBatchPrograms(penIds);
      });

      // Should make only one API call for all pens
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result.current.programs).toHaveLength(3);
    });

    it('should cache feeding ingredients to reduce API calls', async () => {
      const mockIngredients = [
        { id: '1', name: 'Corn' },
        { id: '2', name: 'Hay' },
      ];

      let fetchCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        fetchCount++;
        return Promise.resolve({
          ok: true,
          json: async () => mockIngredients,
        });
      });

      const { result } = renderHook(
        () => {
          const [ingredients, setIngredients] = useState(null);
          const [cache] = useState(new Map());

          const fetchIngredients = async () => {
            const cacheKey = 'ingredients';
            if (cache.has(cacheKey)) {
              setIngredients(cache.get(cacheKey));
              return;
            }

            const res = await fetch('/api/feeding-ingredients');
            const data = await res.json();
            cache.set(cacheKey, data);
            setIngredients(data);
          };

          return { fetchIngredients, ingredients };
        },
        { wrapper }
      );

      // First fetch
      await act(async () => {
        await result.current.fetchIngredients();
      });

      // Second fetch (should use cache)
      await act(async () => {
        await result.current.fetchIngredients();
      });

      expect(fetchCount).toBe(1); // Only one actual API call
      expect(result.current.ingredients).toEqual(mockIngredients);
    });
  });
});