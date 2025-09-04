import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { ArrowLeft, CheckCircle, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import type { FeedingRecord, FeedingPlan } from "@shared/schema";

interface FeedingDetailsProps {
  operatorEmail: string;
}

export default function FeedingDetails({ operatorEmail }: FeedingDetailsProps) {
  const { feedingRecordId } = useParams();
  const [, setLocation] = useLocation();

  const { data: feedingRecords, isLoading: recordsLoading } = useQuery<FeedingRecord[]>({
    queryKey: ["/api/feeding-records", operatorEmail],
  });

  const { data: feedingPlans, isLoading: plansLoading } = useQuery<FeedingPlan[]>({
    queryKey: ["/api/schedules", operatorEmail],
  });

  const feedingRecord = feedingRecords?.find(record => record.id === feedingRecordId);
  const feedingPlan = feedingPlans?.find(plan => plan.penId === feedingRecord?.penId);
  const schedule = feedingPlan?.schedules.find(sch => sch.id === feedingRecord?.scheduleId);

  if (recordsLoading || plansLoading) {
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

  if (!feedingRecord || !schedule) {
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
              <p className="text-gray-500">Feeding record not found</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatNumber = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return value.toString();
    // Check if it's a whole number (including cases like 24.0)
    if (num === Math.floor(num)) return Math.floor(num).toString();
    return num.toFixed(2);
  };

  const getVarianceIndicator = (planned: string, actual: string) => {
    const plannedNum = parseFloat(planned);
    const actualNum = parseFloat(actual);
    const variance = ((actualNum - plannedNum) / plannedNum) * 100;
    
    const formattedVariance = variance % 1 === 0 ? variance.toString() : variance.toFixed(2);
    
    if (Math.abs(variance) < 5) {
      return { 
        icon: CheckCircle, 
        color: "text-green-600", 
        bgColor: "bg-green-50",
        label: "On Target",
        variance: formattedVariance
      };
    } else if (variance > 0) {
      return { 
        icon: TrendingUp, 
        color: "text-orange-600", 
        bgColor: "bg-orange-50",
        label: `Over by ${formattedVariance}%`,
        variance: formattedVariance
      };
    } else {
      return { 
        icon: TrendingDown, 
        color: "text-red-600", 
        bgColor: "bg-red-50",
        label: `Under by ${Math.abs(variance) % 1 === 0 ? Math.abs(variance).toString() : Math.abs(variance).toFixed(2)}%`,
        variance: formattedVariance
      };
    }
  };

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
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Feeding Details
            </h1>
            <p className="text-sm text-gray-600">
              {feedingPlan?.penName} - {schedule.time}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              Feeding Completed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Pen:</span>
              <span className="font-medium">{feedingPlan?.penName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Feed Type:</span>
              <span className="font-medium">{feedingPlan?.feedType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Scheduled Time:</span>
              <span className="font-medium">{schedule.time}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Fed At:</span>
              <span className="font-medium">{formatDate(feedingRecord.feedingTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Amount:</span>
              <div className="flex items-center space-x-2">
                <span className="font-medium">{feedingRecord.plannedAmount}</span>
                <Badge variant="secondary">Planned</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ingredients Details */}
        <Card>
          <CardHeader>
            <CardTitle>Ingredient Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {feedingRecord.actualIngredients.map((ingredient, index) => {
                const variance = getVarianceIndicator(ingredient.plannedAmount, ingredient.actualAmount);
                const VarianceIcon = variance.icon;
                
                return (
                  <div 
                    key={index} 
                    className={`p-4 rounded-lg border ${variance.bgColor}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900">{ingredient.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {ingredient.category}
                        </Badge>
                      </div>
                      <div className={`flex items-center ${variance.color}`}>
                        <VarianceIcon className="h-4 w-4 mr-1" />
                        <span className="text-sm font-medium">{variance.label}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Planned:</span>
                        <div className="font-medium">
                          {formatNumber(ingredient.plannedAmount)} {ingredient.unit}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600">Actual:</span>
                        <div className="font-medium">
                          {formatNumber(ingredient.actualAmount)} {ingredient.unit}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Nutritional Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Planned Nutritional Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-primary">{schedule.totalNutrition.protein}</div>
                <div className="text-sm text-gray-600">Protein</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-secondary">{schedule.totalNutrition.fat}</div>
                <div className="text-sm text-gray-600">Fat</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-accent">{schedule.totalNutrition.fiber}</div>
                <div className="text-sm text-gray-600">Fiber</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-muted-foreground">{schedule.totalNutrition.moisture}</div>
                <div className="text-sm text-gray-600">Moisture</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}