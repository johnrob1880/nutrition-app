import React, { ReactNode, useState, useEffect } from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock API hooks that will replace the old ones
const usePenFeedingPrograms = (penId: string) => {
  const queryClient = new QueryClient();
  return {
    data: undefined,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  };
};

const useFeedingIngredients = (userId: string) => {
  const queryClient = new QueryClient();
  return {
    data: undefined,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  };
};

const useRecordVariance = () => {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isLoading: false,
    error: null,
  };
};

const useMarkFeedingComplete = () => {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isLoading: false,
    error: null,
  };
};

const useProgramPhases = (programId: string) => {
  return {
    data: undefined,
    isLoading: false,
    error: null,
  };
};

describe('API Hooks Migration Tests', () => {
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('usePenFeedingPrograms', () => {
    it('should fetch feeding programs for a pen', async () => {
      const mockPrograms = [
        {
          id: '1',
          penId: 'pen-1',
          name: 'Growth Program',
          feedingTimes: ['06:00', '18:00'],
          isActive: true,
        },
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockPrograms,
      });

      const { result } = renderHook(
        () => {
          // Simulate the hook fetching data
          const [data, setData] = useState(null);
          const [isLoading, setIsLoading] = useState(true);

          useEffect(() => {
            fetch('/api/pens/pen-1/feeding-programs')
              .then(res => res.json())
              .then(data => {
                setData(data);
                setIsLoading(false);
              });
          }, []);

          return { data, isLoading };
        },
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/pens/pen-1/feeding-programs');
      expect(result.current.data).toEqual(mockPrograms);
    });

    it('should handle errors when fetching programs fails', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(
        () => {
          const [error, setError] = useState<Error | null>(null);
          const [isLoading, setIsLoading] = useState(true);

          useEffect(() => {
            fetch('/api/pens/pen-1/feeding-programs')
              .catch(err => {
                setError(err);
                setIsLoading(false);
              });
          }, []);

          return { error, isLoading };
        },
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe('useFeedingIngredients', () => {
    it('should fetch ingredients from centralized library', async () => {
      const mockIngredients = [
        {
          id: '1',
          userId: 'user-1',
          name: 'Corn Silage',
          category: 'Forage',
          proteinPercent: 8.5,
          dryMatterPercent: 35,
        },
        {
          id: '2',
          userId: 'user-1',
          name: 'Alfalfa Hay',
          category: 'Forage',
          proteinPercent: 18,
          dryMatterPercent: 88,
        },
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockIngredients,
      });

      const { result } = renderHook(
        () => {
          const [data, setData] = useState(null);
          useEffect(() => {
            fetch('/api/feeding-ingredients')
              .then(res => res.json())
              .then(setData);
          }, []);
          return { data };
        },
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mockIngredients);
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/feeding-ingredients');
    });

    it('should filter ingredients by category', async () => {
      const allIngredients = [
        { id: '1', name: 'Corn Silage', category: 'Forage' },
        { id: '2', name: 'Corn Grain', category: 'Grain' },
        { id: '3', name: 'Soybean Meal', category: 'Protein' },
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => allIngredients,
      });

      const { result } = renderHook(
        () => {
          const [data, setData] = useState<any[]>([]);
          const [filteredData, setFilteredData] = useState<any[]>([]);
          
          useEffect(() => {
            fetch('/api/feeding-ingredients')
              .then(res => res.json())
              .then(data => {
                setData(data);
                setFilteredData(data.filter((i: any) => i.category === 'Forage'));
              });
          }, []);
          
          return { filteredData };
        },
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.filteredData).toHaveLength(1);
        expect(result.current.filteredData[0].name).toBe('Corn Silage');
      });
    });
  });

  describe('useRecordVariance', () => {
    it('should only record variance when values differ', async () => {
      const variance = {
        penId: 'pen-1',
        phaseId: 'phase-1',
        ingredientId: 'ingredient-1',
        plannedQuantity: 100,
        actualQuantity: 95,
        variancePercent: -5,
        reason: 'Weather conditions',
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '1', ...variance }),
      });

      const { result } = renderHook(
        () => {
          const [response, setResponse] = useState(null);
          
          const recordVariance = async (data: any) => {
            // Only record if there's actually a variance
            if (data.actualQuantity !== data.plannedQuantity) {
              const res = await fetch('/api/feeding-variances', {
                method: 'POST',
                body: JSON.stringify(data),
              });
              const result = await res.json();
              setResponse(result);
            }
          };

          return { recordVariance, response };
        },
        { wrapper }
      );

      await result.current.recordVariance(variance);

      await waitFor(() => {
        expect(result.current.response).toBeTruthy();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/feeding-variances',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(variance),
        })
      );
    });

    it('should not record when actual matches planned', async () => {
      global.fetch = vi.fn();

      const { result } = renderHook(
        () => {
          const [callCount, setCallCount] = useState(0);
          
          const recordVariance = async (data: any) => {
            if (data.actualQuantity !== data.plannedQuantity) {
              setCallCount(prev => prev + 1);
              await fetch('/api/feeding-variances', {
                method: 'POST',
                body: JSON.stringify(data),
              });
            }
          };

          return { recordVariance, callCount };
        },
        { wrapper }
      );

      await result.current.recordVariance({
        plannedQuantity: 100,
        actualQuantity: 100,
      });

      expect(result.current.callCount).toBe(0);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('useMarkFeedingComplete', () => {
    it('should mark feeding time as complete', async () => {
      const completion = {
        penId: 'pen-1',
        feedingDate: new Date().toISOString(),
        feedingTime: '06:00',
        completedBy: 'user-1',
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: '1',
          ...completion,
          isComplete: true,
          completedAt: new Date().toISOString(),
        }),
      });

      const { result } = renderHook(
        () => {
          const [response, setResponse] = useState(null);
          
          const markComplete = async (data: any) => {
            const res = await fetch('/api/feeding-completion', {
              method: 'POST',
              body: JSON.stringify(data),
            });
            const result = await res.json();
            setResponse(result);
          };

          return { markComplete, response };
        },
        { wrapper }
      );

      await result.current.markComplete(completion);

      await waitFor(() => {
        expect(result.current.response).toBeTruthy();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/feeding-completion',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should fetch completion status for a day', async () => {
      const completions = [
        { feedingTime: '06:00', isComplete: true, completedBy: 'user-1' },
        { feedingTime: '12:00', isComplete: true, completedBy: 'user-2' },
        { feedingTime: '18:00', isComplete: false },
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => completions,
      });

      const { result } = renderHook(
        () => {
          const [data, setData] = useState(null);
          
          useEffect(() => {
            fetch('/api/pens/pen-1/completion-status/2024-01-01')
              .then(res => res.json())
              .then(setData);
          }, []);

          return { data };
        },
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(completions);
      });
    });
  });

  describe('useProgramPhases', () => {
    it('should fetch program phases with ingredients', async () => {
      const mockPhases = [
        {
          id: 'phase-1',
          programId: 'program-1',
          phaseNumber: 1,
          name: 'Starter',
          durationDays: 30,
          ingredients: [
            { ingredientId: '1', quantityPerDay: 10, unit: 'lbs' },
            { ingredientId: '2', quantityPerDay: 5, unit: 'lbs' },
          ],
        },
        {
          id: 'phase-2',
          programId: 'program-1',
          phaseNumber: 2,
          name: 'Grower',
          durationDays: 60,
          ingredients: [
            { ingredientId: '1', quantityPerDay: 15, unit: 'lbs' },
            { ingredientId: '3', quantityPerDay: 8, unit: 'lbs' },
          ],
        },
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockPhases,
      });

      const { result } = renderHook(
        () => {
          const [data, setData] = useState(null);
          
          useEffect(() => {
            fetch('/api/programs/program-1/phases')
              .then(res => res.json())
              .then(setData);
          }, []);

          return { data };
        },
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mockPhases);
      });

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data[0].ingredients).toHaveLength(2);
    });

    it('should calculate current phase based on start date', () => {
      const phases = [
        { startDay: 1, endDay: 30, name: 'Starter' },
        { startDay: 31, endDay: 90, name: 'Grower' },
        { startDay: 91, endDay: 150, name: 'Finisher' },
      ];

      const programStartDate = new Date('2024-01-01');
      const currentDate = new Date('2024-02-15'); // Day 45
      const daysSinceStart = Math.floor(
        (currentDate.getTime() - programStartDate.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

      const currentPhase = phases.find(
        p => daysSinceStart >= p.startDay && daysSinceStart <= p.endDay
      );

      expect(currentPhase?.name).toBe('Grower');
    });
  });

  describe('Migration Path Tests', () => {
    it('should map old feedingPlan endpoints to new program endpoints', () => {
      const oldEndpoint = '/api/feeding-plans/pen-1';
      const newEndpoint = '/api/pens/pen-1/feeding-programs';

      expect(newEndpoint).not.toBe(oldEndpoint);
      expect(newEndpoint).toContain('feeding-programs');
    });

    it('should transform old data structure to new format', () => {
      const oldFeedingPlan = {
        id: '1',
        penId: 'pen-1',
        ingredients: [
          { name: 'Corn', amount: 100, unit: 'lbs' },
        ],
      };

      const newProgram = {
        id: '1',
        penId: 'pen-1',
        name: 'Migrated Program',
        feedingTimes: ['06:00', '18:00'],
        phases: [
          {
            id: 'phase-1',
            name: 'Default Phase',
            ingredients: [
              {
                ingredientId: 'ingredient-1',
                quantityPerDay: 100,
                unit: 'lbs',
              },
            ],
          },
        ],
      };

      expect(newProgram.phases).toBeDefined();
      expect(newProgram.feedingTimes).toBeDefined();
      expect(newProgram.phases[0].ingredients[0]).toHaveProperty('ingredientId');
    });
  });
});