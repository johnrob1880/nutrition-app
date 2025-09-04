import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Scale, 
  Wheat, 
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Target
} from "lucide-react";
import type { FeedingPlan, FeedingRecord, Pen } from "@shared/schema";

interface FeedingPlanDetailsProps {
  operatorEmail: string;
}

export default function FeedingPlanDetails({ operatorEmail }: FeedingPlanDetailsProps) {
  const { penId } = useParams();

  // Fetch pen details
  const { data: pens = [] } = useQuery<Pen[]>({
    queryKey: ["/api/pens", operatorEmail],
  });

  // Fetch feeding plans
  const { data: feedingPlans = [] } = useQuery<FeedingPlan[]>({
    queryKey: ["/api/schedules", operatorEmail],
  });

  // Fetch feeding records
  const { data: feedingRecords = [] } = useQuery<FeedingRecord[]>({
    queryKey: ["/api/feeding-records", operatorEmail],
  });

  const currentPen = pens.find(p => p.id === penId);
  const penFeedingPlan = feedingPlans.find(plan => plan.penId === penId);
  const penFeedingRecords = feedingRecords.filter(record => record.penId === penId);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (timeStr: string) => {
    return new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatNumber = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return value.toString();
    // Check if it's a whole number (including cases like 24.0)
    if (num === Math.floor(num)) return Math.floor(num).toString();
    return num.toFixed(2);
  };

  const getVarianceColor = (planned: number, actual: number) => {
    const variance = ((actual - planned) / planned) * 100;
    if (Math.abs(variance) <= 5) return "text-green-600";
    if (Math.abs(variance) <= 10) return "text-yellow-600";
    return "text-red-600";
  };

  const getVarianceIcon = (planned: number, actual: number) => {
    const variance = ((actual - planned) / planned) * 100;
    if (Math.abs(variance) <= 5) return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    return <AlertCircle className="h-4 w-4 text-yellow-600" />;
  };

  if (!currentPen) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 pb-24">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-8">
            <p className="text-gray-600">Pen not found</p>
            <Link href="/pens">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Pens
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/pens">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{currentPen.name} - Feeding Plan</h1>
              <p className="text-gray-600">{penFeedingPlan?.planName || 'No active plan'}</p>
            </div>
          </div>
        </div>

        {/* Pen Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="h-5 w-5 mr-2" />
              Pen Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Cattle Count</p>
                <p className="text-xl font-bold">{currentPen.current} head</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Feed Type</p>
                <p className="text-lg font-medium">{currentPen.feedType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Current Weight</p>
                <p className="text-xl font-bold">{currentPen.currentWeight} lbs</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Records</p>
                <p className="text-xl font-bold text-primary">{penFeedingRecords.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feeding Plan Details */}
        {penFeedingPlan && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Current Feeding Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Plan Name</p>
                    <p className="font-semibold">{penFeedingPlan.planName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <Badge className={
                      penFeedingPlan.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }>
                      {penFeedingPlan.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Progress</p>
                    <p className="font-semibold">
                      Day {penFeedingPlan.currentDay} of {penFeedingPlan.daysToFeed}
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-3">Daily Schedules</h3>
                  <div className="space-y-3">
                    {penFeedingPlan.schedules.map((schedule, index) => (
                      <div key={schedule.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span className="font-medium">{formatTime(schedule.time)}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Scale className="h-4 w-4 text-gray-500" />
                            <span className="font-medium">{schedule.totalAmount}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-700">Ingredients:</h4>
                          {schedule.ingredients.map((ingredient, ingredientIndex) => (
                            <div key={ingredientIndex} className="flex justify-between text-sm">
                              <span>{ingredient.name}</span>
                              <span className="font-medium">
                                {ingredient.amount} {ingredient.unit} ({ingredient.percentage})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Feeding Records */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Feeding History ({penFeedingRecords.length} records)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {penFeedingRecords.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Wheat className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No feeding records found</p>
                <p className="text-sm">Records will appear here after feeding sessions</p>
              </div>
            ) : (
              <div className="space-y-4">
                {penFeedingRecords
                  .sort((a, b) => new Date(b.feedingTime).getTime() - new Date(a.feedingTime).getTime())
                  .map((record) => (
                    <div key={record.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">
                            {formatDate(record.feedingTime)} at {formatTime(record.feedingTime.split('T')[1])}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getVarianceIcon(
                            parseFloat(record.plannedAmount),
                            record.actualIngredients.reduce((sum, ing) => sum + parseFloat(ing.actualAmount), 0)
                          )}
                          <span className="text-sm text-gray-600">
                            Total: {formatNumber(record.actualIngredients.reduce((sum, ing) => sum + parseFloat(ing.actualAmount), 0))} lbs
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-700">Ingredient Details:</h4>
                        {record.actualIngredients.map((ingredient, index) => {
                          const planned = parseFloat(ingredient.plannedAmount);
                          const actual = parseFloat(ingredient.actualAmount);
                          const variance = ((actual - planned) / planned) * 100;
                          
                          return (
                            <div key={index} className="flex justify-between items-center text-sm">
                              <span className="font-medium">{ingredient.name}</span>
                              <div className="flex items-center space-x-2">
                                <span className="text-gray-600">
                                  {formatNumber(ingredient.actualAmount)} / {formatNumber(ingredient.plannedAmount)} {ingredient.unit}
                                </span>
                                <span className={`font-medium ${getVarianceColor(planned, actual)}`}>
                                  {variance > 0 ? '+' : ''}{variance % 1 === 0 ? variance.toString() : variance.toFixed(2)}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}