import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Pen, UpdateWeightRequest } from "@shared/schema";

export function useUpdatePenWeight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ penId, newWeight, operatorEmail }: UpdateWeightRequest) => {
      const res = await apiRequest("PATCH", `/api/pens/${penId}/weight`, {
        newWeight,
        operatorEmail
      });
      return res.json();
    },
    onSuccess: (data: Pen, variables) => {
      // Invalidate and refetch pen data
      queryClient.invalidateQueries({ queryKey: ["/api/pens", variables.operatorEmail] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard", variables.operatorEmail] });
    },
  });
}