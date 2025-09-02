import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Plus, Building2, User } from "lucide-react";
import type { Nutritionist, CreateNutritionistRequest } from "@shared/schema";

const createNutritionistSchema = z.object({
  id: z.string().min(1, "Nutritionist ID is required"),
  personalName: z.string().min(1, "Personal name is required"),
  businessName: z.string().min(1, "Business name is required"),
});

type CreateNutritionistForm = z.infer<typeof createNutritionistSchema>;

interface NutritionistManagementProps {
  operatorEmail: string;
}

export default function NutritionistManagement({ operatorEmail }: NutritionistManagementProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  // Fetch nutritionists
  const { data: nutritionists = [], isLoading } = useQuery<Nutritionist[]>({
    queryKey: ["/api/nutritionists", operatorEmail],
    enabled: !!operatorEmail,
  });

  const form = useForm<CreateNutritionistForm>({
    resolver: zodResolver(createNutritionistSchema),
    defaultValues: {
      id: "",
      personalName: "",
      businessName: "",
    },
  });

  // Create nutritionist mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateNutritionistForm) => {
      const nutritionistData: CreateNutritionistRequest = {
        ...data,
        operatorEmail,
      };

      const response = await fetch("/api/nutritionists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(nutritionistData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create nutritionist");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionists", operatorEmail] });
      toast({
        title: "Nutritionist added successfully!",
        description: "The nutritionist can now be assigned to pens for feed management.",
      });
      form.reset();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error adding nutritionist",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateNutritionistForm) => {
    createMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Nutritionists</h3>
        </div>
        <div className="text-center py-8 text-gray-500">
          Loading nutritionists...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Nutritionists</h3>
          <p className="text-sm text-gray-600">Manage nutritionists who collaborate on feed management</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Nutritionist
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Nutritionist</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nutritionist ID *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., NUT-004" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="personalName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Personal Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Dr. John Smith" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Smith Nutrition Consulting" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "Adding..." : "Add Nutritionist"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {nutritionists.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No nutritionists added yet</p>
              <p className="text-sm text-gray-400 mb-6">
                Add nutritionists to collaborate on feed management for your pens
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {nutritionists.map((nutritionist) => (
            <Card key={nutritionist.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{nutritionist.personalName}</CardTitle>
                    <CardDescription className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4" />
                      <span>{nutritionist.businessName}</span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    ID: {nutritionist.id}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Active
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}