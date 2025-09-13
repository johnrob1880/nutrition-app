import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { InsertCattleSale, CattleSale } from "@shared/schema";

export function useSellCattle() {
  const queryClient = useQueryClient();

  return useMutation<CattleSale, Error, InsertCattleSale>({
    mutationFn: async (saleData: InsertCattleSale) => {
      const response = await apiRequest("POST", "/api/cattle-sales", saleData);
      return response.json();
    },
    onSuccess: (data: CattleSale, variables) => {
      // For now, we need to get operationId from localStorage since InsertCattleSale doesn't include it
      const operationId = localStorage.getItem("operationId");
      if (operationId) {
        // Invalidate and refetch pens data to reflect the sold cattle
        queryClient.invalidateQueries({ queryKey: ["/api/pens", Number(operationId)] });
        // Invalidate cattle sales data to show the new sale
        queryClient.invalidateQueries({ queryKey: ["/api/cattle-sales", Number(operationId)] });
        // Invalidate dashboard stats as they may have changed
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard", Number(operationId)] });
      }
    },
  });
}