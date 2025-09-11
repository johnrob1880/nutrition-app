import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
interface FeedingIngredient {
  id: string;
  name: string;
  proteinPercent: number;
  dryMatterPercent: number;
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface CreateFeedingIngredientData {
  name: string;
  proteinPercent: number;
  dryMatterPercent: number;
}

interface UpdateFeedingIngredientData {
  id: string;
  name: string;
  proteinPercent: number;
  dryMatterPercent: number;
}

// API functions
const fetchFeedingIngredients = async (): Promise<FeedingIngredient[]> => {
  const response = await fetch('/api/feeding-ingredients', {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch feeding ingredients');
  }
  
  return response.json();
};

const createFeedingIngredient = async (data: CreateFeedingIngredientData): Promise<FeedingIngredient> => {
  const response = await fetch('/api/feeding-ingredients', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error('Failed to create feeding ingredient');
  }
  
  return response.json();
};

const updateFeedingIngredient = async (data: UpdateFeedingIngredientData): Promise<FeedingIngredient> => {
  const response = await fetch(`/api/feeding-ingredients/${data.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      name: data.name,
      proteinPercent: data.proteinPercent,
      dryMatterPercent: data.dryMatterPercent,
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to update feeding ingredient');
  }
  
  return response.json();
};

const deleteFeedingIngredient = async (id: string): Promise<void> => {
  const response = await fetch(`/api/feeding-ingredients/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete feeding ingredient');
  }
};

// Custom hooks
export const useFeedingIngredients = () => {
  return useQuery({
    queryKey: ['feeding-ingredients'],
    queryFn: fetchFeedingIngredients,
  });
};

export const useCreateFeedingIngredient = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createFeedingIngredient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeding-ingredients'] });
    },
  });
};

export const useUpdateFeedingIngredient = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateFeedingIngredient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeding-ingredients'] });
    },
  });
};

export const useDeleteFeedingIngredient = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteFeedingIngredient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeding-ingredients'] });
    },
  });
};