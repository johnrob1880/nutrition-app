import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, Calendar, TrendingUp, Settings, Weight, Skull, Syringe, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { Pen, FeedingPlan, FeedingSchedule, DeathLoss, TreatmentRecord } from "@shared/schema";

interface PenOverviewProps {
  operatorEmail: string;
}

interface WeightProjection {
  scheduleId: string;
  startDate: Date;
  endDate: Date;
  startWeight: number;
  projectedEndWeight: number;
  scheduleName: string;
  feedType: string;
}

export default function PenOverview({ operatorEmail }: PenOverviewProps) {
  const { penId } = useParams();
  const [avgDailyGain, setAvgDailyGain] = useState(2.5); // Default 2.5 lbs per day
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Get pen data
  const { data: pens } = useQuery<Pen[]>({
    queryKey: ["/api/pens", operatorEmail],
  });

  // Get feeding plans
  const { data: feedingPlans } = useQuery<FeedingPlan[]>({
    queryKey: ["/api/schedules", operatorEmail],
  });

  // Get death loss records
  const { data: deathLosses } = useQuery<DeathLoss[]>({
    queryKey: ["/api/death-loss", operatorEmail],
  });

  // Get treatment records
  const { data: treatments } = useQuery<TreatmentRecord[]>({
    queryKey: ["/api/treatments", operatorEmail],
  });

  const currentPen = pens?.find(pen => pen.id === penId);
  const penPlan = feedingPlans?.find(plan => plan.penId === penId);

  // Calculate weight projections
  const calculateWeightProjections = (): WeightProjection[] => {
    if (!penPlan || !currentPen) return [];

    const projections: WeightProjection[] = [];
    let currentWeight = currentPen.currentWeight;

    // Sort schedules by ID (they don't have dates, so we'll use chronological order)
    const sortedSchedules = [...penPlan.schedules];

    sortedSchedules.forEach((schedule, index) => {
      // Create estimated dates based on schedule order
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + (index * 30)); // Each schedule starts 30 days after the previous
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 30);

      const daysInSchedule = 30; // This could be configurable
      const projectedEndWeight = currentWeight + (daysInSchedule * avgDailyGain);

      projections.push({
        scheduleId: schedule.id,
        startDate,
        endDate,
        startWeight: currentWeight,
        projectedEndWeight,
        scheduleName: `Schedule ${index + 1}`,
        feedType: schedule.ingredients[0]?.name || 'Mixed Feed'
      });

      // Update current weight for next schedule
      currentWeight = projectedEndWeight;
    });

    return projections;
  };

  const weightProjections = calculateWeightProjections();

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatWeight = (weight: number) => {
    return `${weight.toFixed(0)} lbs`;
  };

  if (!currentPen) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
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
              <h1 className="text-2xl font-bold">{currentPen.name}</h1>
              <p className="text-gray-600">{currentPen.current} head of cattle</p>
            </div>
          </div>
          
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Weight Projection Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="adg">Average Daily Gain (lbs)</Label>
                  <Input
                    id="adg"
                    type="number"
                    step="0.1"
                    value={avgDailyGain}
                    onChange={(e) => setAvgDailyGain(parseFloat(e.target.value) || 0)}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Typical range: 2.0 - 4.0 lbs per day
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Current Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Weight className="h-5 w-5 mr-2" />
              Current Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Current Weight</p>
                <p className="text-xl font-bold">{formatWeight(currentPen.currentWeight)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Target Weight</p>
                <p className="text-xl font-bold">{formatWeight(currentPen.marketWeight)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Cattle Type</p>
                <p className="text-lg font-medium">{currentPen.cattleType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Average Daily Gain</p>
                <p className="text-lg font-medium">{avgDailyGain} lbs/day</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weight Projection Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Weight Projection Timeline
            </CardTitle>
            <p className="text-sm text-gray-600">
              Estimated weights based on {avgDailyGain} lbs average daily gain
            </p>
          </CardHeader>
          <CardContent>
            {weightProjections.length > 0 ? (
              <div className="space-y-4">
                {weightProjections.map((projection, index) => (
                  <div key={projection.scheduleId} className="relative">
                    {/* Timeline connector */}
                    {index < weightProjections.length - 1 && (
                      <div className="absolute left-6 top-20 w-0.5 h-8 bg-gray-200"></div>
                    )}
                    
                    <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-blue-600" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium text-lg">{penPlan?.planName || 'Feeding Plan'}</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Period</p>
                            <p className="font-medium">
                              {formatDate(projection.startDate)} - {formatDate(projection.endDate)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {penPlan?.daysToFeed || 30} days total
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">Start Weight</p>
                            <p className="font-medium text-green-600">
                              {formatWeight(projection.startWeight)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">Projected End Weight</p>
                            <p className="font-medium text-blue-600">
                              {formatWeight(projection.projectedEndWeight)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Expected Weight Gain:</span>
                            <span className="font-medium text-green-600">
                              +{formatWeight(projection.projectedEndWeight - projection.startWeight)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Final projection summary */}
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-green-800">Final Projected Weight</h3>
                      <p className="text-sm text-green-600">
                        Based on current feeding schedule
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-800">
                        {weightProjections.length > 0 ? 
                          formatWeight(weightProjections[weightProjections.length - 1].projectedEndWeight) : 
                          formatWeight(currentPen.currentWeight)
                        }
                      </p>
                      <p className="text-sm text-green-600">
                        Target: {formatWeight(currentPen.marketWeight)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No feeding schedules found for this pen</p>
                <p className="text-sm">Schedules will appear here once they're assigned</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Recent Activity</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              // Filter activities for this pen
              const penDeathLosses = deathLosses?.filter(loss => loss.penId === penId) || [];
              const penTreatments = treatments?.filter(treatment => treatment.penId === penId) || [];
              
              // Combine and sort activities by date
              const allActivities = [
                ...penDeathLosses.map(loss => ({
                  type: 'death_loss' as const,
                  date: loss.lossDate,
                  createdAt: loss.createdAt,
                  data: loss
                })),
                ...penTreatments.map(treatment => ({
                  type: 'treatment' as const,
                  date: treatment.treatmentDate,
                  createdAt: treatment.createdAt,
                  data: treatment
                }))
              ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

              if (allActivities.length === 0) {
                return (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No recent activity recorded</p>
                    <p className="text-sm">Death losses and treatments will appear here</p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {allActivities.map((activity, index) => (
                    <div key={`${activity.type}-${activity.data.id}`} className="flex items-start space-x-3 p-4 rounded-lg border">
                      {activity.type === 'death_loss' ? (
                        <>
                          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Skull className="w-5 h-5 text-red-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold text-red-900">Death Loss Recorded</h4>
                              <span className="text-xs text-gray-500">
                                {new Date(activity.date).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-gray-700">
                              <p><span className="font-medium">Count:</span> {activity.data.cattleCount} head</p>
                              <p><span className="font-medium">Reason:</span> {activity.data.reason}</p>
                              <p><span className="font-medium">Est. Weight:</span> {activity.data.estimatedWeight} lbs</p>
                              {activity.data.tagNumbers && (
                                <p><span className="font-medium">Tag Numbers:</span> {activity.data.tagNumbers}</p>
                              )}
                              {activity.data.notes && (
                                <p className="mt-1"><span className="font-medium">Notes:</span> {activity.data.notes}</p>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Syringe className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold text-blue-900">Treatment Applied</h4>
                              <span className="text-xs text-gray-500">
                                {new Date(activity.date).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-gray-700">
                              <p><span className="font-medium">Type:</span> {activity.data.treatmentType}</p>
                              <p><span className="font-medium">Product:</span> {activity.data.product}</p>
                              <p><span className="font-medium">Dosage:</span> {activity.data.dosage}</p>
                              <p><span className="font-medium">Count:</span> {activity.data.cattleCount} head</p>
                              {activity.data.tagNumbers && (
                                <p><span className="font-medium">Tag Numbers:</span> {activity.data.tagNumbers}</p>
                              )}
                              <p><span className="font-medium">By:</span> {activity.data.treatedBy}</p>
                              {activity.data.notes && (
                                <p className="mt-1"><span className="font-medium">Notes:</span> {activity.data.notes}</p>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  
                  {allActivities.length > 5 && (
                    <div className="text-center">
                      <Button variant="outline" size="sm">
                        View All Activity
                      </Button>
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}