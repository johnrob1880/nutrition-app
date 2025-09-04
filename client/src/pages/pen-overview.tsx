import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, Calendar, TrendingUp, Settings, Weight, Skull, Syringe, Clock, Zap, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import type { Pen, FeedingPlan, FeedingSchedule, DeathLoss, TreatmentRecord, InsertDeathLoss, InsertTreatmentRecord, PartialSale, StaffMember } from "@shared/schema";
import { insertDeathLossSchema, insertTreatmentSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

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

const deathLossSchema = insertDeathLossSchema.omit({ operatorEmail: true });
const treatmentSchema = insertTreatmentSchema.omit({ operatorEmail: true });

const partialSaleSchema = z.object({
  penId: z.string(),
  saleDate: z.string().min(1, "Sale date is required"),
  cattleCount: z.number().min(1, "Must sell at least 1 head"),
  finalWeight: z.number().min(1, "Final weight must be positive"),
  pricePerCwt: z.number().min(0.01, "Price per CWT must be positive"),
  tagNumbers: z.string().optional(),
  buyer: z.string().optional(),
  notes: z.string().optional(),
});

type DeathLossData = z.infer<typeof deathLossSchema>;
type TreatmentData = z.infer<typeof treatmentSchema>;
type PartialSaleData = z.infer<typeof partialSaleSchema>;

export default function PenOverview({ operatorEmail }: PenOverviewProps) {
  const { penId } = useParams();
  const [avgDailyGain, setAvgDailyGain] = useState(2.5); // Default 2.5 lbs per day
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeathLossDialogOpen, setIsDeathLossDialogOpen] = useState(false);
  const [isTreatmentDialogOpen, setIsTreatmentDialogOpen] = useState(false);
  const [isPartialSaleDialogOpen, setIsPartialSaleDialogOpen] = useState(false);
  const [activityFilters, setActivityFilters] = useState({
    death_loss: true,
    treatment: true,
    partial_sale: true,
  });
  const { toast } = useToast();

  // Get pen data
  const { data: pens } = useQuery<Pen[]>({
    queryKey: ["/api/pens", operatorEmail],
  });

  // Get feeding plans
  const { data: feedingPlans } = useQuery<FeedingPlan[]>({
    queryKey: ["/api/schedules", operatorEmail],
  });

  // Get staff members for treatment "treated by" selection
  const { data: staffMembers = [] } = useQuery<StaffMember[]>({
    queryKey: ["/api/staff", operatorEmail],
    enabled: !!operatorEmail,
  });

  // Get death loss records
  const { data: deathLosses } = useQuery<DeathLoss[]>({
    queryKey: ["/api/death-loss", operatorEmail],
  });

  // Get treatment records
  const { data: treatments } = useQuery<TreatmentRecord[]>({
    queryKey: ["/api/treatments", operatorEmail],
  });

  // Get partial sales
  const { data: partialSales } = useQuery<PartialSale[]>({
    queryKey: ["/api/partial-sales", operatorEmail],
  });

  const currentPen = pens?.find(pen => pen.id === penId);
  const penPlan = feedingPlans?.find(plan => plan.penId === penId);

  // Death Loss Form
  const deathLossForm = useForm<DeathLossData>({
    resolver: zodResolver(deathLossSchema),
    defaultValues: {
      penId: penId || "",
      lossDate: new Date().toISOString().split('T')[0],
      reason: "",
      cattleCount: 1,
      estimatedWeight: currentPen?.currentWeight || 0,
      tagNumbers: "",
      notes: "",
    },
  });

  // Treatment Form
  const treatmentForm = useForm<TreatmentData>({
    resolver: zodResolver(treatmentSchema),
    defaultValues: {
      penId: penId || "",
      treatmentDate: new Date().toISOString().split('T')[0],
      treatmentType: "",
      product: "",
      dosage: "",
      cattleCount: currentPen?.current || 1,
      tagNumbers: "",
      treatedBy: operatorEmail,
      notes: "",
    },
  });

  // Partial Sale Form
  const partialSaleForm = useForm<PartialSaleData>({
    resolver: zodResolver(partialSaleSchema),
    defaultValues: {
      penId: penId || "",
      saleDate: new Date().toISOString().split('T')[0],
      cattleCount: 1,
      finalWeight: currentPen?.currentWeight || currentPen?.marketWeight || 0,
      pricePerCwt: 0,
      tagNumbers: "",
      buyer: "",
      notes: "",
    },
  });

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

  // Death Loss handlers
  const handleDeathLoss = async (data: DeathLossData) => {
    if (!currentPen) return;

    try {
      const operation = await apiRequest("GET", `/api/operation/${operatorEmail}`);
      const operationData = await operation.json();

      const deathLossData: InsertDeathLoss = {
        ...data,
        operationId: operationData.id,
        operatorEmail,
      };

      await apiRequest("POST", "/api/death-loss", deathLossData);

      // Invalidate relevant queries for refresh
      queryClient.invalidateQueries({ queryKey: ["/api/pens", operatorEmail] });
      queryClient.invalidateQueries({ queryKey: ["/api/death-loss", operatorEmail] });

      toast({
        title: "Death Loss Recorded",
        description: `${data.cattleCount} head loss recorded for ${currentPen.name}`,
      });

      setIsDeathLossDialogOpen(false);
      deathLossForm.reset();
    } catch (error: any) {
      toast({
        title: "Failed to Record",
        description: error.message || "Failed to record death loss",
        variant: "destructive",
      });
    }
  };

  // Treatment handlers
  const handleTreatment = async (data: TreatmentData) => {
    if (!currentPen) return;

    try {
      const operation = await apiRequest("GET", `/api/operation/${operatorEmail}`);
      const operationData = await operation.json();

      const treatmentData: InsertTreatmentRecord = {
        ...data,
        operationId: operationData.id,
        operatorEmail,
      };

      await apiRequest("POST", "/api/treatments", treatmentData);

      // Invalidate relevant queries for refresh
      queryClient.invalidateQueries({ queryKey: ["/api/treatments", operatorEmail] });

      toast({
        title: "Treatment Recorded",
        description: `Treatment recorded for ${data.cattleCount} head in ${currentPen.name}`,
      });

      setIsTreatmentDialogOpen(false);
      treatmentForm.reset();
    } catch (error: any) {
      toast({
        title: "Failed to Record",
        description: error.message || "Failed to record treatment",
        variant: "destructive",
      });
    }
  };

  const handlePartialSale = async (data: PartialSaleData) => {
    if (!currentPen) return;

    try {
      const operation = await apiRequest("GET", `/api/operation/${operatorEmail}`);
      const operationData = await operation.json();

      const partialSaleData = {
        ...data,
        operationId: operationData.id,
        operatorEmail,
      };

      await apiRequest("POST", "/api/partial-sales", partialSaleData);

      // Invalidate relevant queries for refresh
      queryClient.invalidateQueries({ queryKey: ["/api/pens", operatorEmail] });
      queryClient.invalidateQueries({ queryKey: ["/api/partial-sales", operatorEmail] });

      toast({
        title: "Partial Sale Recorded",
        description: `${data.cattleCount} head sold from ${currentPen.name}`,
      });

      setIsPartialSaleDialogOpen(false);
      partialSaleForm.reset();
    } catch (error: any) {
      toast({
        title: "Failed to Record",
        description: error.message || "Failed to record partial sale",
        variant: "destructive",
      });
    }
  };

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
            <div className="flex items-center space-x-6">
              <div>
                <h1 className="text-2xl font-bold">{currentPen.name}</h1>
                <p className="text-gray-600">{currentPen.cattleType} · {currentPen.status}</p>
              </div>
              {/* Prominent Head Count Display */}
              <div className="bg-primary/10 border border-primary/20 rounded-lg px-6 py-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">
                    {currentPen.current}
                  </div>
                  <div className="text-sm font-semibold text-primary/80 uppercase tracking-wide">
                    Head
                  </div>
                </div>
              </div>
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
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Recent Activity</span>
              </div>
              {currentPen?.status === "Active" && currentPen?.current > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                      <Zap className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setIsDeathLossDialogOpen(true)}>
                      <Skull className="h-4 w-4 mr-2" />
                      Record Death Loss
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsTreatmentDialogOpen(true)}>
                      <Syringe className="h-4 w-4 mr-2" />
                      Record Treatment
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsPartialSaleDialogOpen(true)}>
                      <DollarSign className="h-4 w-4 mr-2" />
                      Record Partial Sale
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              // Filter activities for this pen
              const penDeathLosses = deathLosses?.filter(loss => loss.penId === penId) || [];
              const penTreatments = treatments?.filter(treatment => treatment.penId === penId) || [];
              const penPartialSales = partialSales?.filter(sale => sale.penId === penId) || [];
              
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
                })),
                ...penPartialSales.map(sale => ({
                  type: 'partial_sale' as const,
                  date: sale.saleDate,
                  createdAt: sale.createdAt,
                  data: sale
                }))
              ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

              // Filter activities based on checkbox selections
              const filteredActivities = allActivities.filter(activity => 
                activityFilters[activity.type]
              );

              if (allActivities.length === 0) {
                return (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No recent activity recorded</p>
                    <p className="text-sm">Death losses, treatments, and partial sales will appear here</p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {/* Activity Filters */}
                  <div className="flex flex-wrap gap-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="filter-death-loss"
                        checked={activityFilters.death_loss}
                        onCheckedChange={(checked) =>
                          setActivityFilters(prev => ({ ...prev, death_loss: checked as boolean }))
                        }
                      />
                      <label
                        htmlFor="filter-death-loss"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center space-x-1"
                      >
                        <Skull className="h-4 w-4 text-red-600" />
                        <span>Death Loss</span>
                      </label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="filter-treatment"
                        checked={activityFilters.treatment}
                        onCheckedChange={(checked) =>
                          setActivityFilters(prev => ({ ...prev, treatment: checked as boolean }))
                        }
                      />
                      <label
                        htmlFor="filter-treatment"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center space-x-1"
                      >
                        <Syringe className="h-4 w-4 text-blue-600" />
                        <span>Treatments</span>
                      </label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="filter-partial-sale"
                        checked={activityFilters.partial_sale}
                        onCheckedChange={(checked) =>
                          setActivityFilters(prev => ({ ...prev, partial_sale: checked as boolean }))
                        }
                      />
                      <label
                        htmlFor="filter-partial-sale"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center space-x-1"
                      >
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span>Partial Sales</span>
                      </label>
                    </div>
                  </div>

                  {filteredActivities.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No activities match the selected filters</p>
                      <p className="text-sm">Adjust the filters above to see more activities</p>
                    </div>
                  ) : (
                    filteredActivities.map((activity, index) => (
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
                      ) : activity.type === 'treatment' ? (
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
                              <p><span className="font-medium">Type:</span> {(activity.data as TreatmentRecord).treatmentType}</p>
                              <p><span className="font-medium">Product:</span> {(activity.data as TreatmentRecord).product}</p>
                              <p><span className="font-medium">Dosage:</span> {(activity.data as TreatmentRecord).dosage}</p>
                              <p><span className="font-medium">Count:</span> {activity.data.cattleCount} head</p>
                              {activity.data.tagNumbers && (
                                <p><span className="font-medium">Tag Numbers:</span> {activity.data.tagNumbers}</p>
                              )}
                              <p><span className="font-medium">By:</span> {(activity.data as TreatmentRecord).treatedBy}</p>
                              {activity.data.notes && (
                                <p className="mt-1"><span className="font-medium">Notes:</span> {activity.data.notes}</p>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <DollarSign className="w-5 h-5 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold text-green-900">Partial Sale Recorded</h4>
                              <span className="text-xs text-gray-500">
                                {new Date(activity.date).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-gray-700">
                              <p><span className="font-medium">Count:</span> {activity.data.cattleCount} head</p>
                              <p><span className="font-medium">Weight:</span> {activity.data.finalWeight} lbs/head</p>
                              <p><span className="font-medium">Price:</span> ${activity.data.pricePerCwt}/cwt</p>
                              <p><span className="font-medium">Revenue:</span> ${activity.data.totalRevenue.toFixed(2)}</p>
                              {activity.data.tagNumbers && (
                                <p><span className="font-medium">Tag Numbers:</span> {activity.data.tagNumbers}</p>
                              )}
                              {activity.data.buyer && (
                                <p><span className="font-medium">Buyer:</span> {activity.data.buyer}</p>
                              )}
                              {activity.data.notes && (
                                <p className="mt-1"><span className="font-medium">Notes:</span> {activity.data.notes}</p>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    ))
                  )}
                  
                  {filteredActivities.length > 5 && (
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

        {/* Death Loss Dialog */}
        <Dialog open={isDeathLossDialogOpen} onOpenChange={setIsDeathLossDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Record Death Loss</DialogTitle>
            </DialogHeader>
            <form onSubmit={deathLossForm.handleSubmit(handleDeathLoss)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lossDate">Date of Loss</Label>
                <DatePicker
                  value={deathLossForm.watch("lossDate") ? (() => {
                    const dateStr = deathLossForm.watch("lossDate");
                    const [year, month, day] = dateStr.split('-').map(Number);
                    return new Date(year, month - 1, day);
                  })() : undefined}
                  onChange={(date) => {
                    if (date) {
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const day = String(date.getDate()).padStart(2, '0');
                      deathLossForm.setValue("lossDate", `${year}-${month}-${day}`);
                    } else {
                      deathLossForm.setValue("lossDate", "");
                    }
                  }}
                  placeholder="Select loss date"
                />
                {deathLossForm.formState.errors.lossDate && (
                  <p className="text-sm text-red-600">
                    {deathLossForm.formState.errors.lossDate.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Loss</Label>
                <Select
                  value={deathLossForm.watch("reason")}
                  onValueChange={(value) => deathLossForm.setValue("reason", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Disease">Disease</SelectItem>
                    <SelectItem value="Injury">Injury</SelectItem>
                    <SelectItem value="Weather">Weather Related</SelectItem>
                    <SelectItem value="Unknown">Unknown</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {deathLossForm.formState.errors.reason && (
                  <p className="text-sm text-red-600">
                    {deathLossForm.formState.errors.reason.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cattleCount">Number of Head</Label>
                <Input
                  id="cattleCount"
                  type="number"
                  min="1"
                  {...deathLossForm.register("cattleCount", { valueAsNumber: true })}
                />
                {deathLossForm.formState.errors.cattleCount && (
                  <p className="text-sm text-red-600">
                    {deathLossForm.formState.errors.cattleCount.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimatedWeight">Estimated Weight (lbs)</Label>
                <Input
                  id="estimatedWeight"
                  type="number"
                  min="1"
                  {...deathLossForm.register("estimatedWeight", { valueAsNumber: true })}
                />
                {deathLossForm.formState.errors.estimatedWeight && (
                  <p className="text-sm text-red-600">
                    {deathLossForm.formState.errors.estimatedWeight.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tagNumbers">Tag Numbers (Optional)</Label>
                <Input
                  id="tagNumbers"
                  {...deathLossForm.register("tagNumbers")}
                  placeholder="Enter tag numbers separated by commas (e.g., 1234, 5678)"
                />
                {deathLossForm.formState.errors.tagNumbers && (
                  <p className="text-sm text-red-600">
                    {deathLossForm.formState.errors.tagNumbers.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  {...deathLossForm.register("notes")}
                  placeholder="Additional details about the loss..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDeathLossDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="destructive">
                  Record Loss
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Treatment Dialog */}
        <Dialog open={isTreatmentDialogOpen} onOpenChange={setIsTreatmentDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Record Treatment</DialogTitle>
            </DialogHeader>
            <form onSubmit={treatmentForm.handleSubmit(handleTreatment)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="treatmentDate">Treatment Date</Label>
                <DatePicker
                  value={treatmentForm.watch("treatmentDate") ? (() => {
                    const dateStr = treatmentForm.watch("treatmentDate");
                    const [year, month, day] = dateStr.split('-').map(Number);
                    return new Date(year, month - 1, day);
                  })() : undefined}
                  onChange={(date) => {
                    if (date) {
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const day = String(date.getDate()).padStart(2, '0');
                      treatmentForm.setValue("treatmentDate", `${year}-${month}-${day}`);
                    } else {
                      treatmentForm.setValue("treatmentDate", "");
                    }
                  }}
                  placeholder="Select treatment date"
                />
                {treatmentForm.formState.errors.treatmentDate && (
                  <p className="text-sm text-red-600">
                    {treatmentForm.formState.errors.treatmentDate.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="treatmentType">Treatment Type</Label>
                <Select
                  value={treatmentForm.watch("treatmentType")}
                  onValueChange={(value) => treatmentForm.setValue("treatmentType", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select treatment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Vaccination">Vaccination</SelectItem>
                    <SelectItem value="Antibiotic">Antibiotic</SelectItem>
                    <SelectItem value="Deworming">Deworming</SelectItem>
                    <SelectItem value="Vitamin">Vitamin/Supplement</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {treatmentForm.formState.errors.treatmentType && (
                  <p className="text-sm text-red-600">
                    {treatmentForm.formState.errors.treatmentType.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="product">Product/Medicine</Label>
                <Input
                  id="product"
                  {...treatmentForm.register("product")}
                  placeholder="Product name or medicine used"
                />
                {treatmentForm.formState.errors.product && (
                  <p className="text-sm text-red-600">
                    {treatmentForm.formState.errors.product.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dosage">Dosage</Label>
                <Input
                  id="dosage"
                  {...treatmentForm.register("dosage")}
                  placeholder="Dosage amount and frequency"
                />
                {treatmentForm.formState.errors.dosage && (
                  <p className="text-sm text-red-600">
                    {treatmentForm.formState.errors.dosage.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cattleCount">Number of Head Treated</Label>
                <Input
                  id="cattleCount"
                  type="number"
                  min="1"
                  {...treatmentForm.register("cattleCount", { valueAsNumber: true })}
                />
                {treatmentForm.formState.errors.cattleCount && (
                  <p className="text-sm text-red-600">
                    {treatmentForm.formState.errors.cattleCount.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tagNumbers">Tag Numbers (Optional)</Label>
                <Input
                  id="tagNumbers"
                  {...treatmentForm.register("tagNumbers")}
                  placeholder="Enter tag numbers separated by commas (e.g., 1234, 5678)"
                />
                {treatmentForm.formState.errors.tagNumbers && (
                  <p className="text-sm text-red-600">
                    {treatmentForm.formState.errors.tagNumbers.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="treatedBy">Treated By</Label>
                <Select
                  value={treatmentForm.watch("treatedBy") || ""}
                  onValueChange={(value) => treatmentForm.setValue("treatedBy", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffMembers
                      .filter(member => member.status === 'active')
                      .map((staff) => (
                      <SelectItem key={staff.id} value={`${staff.firstName} ${staff.lastName}`}>
                        {staff.firstName} {staff.lastName}
                        {staff.role === 'owner' && (
                          <span className="ml-2 text-xs text-gray-500">(Owner)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {treatmentForm.formState.errors.treatedBy && (
                  <p className="text-sm text-red-600">
                    {treatmentForm.formState.errors.treatedBy.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  {...treatmentForm.register("notes")}
                  placeholder="Additional treatment details..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsTreatmentDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  Record Treatment
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Partial Sale Dialog */}
        <Dialog open={isPartialSaleDialogOpen} onOpenChange={setIsPartialSaleDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Record Partial Sale</DialogTitle>
            </DialogHeader>
            <form onSubmit={partialSaleForm.handleSubmit(handlePartialSale)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="saleDate">Sale Date</Label>
                <DatePicker
                  value={partialSaleForm.watch("saleDate") ? (() => {
                    const dateStr = partialSaleForm.watch("saleDate");
                    const [year, month, day] = dateStr.split('-').map(Number);
                    return new Date(year, month - 1, day);
                  })() : undefined}
                  onChange={(date) => {
                    if (date) {
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const day = String(date.getDate()).padStart(2, '0');
                      partialSaleForm.setValue("saleDate", `${year}-${month}-${day}`);
                    } else {
                      partialSaleForm.setValue("saleDate", "");
                    }
                  }}
                  placeholder="Select sale date"
                />
                {partialSaleForm.formState.errors.saleDate && (
                  <p className="text-sm text-red-600">
                    {partialSaleForm.formState.errors.saleDate.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cattleCount">Number of Head to Sell</Label>
                <Input
                  id="cattleCount"
                  type="number"
                  min="1"
                  max={currentPen?.current || 1}
                  {...partialSaleForm.register("cattleCount", { valueAsNumber: true })}
                />
                {partialSaleForm.formState.errors.cattleCount && (
                  <p className="text-sm text-red-600">
                    {partialSaleForm.formState.errors.cattleCount.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="finalWeight">Final Weight (lbs per head)</Label>
                <Input
                  id="finalWeight"
                  type="number"
                  min="1"
                  {...partialSaleForm.register("finalWeight", { valueAsNumber: true })}
                />
                {partialSaleForm.formState.errors.finalWeight && (
                  <p className="text-sm text-red-600">
                    {partialSaleForm.formState.errors.finalWeight.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pricePerCwt">Price per CWT ($)</Label>
                <Input
                  id="pricePerCwt"
                  type="number"
                  step="0.01"
                  min="0.01"
                  {...partialSaleForm.register("pricePerCwt", { valueAsNumber: true })}
                />
                {partialSaleForm.formState.errors.pricePerCwt && (
                  <p className="text-sm text-red-600">
                    {partialSaleForm.formState.errors.pricePerCwt.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tagNumbers">Tag Numbers (Optional)</Label>
                <Input
                  id="tagNumbers"
                  {...partialSaleForm.register("tagNumbers")}
                  placeholder="Enter tag numbers separated by commas (e.g., 1234, 5678)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="buyer">Buyer (Optional)</Label>
                <Input
                  id="buyer"
                  {...partialSaleForm.register("buyer")}
                  placeholder="Name of buyer or company"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  {...partialSaleForm.register("notes")}
                  placeholder="Additional sale details..."
                  rows={3}
                />
              </div>

              {currentPen && (
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Revenue for this sale:</span>
                      <span className="font-medium text-green-700">
                        $
                        {(
                          ((partialSaleForm.watch("finalWeight") || 0) *
                            (partialSaleForm.watch("pricePerCwt") || 0) *
                            (partialSaleForm.watch("cattleCount") || 0)) /
                          100
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Remaining in pen:</span>
                      <span className="font-medium">
                        {currentPen.current - (partialSaleForm.watch("cattleCount") || 0)} head
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPartialSaleDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  Record Sale
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}