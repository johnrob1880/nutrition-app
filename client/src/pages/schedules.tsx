import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Search, Clock, Wheat, Scale, TrendingUp, Calendar, CheckCircle2, Timer } from "lucide-react";
import type { FeedingPlan } from "@shared/schema";

interface SchedulesProps {
  operatorEmail: string;
}

export default function Schedules({ operatorEmail }: SchedulesProps) {
  const [activeFilter, setActiveFilter] = useState("today");
  
  const { data: feedingPlans, isLoading } = useQuery<FeedingPlan[]>({
    queryKey: ["/api/schedules", operatorEmail],
  });

  const filteredPlans = feedingPlans?.filter(plan => {
    switch (activeFilter) {
      case "today":
        return plan.status === "Active";
      case "week":
        return true;
      case "all":
        return true;
      default:
        return true;
    }
  }) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-primary/10 text-primary";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const getPenColor = (index: number) => {
    const colors = ["bg-primary", "bg-secondary", "bg-accent"];
    return colors[index % colors.length];
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

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="px-6 py-4">
          <h1 className="text-xl font-semibold text-gray-900">Feeding Schedules</h1>
          <p className="text-sm text-gray-600">Read-only view of feeding schedules from external system</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border-b border-gray-100">
        <div className="px-6 py-3">
          <div className="flex space-x-4">
            {[
              { id: "today", label: "Today" },
              { id: "week", label: "This Week" },
              { id: "all", label: "All Schedules" },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
                  activeFilter === filter.id
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-gray-600 hover:text-primary"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feeding Plans List */}
      <div className="p-6 space-y-6">
        {filteredPlans.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No feeding plans found</p>
          </div>
        ) : (
          filteredPlans.map((plan, index) => (
            <Card key={plan.id} className="border border-gray-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 ${getPenColor(index)} rounded-full`}></div>
                    <div>
                      <CardTitle className="text-lg">{plan.planName}</CardTitle>
                      <p className="text-sm text-gray-600">{plan.penName}</p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(plan.status)}>
                    {plan.status}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>Started {plan.startDate}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Timer className="h-4 w-4" />
                      <span>Day {plan.currentDay} of {plan.daysToFeed}</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress</span>
                    <span>{Math.round((plan.currentDay / plan.daysToFeed) * 100)}%</span>
                  </div>
                  <Progress 
                    value={(plan.currentDay / plan.daysToFeed) * 100} 
                    className="h-2"
                  />
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Feed Type</p>
                    <p className="font-medium">{plan.feedType}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Plan ID</p>
                    <p className="font-medium text-gray-500">{plan.id}</p>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    Daily Feeding Schedules
                  </h4>
                  
                  <div className="space-y-3">
                    {plan.schedules.map((schedule, scheduleIndex) => (
                      <div key={schedule.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-medium">{schedule.time}</div>
                            <div className="text-sm text-gray-600">Total: {schedule.totalAmount}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-600">Nutrition</div>
                            <div className="text-xs space-x-2">
                              <span>P: {schedule.totalNutrition.protein}</span>
                              <span>F: {schedule.totalNutrition.fat}</span>
                              <span>Fib: {schedule.totalNutrition.fiber}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Ingredients:</p>
                          <div className="grid grid-cols-1 gap-2">
                            {schedule.ingredients.map((ingredient, ingredientIndex) => (
                              <div key={ingredientIndex} className="flex justify-between items-center text-sm">
                                <div className="flex items-center space-x-2">
                                  <Badge variant="outline" className="text-xs">
                                    {ingredient.category}
                                  </Badge>
                                  <span>{ingredient.name}</span>
                                </div>
                                <div className="text-right">
                                  <span className="font-medium">{ingredient.amount} {ingredient.unit}</span>
                                  <span className="text-gray-500 ml-2">({ingredient.percentage})</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
