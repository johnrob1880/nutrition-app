import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Save, Clock, Weight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { FeedingPlan, FeedingSchedule, InsertFeedingRecord, ActualIngredient, Operation } from "@shared/schema";

interface FeedingProps {
  operatorEmail: string;
}

export default function Feeding({ operatorEmail }: FeedingProps) {
  const { penId, scheduleId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get operation data to access operation ID
  const { data: operation } = useQuery<Operation>({
    queryKey: ["/api/operation", operatorEmail],
  });

  // Get feeding plans to find the specific schedule
  const { data: feedingPlans, isLoading } = useQuery<FeedingPlan[]>({
    queryKey: ["/api/schedules", operatorEmail],
  });

  // Find the specific schedule
  const currentPlan = feedingPlans?.find(plan => plan.penId === penId);
  const currentSchedule = currentPlan?.schedules.find(schedule => schedule.id === scheduleId);

  // State for ingredient inputs
  const [actualIngredients, setActualIngredients] = useState<ActualIngredient[]>([]);

  // Initialize actual ingredients when schedule loads
  useEffect(() => {
    if (currentSchedule && actualIngredients.length === 0) {
      const initialIngredients = currentSchedule.ingredients.map(ingredient => ({
        name: ingredient.name,
        plannedAmount: ingredient.amount,
        actualAmount: ingredient.amount, // Default to planned amount
        unit: ingredient.unit,
        category: ingredient.category,
      }));
      setActualIngredients(initialIngredients);
    }
  }, [currentSchedule, actualIngredients.length]);

  // Update ingredient actual amount
  const updateIngredientAmount = (index: number, actualAmount: string) => {
    setActualIngredients(prev => 
      prev.map((ingredient, i) => 
        i === index ? { ...ingredient, actualAmount } : ingredient
      )
    );
  };

  // Submit feeding record
  const submitFeeding = useMutation({
    mutationFn: async (feedingRecord: InsertFeedingRecord) => {
      const response = await apiRequest("/api/feeding-records", {
        method: "POST",
        body: JSON.stringify(feedingRecord),
        headers: { "Content-Type": "application/json" },
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Feeding Completed",
        description: "Feeding record has been saved successfully.",
      });
      setLocation("/dashboard");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save feeding record. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!operation || !currentSchedule || !currentPlan) {
      toast({
        title: "Error", 
        description: "Missing required data to submit feeding record.",
        variant: "destructive",
      });
      return;
    }

    const feedingRecord: InsertFeedingRecord = {
      operationId: operation.id,
      penId: penId!,
      scheduleId: scheduleId!,
      plannedAmount: currentSchedule.totalAmount,
      actualIngredients,
      operatorEmail,
    };

    submitFeeding.mutate(feedingRecord);
  };

  if (isLoading) {
    return (
      <div className="pb-20">
        <div className="bg-white shadow-sm">
          <div className="px-6 py-4">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentSchedule || !currentPlan) {
    return (
      <div className="pb-20">
        <div className="bg-white shadow-sm">
          <div className="px-6 py-4">
            <Button 
              variant="ghost" 
              onClick={() => setLocation("/dashboard")}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="text-center py-8">
              <p className="text-gray-500">Feeding schedule not found</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="px-6 py-4">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Start Feeding</h1>
              <p className="text-sm text-gray-600">{currentPlan.penName} - {currentPlan.feedType}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-1 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                <span>{currentSchedule.time}</span>
              </div>
              <div className="flex items-center space-x-1 text-sm text-gray-600 mt-1">
                <Weight className="h-4 w-4" />
                <span>{currentSchedule.totalAmount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Info */}
      <div className="p-6">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Feeding Schedule Details</span>
              <Badge variant="outline">{currentPlan.planName}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Planned Amount</p>
                <p className="font-medium">{currentSchedule.totalAmount}</p>
              </div>
              <div>
                <p className="text-gray-600">Time</p>
                <p className="font-medium">{currentSchedule.time}</p>
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <div>
              <p className="text-gray-600 mb-2">Nutritional Profile</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span>Protein:</span>
                  <span className="font-medium">{currentSchedule.totalNutrition.protein}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fat:</span>
                  <span className="font-medium">{currentSchedule.totalNutrition.fat}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fiber:</span>
                  <span className="font-medium">{currentSchedule.totalNutrition.fiber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Moisture:</span>
                  <span className="font-medium">{currentSchedule.totalNutrition.moisture}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ingredients */}
        <Card>
          <CardHeader>
            <CardTitle>Ingredients</CardTitle>
            <p className="text-sm text-gray-600">Enter the actual amount used for each ingredient</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {actualIngredients.map((ingredient, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium">{ingredient.name}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {ingredient.category}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600">
                      Planned: {ingredient.plannedAmount} {ingredient.unit}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`ingredient-${index}`}>
                      Actual Amount ({ingredient.unit})
                    </Label>
                    <Input
                      id={`ingredient-${index}`}
                      type="number"
                      step="0.1"
                      placeholder={ingredient.plannedAmount}
                      value={ingredient.actualAmount}
                      onChange={(e) => updateIngredientAmount(index, e.target.value)}
                      className="max-w-32"
                    />
                  </div>
                  
                  {currentSchedule.ingredients[index]?.nutritionalValue && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-gray-600 mb-2">Nutritional Info:</p>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                        {Object.entries(currentSchedule.ingredients[index].nutritionalValue!).map(([key, value]) => (
                          value && (
                            <div key={key} className="flex justify-between">
                              <span className="capitalize">{key}:</span>
                              <span>{value}</span>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="mt-6 flex justify-center">
          <Button 
            onClick={handleSubmit}
            disabled={submitFeeding.isPending}
            className="w-full max-w-md"
            size="lg"
          >
            <Save className="h-4 w-4 mr-2" />
            {submitFeeding.isPending ? "Saving..." : "Complete Feeding"}
          </Button>
        </div>
      </div>
    </div>
  );
}