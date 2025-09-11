import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { 
  PenFeedingProgram, 
  InsertPenFeedingProgram,
  PenFeedingProgramPhase,
  PenFeedingProgramIngredient,
  FeedingRecordVariance,
  InsertFeedingRecordVariance,
  DailyFeedingCompletionStatus,
  InsertDailyFeedingCompletionStatus,
  FeedingIngredient
} from "@shared/schema";

// Hook to fetch feeding programs for a pen
export function usePenFeedingPrograms(penId: number) {
  return useQuery({
    queryKey: ["/api/pens", penId, "feeding-programs"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pens/${penId}/feeding-programs`);
      return res.json() as Promise<PenFeedingProgram[]>;
    },
    enabled: !!penId,
  });
}

// Hook to fetch active feeding program for a pen
export function useActivePenFeedingProgram(penId: number) {
  return useQuery({
    queryKey: ["/api/pens", penId, "feeding-program", "active"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pens/${penId}/feeding-program/active`);
      return res.json() as Promise<PenFeedingProgram | null>;
    },
    enabled: !!penId,
  });
}

// Hook to fetch program phases with ingredients
export function useProgramPhases(programId: string) {
  return useQuery({
    queryKey: ["/api/feeding-programs", programId, "phases"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/feeding-programs/${programId}/phases`);
      return res.json() as Promise<(PenFeedingProgramPhase & { ingredients: PenFeedingProgramIngredient[] })[]>;
    },
    enabled: !!programId,
  });
}

// Hook to fetch current phase for a program
export function useCurrentPhase(programId: string, dayNumber: number) {
  return useQuery({
    queryKey: ["/api/feeding-programs", programId, "current-phase", dayNumber],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/feeding-programs/${programId}/current-phase?day=${dayNumber}`);
      return res.json() as Promise<(PenFeedingProgramPhase & { ingredients: PenFeedingProgramIngredient[] }) | null>;
    },
    enabled: !!programId && dayNumber > 0,
  });
}

// Hook to fetch feeding ingredients library
export function useFeedingIngredients(userId?: number) {
  return useQuery({
    queryKey: ["/api/feeding-ingredients", userId],
    queryFn: async () => {
      const url = userId ? `/api/feeding-ingredients?userId=${userId}` : "/api/feeding-ingredients";
      const res = await apiRequest("GET", url);
      return res.json() as Promise<FeedingIngredient[]>;
    },
  });
}

// Hook to create/update feeding program
export function useCreatePenFeedingProgram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InsertPenFeedingProgram) => {
      const res = await apiRequest("POST", "/api/pen-feeding-programs", data);
      return res.json() as Promise<PenFeedingProgram>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pens", data.penId, "feeding-programs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pens", data.penId, "feeding-program", "active"] });
    },
  });
}

// Hook to record variance (only when actual differs from planned)
export function useRecordVariance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InsertFeedingRecordVariance) => {
      // Only record if there's actually a variance
      const variancePercent = Math.abs(((data.actualAmount - data.plannedAmount) / data.plannedAmount) * 100);
      if (variancePercent < 0.1) { // Less than 0.1% variance - don't record
        return null;
      }
      
      const res = await apiRequest("POST", "/api/feeding-variances", data);
      return res.json() as Promise<FeedingRecordVariance>;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ["/api/feeding-variances"] });
        queryClient.invalidateQueries({ queryKey: ["/api/pens", data.penId, "variances"] });
      }
    },
  });
}

// Hook to mark feeding as complete
export function useMarkFeedingComplete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InsertDailyFeedingCompletionStatus) => {
      const res = await apiRequest("POST", "/api/feeding-completion", data);
      return res.json() as Promise<DailyFeedingCompletionStatus>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/feeding-completion"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pens", "completion-status"] });
    },
  });
}

// Hook to fetch completion status for a pen and date
export function useFeedingCompletionStatus(penProgramId: string, date: string) {
  return useQuery({
    queryKey: ["/api/feeding-completion", penProgramId, date],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/feeding-completion/${penProgramId}/${date}`);
      return res.json() as Promise<DailyFeedingCompletionStatus[]>;
    },
    enabled: !!penProgramId && !!date,
  });
}

// Hook to fetch variances for analysis
export function useFeedingVariances(penProgramId: string, dateRange?: { start: string; end: string }) {
  return useQuery({
    queryKey: ["/api/feeding-variances", penProgramId, dateRange?.start, dateRange?.end],
    queryFn: async () => {
      let url = `/api/feeding-variances/${penProgramId}`;
      if (dateRange) {
        url += `?start=${dateRange.start}&end=${dateRange.end}`;
      }
      const res = await apiRequest("GET", url);
      return res.json() as Promise<(FeedingRecordVariance & { ingredientName: string })[]>;
    },
    enabled: !!penProgramId,
  });
}

// Hook to calculate current phase based on program start date
export function useCalculateCurrentPhase(program: PenFeedingProgram | null | undefined) {
  return useQuery({
    queryKey: ["/api/feeding-programs", program?.id, "calculate-phase"],
    queryFn: async () => {
      if (!program) return null;
      
      const startDate = new Date(program.startDate);
      const currentDate = new Date();
      const daysSinceStart = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      const res = await apiRequest("GET", `/api/feeding-programs/${program.id}/phases`);
      const phases = await res.json() as (PenFeedingProgramPhase & { ingredients: PenFeedingProgramIngredient[] })[];
      
      // Calculate cumulative days to find current phase
      let cumulativeDays = 0;
      for (const phase of phases.sort((a, b) => a.phaseOrder - b.phaseOrder)) {
        cumulativeDays += phase.durationDays;
        if (daysSinceStart <= cumulativeDays) {
          return {
            phase,
            dayInPhase: daysSinceStart - (cumulativeDays - phase.durationDays),
            daysRemaining: cumulativeDays - daysSinceStart,
          };
        }
      }
      
      return null; // Program completed
    },
    enabled: !!program,
  });
}