import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Operation, InsertOperation } from "@shared/schema";

export function useOperation(email: string) {
  return useQuery<Operation | null>({
    queryKey: ["/api/operation", email],
    enabled: !!email,
  });
}

export function useCreateOperation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (operation: InsertOperation) => {
      const res = await apiRequest("POST", "/api/operations", operation);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/operation"] });
    },
  });
}

export function useUpdateOperation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertOperation> }) => {
      const res = await apiRequest("PATCH", `/api/operations/${id}`, data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/operation"] });
    },
  });
}
