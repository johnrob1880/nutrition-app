import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { FeedingPlan2, PenFeedingProgram } from "@shared/schema";

// Hook to migrate old feeding plans to new feeding programs
export function useMigrateFeedingPlans() {
  return useMutation({
    mutationFn: async (penId: number) => {
      const res = await apiRequest("POST", `/api/migrate/feeding-plans/${penId}`);
      return res.json() as Promise<PenFeedingProgram>;
    },
  });
}

// Hook to check if a pen has been migrated to the new system
export function useCheckMigrationStatus(penId: number) {
  return useQuery({
    queryKey: ["/api/migration/status", penId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/migration/status/${penId}`);
      return res.json() as Promise<{ migrated: boolean; hasOldData: boolean; hasNewData: boolean }>;
    },
    enabled: !!penId,
  });
}

// Hook to get old feeding plans (for fallback during migration)
export function useOldFeedingPlans(operatorEmail: string) {
  return useQuery({
    queryKey: ["/api/schedules", operatorEmail], // Keep old query key for compatibility
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/schedules?operatorEmail=${operatorEmail}`);
      return res.json() as Promise<FeedingPlan2[]>;
    },
    enabled: !!operatorEmail,
    staleTime: 5 * 60 * 1000, // 5 minutes - only use as fallback
  });
}

// Hook to automatically migrate pen data when needed
export function useAutoMigration(penId: number) {
  const { data: migrationStatus } = useCheckMigrationStatus(penId);
  const migrateMutation = useMigrateFeedingPlans();

  return {
    needsMigration: migrationStatus?.hasOldData && !migrationStatus?.migrated,
    isReady: migrationStatus?.migrated || !migrationStatus?.hasOldData,
    migrate: () => migrateMutation.mutate(penId),
    isMigrating: migrateMutation.isPending,
  };
}

// Hook that provides unified interface - tries new system first, falls back to old
export function useUnifiedFeedingData(penId: number, operatorEmail: string) {
  const { data: migrationStatus } = useCheckMigrationStatus(penId);
  const { data: oldPlans } = useOldFeedingPlans(operatorEmail);
  
  // Return appropriate data based on migration status
  return useQuery({
    queryKey: ["/api/unified-feeding", penId, operatorEmail],
    queryFn: async () => {
      if (migrationStatus?.migrated) {
        // Use new system
        const res = await apiRequest("GET", `/api/pens/${penId}/feeding-program/active`);
        const program = await res.json() as PenFeedingProgram | null;
        return { type: 'new', data: program };
      } else if (migrationStatus?.hasOldData) {
        // Use old system data
        const penPlans = oldPlans?.filter(plan => plan.penId === penId) || [];
        return { type: 'old', data: penPlans };
      }
      return { type: 'none', data: null };
    },
    enabled: !!penId && !!operatorEmail && migrationStatus !== undefined,
  });
}