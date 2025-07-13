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
      // Invalidate and refetch pens data to reflect the sold cattle
      queryClient.invalidateQueries({ queryKey: ["/api/pens", variables.operatorEmail] });
      // Invalidate dashboard stats as they may have changed
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard", variables.operatorEmail] });
    },
  });
}