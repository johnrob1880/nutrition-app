import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { CompactFeedingTracker } from "@/components/feeding-completion-tracker";
import { MigrationNotice } from "@/components/migration-notice";
import {
  Search,
  Clock,
  Wheat,
  Scale,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Timer,
  ArrowRight,
  Users,
} from "lucide-react";
import { useUnifiedFeedingData } from "@/hooks/use-feeding-migration";
import { usePenFeedingPrograms, useCalculateCurrentPhase } from "@/hooks/use-feeding-program";
import type { PenFeedingProgram, Pen, Operation } from "@shared/schema";

interface SchedulesNewProps {
  operatorEmail: string;
}

export default function SchedulesNew({ operatorEmail }: SchedulesNewProps) {
  const [, setLocation] = useLocation();
  const [activeFilter, setActiveFilter] = useState("today");
  const [searchTerm, setSearchTerm] = useState("");

  // Get operation data
  const { data: operation } = useQuery<Operation>({
    queryKey: ["/api/operation", operatorEmail],
  });

  // Get pen data
  const { data: pens } = useQuery<Pen[]>({
    queryKey: ["/api/pens", operatorEmail],
    enabled: !!operatorEmail,
  });

  // Get feeding programs for all pens
  const penPrograms = pens?.map(pen => {
    const { data: programs } = usePenFeedingPrograms(pen.id);
    const activeProgram = programs?.find(p => p.status === "active");
    return { pen, activeProgram };
  }).filter(Boolean) || [];

  const filteredPrograms = penPrograms.filter(({ pen, activeProgram }) => {
    if (!activeProgram) return false;
    
    // Search filter
    if (searchTerm && !pen.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Status filter
    switch (activeFilter) {
      case "today":
        return activeProgram.status === "active";
      case "week":
        return true;
      case "all":
        return true;
      default:
        return true;
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-primary/10 text-primary";
      case "completed":
        return "bg-green-100 text-green-600";
      case "paused":
        return "bg-yellow-100 text-yellow-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const formatFeedingTimes = (times: string[]) => {
    if (!times || times.length === 0) return "No feeding times";
    if (times.length === 1) return times[0];
    if (times.length === 2) return `${times[0]} & ${times[1]}`;
    return `${times[0]}, ${times[1]} +${times.length - 2} more`;
  };

  const handleFeedingClick = (penId: number, feedingTime: string) => {
    setLocation(`/feeding/${penId}/${feedingTime}`);
  };

  if (!pens) {
    return (
      <div className="pb-20">
        <div className="px-6 py-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
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
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Feeding Schedules</h1>
          
          {/* Search and Filters */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search pens..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2 overflow-x-auto">
              {[
                { key: "today", label: "Active Today", count: filteredPrograms.length },
                { key: "week", label: "This Week", count: penPrograms.length },
                { key: "all", label: "All Programs", count: penPrograms.length },
              ].map((filter) => (
                <Button
                  key={filter.key}
                  variant={activeFilter === filter.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveFilter(filter.key)}
                  className="whitespace-nowrap"
                >
                  {filter.label}
                  <Badge variant="secondary" className="ml-2">
                    {filter.count}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4 space-y-4">
        {filteredPrograms.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Programs</h3>
              <p className="text-gray-500">
                {searchTerm 
                  ? `No programs match "${searchTerm}"`
                  : "No feeding programs are currently active for your pens."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredPrograms.map(({ pen, activeProgram }) => (
            <FeedingProgramCard
              key={`${pen.id}-${activeProgram?.id}`}
              pen={pen}
              program={activeProgram!}
              onFeedingClick={handleFeedingClick}
              userId={operation?.id || 0}
            />
          ))
        )}

        {/* Show migration notices for pens without programs */}
        {pens
          .filter(pen => !penPrograms.find(pp => pp.pen.id === pen.id)?.activeProgram)
          .map(pen => (
            <MigrationNotice key={pen.id} penId={pen.id} />
          ))
        }
      </div>
    </div>
  );
}

interface FeedingProgramCardProps {
  pen: Pen;
  program: PenFeedingProgram;
  onFeedingClick: (penId: number, feedingTime: string) => void;
  userId: number;
}

function FeedingProgramCard({ pen, program, onFeedingClick, userId }: FeedingProgramCardProps) {
  const { data: currentPhaseData } = useCalculateCurrentPhase(program);
  
  const feedingTimes = program.feedingTimes || ["06:00", "18:00"];
  const progressPercent = currentPhaseData 
    ? Math.round(((currentPhaseData.dayInPhase / currentPhaseData.phase.durationDays) * 100))
    : 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{pen.name}</CardTitle>
            <p className="text-sm text-gray-600">{program.programName}</p>
          </div>
          <div className="text-right">
            <Badge className={getStatusColor(program.status || "active")}>
              {(program.status || "active").charAt(0).toUpperCase() + (program.status || "active").slice(1)}
            </Badge>
            {pen.cattleCount && (
              <div className="text-sm text-gray-500 mt-1 flex items-center">
                <Users className="h-3 w-3 mr-1" />
                {pen.cattleCount} head
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Phase Progress */}
        {currentPhaseData && (
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium">{currentPhaseData.phase.phaseName}</span>
              <span className="text-gray-500">
                Day {currentPhaseData.dayInPhase} of {currentPhaseData.phase.durationDays}
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <div className="text-xs text-gray-500 mt-1">
              {currentPhaseData.daysRemaining} days remaining in phase
            </div>
          </div>
        )}

        <Separator />

        {/* Feeding Times Grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-sm">Today's Feedings</h4>
            <div className="text-xs text-gray-500">
              {feedingTimes.length} feeding{feedingTimes.length !== 1 ? 's' : ''} per day
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {feedingTimes.map((time) => (
              <Button
                key={time}
                variant="outline"
                size="sm"
                onClick={() => onFeedingClick(pen.id, time)}
                className="justify-between h-auto p-3"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span className="font-mono">{time}</span>
                </div>
                <ArrowRight className="h-3 w-3" />
              </Button>
            ))}
          </div>
        </div>

        {/* Completion Tracking */}
        <div className="mt-4">
          <CompactFeedingTracker
            penProgramId={program.id}
            penId={pen.id}
            penName={pen.name}
            feedingTimes={feedingTimes}
          />
        </div>

        {/* Nutritional Info */}
        {currentPhaseData?.phase.targetMcalPerRation && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-gray-400" />
              <span>{currentPhaseData.phase.targetMcalPerRation} Mcal/ration</span>
            </div>
            <div className="flex items-center gap-2">
              <Wheat className="h-4 w-4 text-gray-400" />
              <span>{currentPhaseData.phase.ingredients?.length || 0} ingredients</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case "active":
      return "bg-primary/10 text-primary";
    case "completed":
      return "bg-green-100 text-green-600";
    case "paused":
      return "bg-yellow-100 text-yellow-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
}