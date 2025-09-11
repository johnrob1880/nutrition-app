import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

import {
  useFeedingIngredients,
  useCreateFeedingIngredient,
  useUpdateFeedingIngredient,
  useDeleteFeedingIngredient,
} from '@/hooks/use-feeding-ingredients';

// Form validation schema
const ingredientSchema = z.object({
  name: z.string().min(1, 'Ingredient name is required'),
  proteinPercent: z.number().min(0, 'Protein percent must be 0 or greater').max(100, 'Protein percent cannot exceed 100'),
  dryMatterPercent: z.number().min(0, 'Dry matter percent must be 0 or greater').max(100, 'Dry matter percent cannot exceed 100'),
});

type IngredientFormData = z.infer<typeof ingredientSchema>;

interface IngredientFormProps {
  ingredient?: any;
  onSuccess: () => void;
  isUpdate?: boolean;
}

function IngredientForm({ ingredient, onSuccess, isUpdate = false }: IngredientFormProps) {
  const createMutation = useCreateFeedingIngredient();
  const updateMutation = useUpdateFeedingIngredient();
  
  const form = useForm<IngredientFormData>({
    resolver: zodResolver(ingredientSchema),
    defaultValues: {
      name: ingredient?.name || '',
      proteinPercent: ingredient?.proteinPercent || 0,
      dryMatterPercent: ingredient?.dryMatterPercent || 0,
    },
  });

  const onSubmit = async (data: IngredientFormData) => {
    try {
      if (isUpdate && ingredient) {
        await updateMutation.mutateAsync({
          id: ingredient.id,
          ...data,
        });
      } else {
        await createMutation.mutateAsync(data);
      }
      onSuccess();
    } catch (error) {
      console.error('Failed to save ingredient:', error);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Ingredient Name</Label>
        <Input
          id="name"
          {...form.register('name')}
          placeholder="e.g., Corn Silage"
        />
        {form.formState.errors.name && (
          <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="proteinPercent">Protein Percent (%)</Label>
          <Input
            id="proteinPercent"
            type="number"
            step="0.1"
            {...form.register('proteinPercent', { valueAsNumber: true })}
            placeholder="8.5"
          />
          {form.formState.errors.proteinPercent && (
            <p className="text-sm text-red-600">{form.formState.errors.proteinPercent.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="dryMatterPercent">Dry Matter Percent (%)</Label>
          <Input
            id="dryMatterPercent"
            type="number"
            step="0.1"
            {...form.register('dryMatterPercent', { valueAsNumber: true })}
            placeholder="35.0"
          />
          {form.formState.errors.dryMatterPercent && (
            <p className="text-sm text-red-600">{form.formState.errors.dryMatterPercent.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : isUpdate ? 'Update Ingredient' : 'Create Ingredient'}
        </Button>
      </div>
    </form>
  );
}

interface DeleteConfirmationProps {
  ingredient: any;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmation({ ingredient, onConfirm, onCancel }: DeleteConfirmationProps) {
  const deleteMutation = useDeleteFeedingIngredient();

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(ingredient.id);
      onConfirm();
    } catch (error) {
      console.error('Failed to delete ingredient:', error);
    }
  };

  return (
    <div className="space-y-4">
      <p>Are you sure you want to delete <strong>{ingredient.name}</strong>?</p>
      <p className="text-sm text-gray-600">This action cannot be undone.</p>
      
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          variant="destructive" 
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
        >
          {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
        </Button>
      </div>
    </div>
  );
}

export function IngredientLibraryManager() {
  const { data: ingredients, isLoading, error } = useFeedingIngredients();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'protein-asc' | 'protein-desc' | 'dryMatter-asc' | 'dryMatter-desc'>('name');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<any>(null);

  // Filter and sort ingredients
  const filteredAndSortedIngredients = useMemo(() => {
    if (!ingredients) return [];

    let filtered = ingredients.filter(ingredient =>
      ingredient.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'protein-asc':
          return a.proteinPercent - b.proteinPercent;
        case 'protein-desc':
          return b.proteinPercent - a.proteinPercent;
        case 'dryMatter-asc':
          return a.dryMatterPercent - b.dryMatterPercent;
        case 'dryMatter-desc':
          return b.dryMatterPercent - a.dryMatterPercent;
        default:
          return 0;
      }
    });

    return filtered;
  }, [ingredients, searchTerm, sortBy]);

  const handleEditClick = (ingredient: any) => {
    setSelectedIngredient(ingredient);
    setShowEditDialog(true);
  };

  const handleDeleteClick = (ingredient: any) => {
    setSelectedIngredient(ingredient);
    setShowDeleteDialog(true);
  };

  const handleDialogClose = () => {
    setShowCreateDialog(false);
    setShowEditDialog(false);
    setShowDeleteDialog(false);
    setSelectedIngredient(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Loading ingredients...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-600">Error loading ingredients</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Ingredient Library</h2>
          <p className="text-gray-600">Manage your feeding ingredients</p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Ingredient
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Ingredient</DialogTitle>
              <DialogDescription>
                Create a new feeding ingredient for your library
              </DialogDescription>
            </DialogHeader>
            <IngredientForm onSuccess={handleDialogClose} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search ingredients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Label htmlFor="sort">Sort by:</Label>
          <select
            id="sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="name">Name</option>
            <option value="protein-desc">Protein % (High to Low)</option>
            <option value="protein-asc">Protein % (Low to High)</option>
            <option value="dryMatter-desc">Dry Matter % (High to Low)</option>
            <option value="dryMatter-asc">Dry Matter % (Low to High)</option>
          </select>
        </div>
      </div>

      {/* Ingredients Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ingredient Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Protein %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dry Matter %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedIngredients.map((ingredient) => (
                  <tr key={ingredient.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{ingredient.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant="secondary">{ingredient.proteinPercent.toFixed(1)}%</Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant="outline">{ingredient.dryMatterPercent.toFixed(1)}%</Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClick(ingredient)}
                          aria-label={`Edit ${ingredient.name}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(ingredient)}
                          aria-label={`Delete ${ingredient.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredAndSortedIngredients.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No ingredients found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Ingredient</DialogTitle>
            <DialogDescription>
              Update the ingredient information
            </DialogDescription>
          </DialogHeader>
          {selectedIngredient && (
            <IngredientForm
              ingredient={selectedIngredient}
              onSuccess={handleDialogClose}
              isUpdate={true}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Ingredient</DialogTitle>
          </DialogHeader>
          {selectedIngredient && (
            <DeleteConfirmation
              ingredient={selectedIngredient}
              onConfirm={handleDialogClose}
              onCancel={handleDialogClose}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}