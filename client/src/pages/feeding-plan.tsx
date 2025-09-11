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
import { PenFeedingProgram, FeedingProgramPhase, DailyFeedingCompletionStatus, type Pen } from "@shared/schema";

interface FeedingPlanDetailsProps {
  operationId: number;
}

export default function FeedingPlanDetails({ operationId }: FeedingPlanDetailsProps) {
  const { penId } = useParams();

  // Fetch pen details
  const { data: pens = [] } = useQuery<Pen[]>({
    queryKey: ["/api/pens", operationId],
  });


  // Fetch pen feeding programs (new type)
  const { data: penFeedingPrograms = [] } = useQuery<PenFeedingProgram[]>({
    queryKey: ["/api/feeding-programs", operationId],
  });

  // Fetch daily feeding completion statuses (new type)
  const { data: dailyFeedingStatuses = [] } = useQuery<DailyFeedingCompletionStatus[]>({
    queryKey: ["/api/feeding-completion-status", operationId],
  });

  // Fetch feeding program phases for the current pen program
  const { data: feedingPhases = [] } = useQuery<FeedingProgramPhase[]>({
    queryKey: ["/api/feeding-program-phases", penId],
    enabled: !!penId,
  });


  const penIdNum = Number(penId);
  const currentPen = pens.find(p => p.id === penIdNum);
  // Find the current PenFeedingProgram for this pen
  const penFeedingProgram = penFeedingPrograms.find(program => program.penId === penIdNum);
  // Filter completion statuses for this pen program
  const penFeedingStatuses = penFeedingProgram
    ? dailyFeedingStatuses.filter(status => status.penProgramId === penFeedingProgram.id)
    : [];

  // Calculate current phase based on today's date and program startDate
  const today = new Date();
  let currentPhase: FeedingProgramPhase | undefined = undefined;
  let phaseDateRanges: { phase: FeedingProgramPhase; startDate: Date; endDate: Date }[] = [];
  if (penFeedingProgram && feedingPhases && feedingPhases.length > 0) {
    // Sort phases by phaseOrder
    const sortedPhases = [...feedingPhases].sort((a, b) => a.phaseOrder - b.phaseOrder);
    let runningStart = new Date(penFeedingProgram.startDate);
    for (const phase of sortedPhases) {
      const startDate = new Date(runningStart);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + phase.durationDays - 1);
      phaseDateRanges.push({ phase, startDate, endDate });
      // Next phase starts the day after this one ends
      runningStart = new Date(endDate);
      runningStart.setDate(runningStart.getDate() + 1);
    }
    // Find the current phase for today
    const found = phaseDateRanges.find(({ startDate, endDate }) => today >= startDate && today <= endDate);
    if (found) currentPhase = found.phase;
  }

  // Get today's completion status
  const todayStr = today.toISOString().slice(0, 10);
  const todayStatus = penFeedingStatuses.find(status => status.date === todayStr);

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
              <h1 className="text-2xl font-bold">{currentPen.name} - Feeding Program</h1>
              <p className="text-gray-600">{penFeedingProgram?.programName || 'No active program'}</p>
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
                <p className="text-sm text-gray-600">Feeding Days Complete</p>
                <p className="text-xl font-bold text-primary">{penFeedingStatuses.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feeding Program Details */}
        {penFeedingProgram && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Current Feeding Program
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Program Name</p>
                    <p className="font-semibold">{penFeedingProgram.programName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Current Phase</p>
                    <p className="font-semibold">{currentPhase ? currentPhase.phaseName : 'N/A'}</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-3">Phases</h3>
                  <div className="space-y-3">
                    {phaseDateRanges.map(({ phase, startDate, endDate }, index) => (
                      <div key={phase.id || index} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span className="font-medium">{phase.phaseName}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Scale className="h-4 w-4 text-gray-500" />
                            <span className="font-medium">Order: {phase.phaseOrder}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm text-gray-700">Duration: {phase.durationDays} days</div>
                          {phase.targetMcalPerRation && (
                            <div className="text-sm text-gray-700">Target Mcal/Ration: {phase.targetMcalPerRation}</div>
                          )}
                          <div className="text-xs text-gray-500">{startDate.toISOString().slice(0,10)} to {endDate.toISOString().slice(0,10)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Feeding Completion Status for Today */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Today's Feeding Completion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <Calendar className="h-5 w-5 text-gray-500" />
              <span className="font-medium">{formatDate(todayStr)}</span>
              {todayStatus && todayStatus.completedAt ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-green-700 font-semibold">Complete</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <span className="text-yellow-700 font-semibold">Incomplete</span>
                </>
              )}
            </div>
            {todayStatus && todayStatus.feedingTime && (
              <div className="mt-2 text-sm text-gray-700">Feeding Time: {formatTime(todayStatus.feedingTime)}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}