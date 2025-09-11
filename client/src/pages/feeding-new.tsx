import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Save, Clock, Weight, Expand, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  useActivePenFeedingProgram, 
  useCalculateCurrentPhase, 
  useRecordVariance,
  useMarkFeedingComplete,
  useFeedingCompletionStatus
} from "@/hooks/use-feeding-program";
import type { 
  PenFeedingProgram, 
  PenFeedingProgramIngredient,
  InsertFeedingRecordVariance,
  InsertDailyFeedingCompletionStatus,
  Operation, 
  Pen 
} from "@shared/schema";

interface FeedingProps {
  operatorEmail: string;
}

interface ActualIngredient {
  ingredientId: string;
  name: string;
  plannedAmount: number;
  actualAmount: string;
  unit: string;
  variancePercent?: number;
  reason?: string;
}

export default function FeedingNew({ operatorEmail }: FeedingProps) {
  const { penId, feedingTime } = useParams(); // feedingTime like "06:00" instead of scheduleId
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get operation data to access operation ID
  const { data: operation } = useQuery<Operation>({
    queryKey: ["/api/operation", operatorEmail],
  });

  // Get pen data
  const { data: pens } = useQuery<Pen[]>({
    queryKey: ["/api/pens", operatorEmail],
  });
  const currentPen = pens?.find(pen => pen.id === Number(penId));

  // Get active feeding program for the pen
  const { data: program, isLoading: programLoading } = useActivePenFeedingProgram(Number(penId));
  
  // Get current phase and ingredients
  const { data: currentPhaseData } = useCalculateCurrentPhase(program);
  
  // Get today's completion status
  const today = new Date().toISOString().split('T')[0];
  const { data: completionStatus } = useFeedingCompletionStatus(program?.id || "", today);
  
  // Check if this feeding time is already completed
  const isAlreadyCompleted = completionStatus?.some(status => 
    status.feedingTime === feedingTime && status.completedAt
  );

  // State for ingredient inputs
  const [actualIngredients, setActualIngredients] = useState<ActualIngredient[]>([]);
  const [currentIngredientIndex, setCurrentIngredientIndex] = useState(0);
  const [isFullScreenModal, setIsFullScreenModal] = useState(false);
  const [varianceReason, setVarianceReason] = useState("");
  const [showVarianceDialog, setShowVarianceDialog] = useState(false);

  // Mutation hooks
  const recordVariance = useRecordVariance();
  const markComplete = useMarkFeedingComplete();

  // Initialize actual ingredients when phase loads
  useEffect(() => {
    if (currentPhaseData?.phase?.ingredients && actualIngredients.length === 0) {
      const initialIngredients: ActualIngredient[] = currentPhaseData.phase.ingredients.map(ingredient => ({
        ingredientId: ingredient.ingredientId,
        name: ingredient.ingredientName || `Ingredient ${ingredient.ingredientId}`,
        plannedAmount: Number(ingredient.percentageOfRation) * (currentPhaseData.phase.targetMcalPerRation || 0) / 100,
        actualAmount: (Number(ingredient.percentageOfRation) * (currentPhaseData.phase.targetMcalPerRation || 0) / 100).toString(),
        unit: "lbs", // Default unit
      }));
      setActualIngredients(initialIngredients);
    }
  }, [currentPhaseData?.phase?.ingredients, actualIngredients.length]);

  // Update ingredient actual amount and calculate variance
  const updateIngredientAmount = (index: number, actualAmount: string) => {
    setActualIngredients(prev => 
      prev.map((ingredient, i) => {
        if (i === index) {
          const actual = parseFloat(actualAmount) || 0;
          const variancePercent = ingredient.plannedAmount > 0 
            ? ((actual - ingredient.plannedAmount) / ingredient.plannedAmount) * 100 
            : 0;
          
          return { 
            ...ingredient, 
            actualAmount,
            variancePercent: Math.round(variancePercent * 10) / 10
          };
        }
        return ingredient;
      })
    );
  };

  // Numeric keypad functionality (same as before)
  const addToCurrentAmount = (digit: string) => {
    const currentIngredient = actualIngredients[currentIngredientIndex];
    if (!currentIngredient) return;
    
    const currentAmount = currentIngredient.actualAmount || '';
    const plannedAmount = currentIngredient.plannedAmount.toString();
    
    if (currentAmount === plannedAmount) {
      if (digit === '.') {
        updateIngredientAmount(currentIngredientIndex, '0.');
      } else {
        updateIngredientAmount(currentIngredientIndex, digit);
      }
      return;
    }
    
    if (digit === '.') {
      if (currentAmount.includes('.')) return;
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

  // Navigation functions
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

  // Check if all ingredients have amounts
  const allIngredientsCompleted = actualIngredients.every(ingredient => 
    ingredient.actualAmount && parseFloat(ingredient.actualAmount) > 0
  );

  // Check if any ingredient has significant variance (>10%)
  const hasSignificantVariance = actualIngredients.some(ingredient => 
    Math.abs(ingredient.variancePercent || 0) > 10
  );

  // Submit feeding with variance-only recording
  const handleSubmit = async () => {
    if (!operation || !program || !currentPhaseData) {
      toast({
        title: "Error", 
        description: "Missing required data to submit feeding record.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Record variances for ingredients that differ from planned (only if > 0.1% difference)
      const variancePromises = actualIngredients
        .filter(ingredient => {
          const variancePercent = Math.abs(ingredient.variancePercent || 0);
          return variancePercent > 0.1; // Only record if > 0.1% variance
        })
        .map(ingredient => {
          const varianceData: InsertFeedingRecordVariance = {
            penProgramId: program.id,
            penId: Number(penId),
            ingredientId: ingredient.ingredientId,
            recordedByUserId: operation.id, // Assuming operation.id is user ID
            date: today,
            feedingTime: feedingTime!,
            plannedAmount: ingredient.plannedAmount.toString(),
            actualAmount: ingredient.actualAmount,
            varianceAmount: (parseFloat(ingredient.actualAmount) - ingredient.plannedAmount).toString(),
            variancePercentage: (ingredient.variancePercent || 0).toString(),
          };
          
          return recordVariance.mutateAsync(varianceData);
        });

      await Promise.all(variancePromises);

      // Mark feeding as complete
      const completionData: InsertDailyFeedingCompletionStatus = {
        penProgramId: program.id,
        completedByUserId: operation.id,
        date: today,
        feedingTime: feedingTime!,
      };

      await markComplete.mutateAsync(completionData);

      toast({
        title: "Feeding Completed",
        description: variancePromises.length > 0 
          ? `Feeding completed with ${variancePromises.length} variance(s) recorded.`
          : "Feeding completed exactly as planned.",
      });
      
      setLocation("/dashboard");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save feeding record. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (programLoading) {
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

  if (!program || !currentPhaseData) {
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
              <p className="text-gray-500">No active feeding program found for this pen</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isAlreadyCompleted) {
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
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Feeding Already Completed</h2>
              <p className="text-gray-500">This feeding time has already been recorded for today.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentIngredient = actualIngredients[currentIngredientIndex];

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
              <h1 className="text-xl font-semibold">
                {currentPen?.name || `Pen ${penId}`} - {feedingTime}
              </h1>
              <p className="text-gray-600">
                {program.programName} - {currentPhaseData.phase.phaseName}
              </p>
              <p className="text-sm text-gray-500">
                Day {currentPhaseData.dayInPhase} of {currentPhaseData.phase.durationDays}
              </p>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="mb-1">
                <Clock className="h-3 w-3 mr-1" />
                {feedingTime}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Ingredient Input */}
      <div className="px-6 py-4">
        {currentIngredient && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {currentIngredient.name}
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFullScreenModal(true)}
                >
                  <Expand className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-gray-600">
                Ingredient {currentIngredientIndex + 1} of {actualIngredients.length}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Planned Amount</Label>
                    <div className="text-2xl font-bold">
                      {currentIngredient.plannedAmount} {currentIngredient.unit}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Actual Amount</Label>
                    <Input
                      value={currentIngredient.actualAmount}
                      onChange={(e) => updateIngredientAmount(currentIngredientIndex, e.target.value)}
                      className="text-2xl font-bold h-12"
                      placeholder="0.0"
                      type="number"
                      step="0.1"
                    />
                  </div>
                </div>

                {/* Variance Display */}
                {currentIngredient.variancePercent !== undefined && Math.abs(currentIngredient.variancePercent) > 0.1 && (
                  <div className={`p-3 rounded-lg ${
                    Math.abs(currentIngredient.variancePercent) > 10 
                      ? 'bg-yellow-50 border-yellow-200' 
                      : 'bg-blue-50 border-blue-200'
                  } border`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        Variance: {currentIngredient.variancePercent > 0 ? '+' : ''}{currentIngredient.variancePercent}%
                      </span>
                      {Math.abs(currentIngredient.variancePercent) > 10 && (
                        <Badge variant="destructive">Significant</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {currentIngredient.variancePercent > 0 ? 'Over' : 'Under'} planned amount by {' '}
                      {Math.abs(parseFloat(currentIngredient.actualAmount) - currentIngredient.plannedAmount).toFixed(1)} {currentIngredient.unit}
                    </p>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={goToPreviousIngredient}
                    disabled={currentIngredientIndex === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    onClick={goToNextIngredient}
                    disabled={currentIngredientIndex === actualIngredients.length - 1}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Feeding Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {actualIngredients.map((ingredient, index) => (
                <div key={ingredient.ingredientId} className="flex justify-between items-center">
                  <span className={index === currentIngredientIndex ? 'font-semibold' : ''}>
                    {ingredient.name}
                  </span>
                  <div className="text-right">
                    <span>{ingredient.actualAmount || '0'} {ingredient.unit}</span>
                    {ingredient.variancePercent !== undefined && Math.abs(ingredient.variancePercent) > 0.1 && (
                      <span className="text-xs text-gray-500 ml-2">
                        ({ingredient.variancePercent > 0 ? '+' : ''}{ingredient.variancePercent}%)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Variance Reason (if significant variance) */}
        {hasSignificantVariance && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-yellow-700">Variance Reason Required</CardTitle>
              <p className="text-sm text-gray-600">
                Please provide a reason for the significant variance (>10%).
              </p>
            </CardHeader>
            <CardContent>
              <Textarea
                value={varianceReason}
                onChange={(e) => setVarianceReason(e.target.value)}
                placeholder="e.g., Weather conditions, equipment issues, cattle behavior..."
                rows={3}
              />
            </CardContent>
          </Card>
        )}

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={!allIngredientsCompleted || (hasSignificantVariance && !varianceReason.trim()) || recordVariance.isPending || markComplete.isPending}
          className="w-full"
          size="lg"
        >
          <Save className="h-4 w-4 mr-2" />
          {recordVariance.isPending || markComplete.isPending ? 'Saving...' : 'Complete Feeding'}
        </Button>
      </div>

      {/* Numeric Keypad Modal */}
      <Dialog open={isFullScreenModal} onOpenChange={setIsFullScreenModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{currentIngredient?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold mb-2">
                {currentIngredient?.actualAmount || '0'} {currentIngredient?.unit}
              </div>
              <div className="text-sm text-gray-600">
                Planned: {currentIngredient?.plannedAmount} {currentIngredient?.unit}
              </div>
            </div>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((key) => (
                <Button
                  key={key}
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    if (key === '⌫') {
                      removeLastDigit();
                    } else {
                      addToCurrentAmount(key);
                    }
                  }}
                  className="h-12 text-xl"
                >
                  {key}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={clearAmount}>
                Clear
              </Button>
              <Button onClick={() => setIsFullScreenModal(false)}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}