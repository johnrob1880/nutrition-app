import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Save, Clock, Weight, Expand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { FeedingPlan, FeedingSchedule, InsertFeedingRecord, ActualIngredient, Operation, Pen } from "@shared/schema";

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

  // Get pen data to calculate total amounts
  const { data: pens } = useQuery<Pen[]>({
    queryKey: ["/api/pens", operatorEmail],
  });

  // Find the specific schedule and pen
  const currentPlan = feedingPlans?.find(plan => plan.penId === penId);
  const currentSchedule = currentPlan?.schedules.find(schedule => schedule.id === scheduleId);
  const currentPen = pens?.find(pen => pen.id === penId);

  // State for ingredient inputs
  const [actualIngredients, setActualIngredients] = useState<ActualIngredient[]>([]);
  const [currentIngredientIndex, setCurrentIngredientIndex] = useState(0);
  const [isFullScreenModal, setIsFullScreenModal] = useState(false);

  // Helper function to calculate total amount from per-head amount
  const calculateTotalAmount = (perHeadAmount: string, cattleCount: number): string => {
    const numericAmount = parseFloat(perHeadAmount);
    if (isNaN(numericAmount)) return perHeadAmount;
    return (numericAmount * cattleCount).toString();
  };

  // Helper function to calculate per-head amount from total amount
  const calculatePerHeadAmount = (totalAmount: string, cattleCount: number): string => {
    const numericAmount = parseFloat(totalAmount);
    if (isNaN(numericAmount) || cattleCount === 0) return totalAmount;
    return (numericAmount / cattleCount).toString();
  };

  // Initialize actual ingredients when schedule loads
  useEffect(() => {
    if (currentSchedule && currentPen && actualIngredients.length === 0) {
      const initialIngredients = currentSchedule.ingredients.map(ingredient => {
        const totalPlannedAmount = calculateTotalAmount(ingredient.amount, currentPen.current);
        return {
          name: ingredient.name,
          plannedAmount: totalPlannedAmount,
          actualAmount: totalPlannedAmount, // Default to planned total amount
          unit: ingredient.unit,
          category: ingredient.category,
        };
      });
      setActualIngredients(initialIngredients);
    }
  }, [currentSchedule, currentPen, actualIngredients.length]);

  // Update ingredient actual amount
  const updateIngredientAmount = (index: number, actualAmount: string) => {
    setActualIngredients(prev => 
      prev.map((ingredient, i) => 
        i === index ? { ...ingredient, actualAmount } : ingredient
      )
    );
  };

  // Wizard navigation functions
  const goToNextIngredient = () => {
    if (currentIngredientIndex < actualIngredients.length - 1) {
      setCurrentIngredientIndex(currentIngredientIndex + 1);
    }
  };

  const goToPreviousIngredient = () => {
    if (currentIngredientIndex > 0) {
      setCurrentIngredientIndex(currentIngredientIndex - 1);
    }
  };



  // Numeric keypad functionality
  const addToCurrentAmount = (digit: string) => {
    const currentIngredient = actualIngredients[currentIngredientIndex];
    if (!currentIngredient) return;
    
    const currentAmount = currentIngredient.actualAmount || '';
    const plannedAmount = currentIngredient.plannedAmount;
    
    // Clear default value on first input if it matches planned amount
    if (currentAmount === plannedAmount) {
      if (digit === '.') {
        updateIngredientAmount(currentIngredientIndex, '0.');
      } else {
        updateIngredientAmount(currentIngredientIndex, digit);
      }
      return;
    }
    
    // Normal input handling
    if (digit === '.') {
      if (currentAmount.includes('.')) return; // Prevent multiple decimals
    }
    updateIngredientAmount(currentIngredientIndex, currentAmount + digit);
  };

  const removeLastDigit = () => {
    const currentAmount = actualIngredients[currentIngredientIndex]?.actualAmount || '';
    updateIngredientAmount(currentIngredientIndex, currentAmount.slice(0, -1));
  };

  const clearAmount = () => {
    updateIngredientAmount(currentIngredientIndex, '');
  };

  // Check if all ingredients have amounts
  const allIngredientsCompleted = actualIngredients.every(ingredient => 
    ingredient.actualAmount && parseFloat(ingredient.actualAmount) > 0
  );

  // Submit feeding record
  const submitFeeding = useMutation({
    mutationFn: async (feedingRecord: InsertFeedingRecord) => {
      const response = await apiRequest("POST", "/api/feeding-records", feedingRecord);
      return response;
    },
    onSuccess: () => {
      // Invalidate feeding records cache to refresh dashboard
      queryClient.invalidateQueries({ queryKey: ["/api/feeding-records", operatorEmail] });
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
    if (!operation || !currentSchedule || !currentPlan || !currentPen) {
      toast({
        title: "Error", 
        description: "Missing required data to submit feeding record.",
        variant: "destructive",
      });
      return;
    }

    // Convert total amounts back to per-head amounts for storage
    const perHeadIngredients = actualIngredients.map(ingredient => ({
      ...ingredient,
      actualAmount: calculatePerHeadAmount(ingredient.actualAmount, currentPen.current),
      plannedAmount: calculatePerHeadAmount(ingredient.plannedAmount, currentPen.current),
    }));

    const feedingRecord: InsertFeedingRecord = {
      operationId: operation.id,
      penId: penId!,
      scheduleId: scheduleId!,
      plannedAmount: currentSchedule.totalAmount,
      actualIngredients: perHeadIngredients,
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
              {currentPen && (
                <p className="text-xs text-gray-500 mt-1">{currentPen.current} head of cattle</p>
              )}
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
                <p className="text-gray-600">Planned Total Amount</p>
                <p className="font-medium">
                  {currentPen ? 
                    calculateTotalAmount(currentSchedule.totalAmount.split(' ')[0], currentPen.current) + ' ' + currentSchedule.totalAmount.split(' ')[1]
                    : currentSchedule.totalAmount
                  }
                </p>
                {currentPen && (
                  <p className="text-xs text-gray-500 mt-1">
                    ({currentSchedule.totalAmount} per head)
                  </p>
                )}
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

        {/* Ingredients - Touch Input */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Ingredient {currentIngredientIndex + 1} of {actualIngredients.length}
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsFullScreenModal(true)}
                className="p-2"
              >
                <Expand className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {actualIngredients[currentIngredientIndex] && (
              <>
                {/* Ingredient Info */}
                <div className="text-center">
                  <h3 className="font-semibold text-lg mb-3">
                    {actualIngredients[currentIngredientIndex].name}
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-xs text-gray-600 mb-2">Actual / Planned ({actualIngredients[currentIngredientIndex].unit})</div>
                    <div className="text-3xl font-bold font-mono">
                      <span className="text-green-600">
                        {actualIngredients[currentIngredientIndex].actualAmount || '0'}
                      </span>
                      <span className="text-gray-400 mx-2">/</span>
                      <span className="text-blue-600">
                        {actualIngredients[currentIngredientIndex].plannedAmount}
                      </span>
                    </div>
                    {currentPen && (
                      <div className="text-xs text-gray-500 mt-2">
                        ({calculatePerHeadAmount(actualIngredients[currentIngredientIndex].actualAmount || '0', currentPen.current)} / {calculatePerHeadAmount(actualIngredients[currentIngredientIndex].plannedAmount, currentPen.current)} per head)
                      </div>
                    )}
                  </div>
                </div>

                {/* Numeric Keypad */}
                <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <Button
                      key={digit}
                      variant="outline"
                      size="lg"
                      className="h-12 text-lg"
                      onClick={() => addToCurrentAmount(digit)}
                    >
                      {digit}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-12 text-lg"
                    onClick={() => addToCurrentAmount('.')}
                  >
                    .
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-12 text-lg"
                    onClick={() => addToCurrentAmount('0')}
                  >
                    0
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-12 text-lg"
                    onClick={removeLastDigit}
                  >
                    ⌫
                  </Button>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
                  <Button
                    variant="destructive"
                    onClick={clearAmount}
                    size="sm"
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={() => updateIngredientAmount(currentIngredientIndex, actualIngredients[currentIngredientIndex].plannedAmount)}
                    variant="secondary"
                    size="sm"
                  >
                    Use Planned
                  </Button>
                </div>

                {/* Navigation */}
                <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
                  <Button
                    variant="outline"
                    onClick={goToPreviousIngredient}
                    disabled={currentIngredientIndex === 0}
                    size="sm"
                  >
                    Previous
                  </Button>
                  
                  {currentIngredientIndex < actualIngredients.length - 1 ? (
                    <Button
                      onClick={goToNextIngredient}
                      size="sm"
                    >
                      Next
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSubmit}
                      size="sm"
                      disabled={submitFeeding.isPending || !allIngredientsCompleted}
                    >
                      {submitFeeding.isPending ? "Saving..." : "Complete"}
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>


      </div>

      {/* Full Screen Modal */}
      <Dialog open={isFullScreenModal} onOpenChange={setIsFullScreenModal}>
        <DialogContent className="max-w-full max-h-full w-screen h-screen p-0 flex flex-col">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-2xl">
              Ingredient {currentIngredientIndex + 1} of {actualIngredients.length}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 px-6 pb-6 overflow-auto">
            {actualIngredients[currentIngredientIndex] && (
              <div className="space-y-8 max-w-md mx-auto">
                {/* Ingredient Info */}
                <div className="text-center">
                  <h3 className="font-semibold text-3xl mb-4">
                    {actualIngredients[currentIngredientIndex].name}
                  </h3>
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <div className="text-sm text-gray-600 mb-3">Actual / Planned ({actualIngredients[currentIngredientIndex].unit})</div>
                    <div className="text-5xl font-bold font-mono">
                      <span className="text-green-600">
                        {actualIngredients[currentIngredientIndex].actualAmount || '0'}
                      </span>
                      <span className="text-gray-400 mx-3">/</span>
                      <span className="text-blue-600">
                        {actualIngredients[currentIngredientIndex].plannedAmount}
                      </span>
                    </div>
                    {currentPen && (
                      <div className="text-sm text-gray-500 mt-3">
                        ({calculatePerHeadAmount(actualIngredients[currentIngredientIndex].actualAmount || '0', currentPen.current)} / {calculatePerHeadAmount(actualIngredients[currentIngredientIndex].plannedAmount, currentPen.current)} per head)
                      </div>
                    )}
                  </div>
                </div>

                {/* Numeric Keypad */}
                <div className="grid grid-cols-3 gap-4">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <Button
                      key={digit}
                      variant="outline"
                      size="lg"
                      className="h-16 text-2xl font-semibold"
                      onClick={() => addToCurrentAmount(digit)}
                    >
                      {digit}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-16 text-2xl font-semibold"
                    onClick={() => addToCurrentAmount('.')}
                  >
                    .
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-16 text-2xl font-semibold"
                    onClick={() => addToCurrentAmount('0')}
                  >
                    0
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-16 text-2xl font-semibold"
                    onClick={removeLastDigit}
                  >
                    ⌫
                  </Button>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant="destructive"
                    onClick={clearAmount}
                    className="h-14 text-lg"
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={() => updateIngredientAmount(currentIngredientIndex, actualIngredients[currentIngredientIndex].plannedAmount)}
                    variant="secondary"
                    className="h-14 text-lg"
                  >
                    Use Planned
                  </Button>
                </div>

                {/* Navigation */}
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={goToPreviousIngredient}
                    disabled={currentIngredientIndex === 0}
                    className="flex-1 h-14 text-lg"
                  >
                    Previous
                  </Button>
                  
                  {currentIngredientIndex < actualIngredients.length - 1 ? (
                    <Button
                      onClick={goToNextIngredient}
                      className="flex-1 h-14 text-lg"
                    >
                      Next
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        setIsFullScreenModal(false);
                        handleSubmit();
                      }}
                      className="flex-1 h-14 text-lg"
                      disabled={submitFeeding.isPending || !allIngredientsCompleted}
                    >
                      {submitFeeding.isPending ? "Saving..." : "Complete"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}