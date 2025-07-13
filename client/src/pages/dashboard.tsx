import { useQuery } from "@tanstack/react-query";
import { Building, AlertTriangle, Play, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import type {
  DashboardStats,
  FeedingPlan,
  UpcomingScheduleChange,
  FeedingRecord,
} from "@shared/schema";

interface DashboardProps {
  operatorEmail: string;
  operationName: string;
  operationLocation: string;
}

export default function Dashboard({
  operatorEmail,
  operationName,
  operationLocation,
}: DashboardProps) {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard", operatorEmail],
  });

  const { data: feedingPlans, isLoading: schedulesLoading } = useQuery<
    FeedingPlan[]
  >({
    queryKey: ["/api/schedules", operatorEmail],
  });

  const { data: upcomingChanges, isLoading: changesLoading } = useQuery<
    UpcomingScheduleChange[]
  >({
    queryKey: ["/api/upcoming-changes", operatorEmail],
  });

  const { data: feedingRecords, isLoading: recordsLoading } = useQuery<
    FeedingRecord[]
  >({
    queryKey: ["/api/feeding-records", operatorEmail],
  });

  // Extract today's active schedules from feeding plans
  const todaySchedules =
    feedingPlans
      ?.filter((plan) => plan.status === "Active")
      .flatMap((plan) =>
        plan.schedules.map((schedule) => ({
          ...schedule,
          penId: plan.penId,
          penName: plan.penName,
          feedType: plan.feedType,
          planId: plan.id,
        })),
      ) || [];

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  
  // Filter today's feeding records
  const todayFeedingRecords = feedingRecords?.filter(record => 
    record.feedingTime.startsWith(today)
  ) || [];

  // Determine which schedules are completed
  const schedulesWithStatus = todaySchedules.map(schedule => {
    const isCompleted = todayFeedingRecords.some(record => 
      record.penId === schedule.penId && record.scheduleId === schedule.id
    );
    return { ...schedule, isCompleted };
  });

  if (statsLoading || schedulesLoading || changesLoading || recordsLoading) {
    return (
      <div className="pb-20">
        <div className="bg-white shadow-sm">
          <div className="px-6 py-4">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="h-20 bg-gray-200 rounded-lg"></div>
              <div className="h-20 bg-gray-200 rounded-lg"></div>
            </div>
            <div className="h-40 bg-gray-200 rounded-lg"></div>
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {operationName}
              </h1>
              <p className="text-sm text-gray-600">{operationLocation}</p>
            </div>
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Building className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="p-6 space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold text-primary">
                {stats?.totalPens || 0}
              </span>
              <Building className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-sm text-gray-600">Active Pens</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold text-secondary">
                {stats?.totalCattle || 0}
              </span>
              <Building className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-sm text-gray-600">Total Cattle</p>
          </div>
        </div>

        {/* Upcoming Schedule Changes */}
        {upcomingChanges && upcomingChanges.length > 0 && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <div className="font-medium mb-2">Upcoming Schedule Changes</div>
              {upcomingChanges.map((change) => (
                <div key={change.id} className="text-sm mb-1">
                  <span className="font-medium">{change.penName}</span> -{" "}
                  {change.description}
                  <span className="text-orange-600 ml-1">
                    (
                    {change.daysFromNow === 0
                      ? "Today"
                      : `${change.daysFromNow} days`}
                    )
                  </span>
                </div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {/* Today's Feeding Schedule */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold">Today's Feeding Schedule</h2>
            <p className="text-sm text-gray-600">
              Active schedules for your pens
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {schedulesWithStatus.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No active feeding schedules found
              </div>
            ) : (
              schedulesWithStatus.map((schedule) => (
                <div
                  key={schedule.id}
                  className={`p-4 flex items-center justify-between ${
                    schedule.isCompleted ? 'bg-green-50' : ''
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div 
                        className={`w-3 h-3 rounded-full ${
                          schedule.isCompleted ? 'bg-green-500' : 'bg-primary'
                        }`}
                      ></div>
                      <div>
                        <p className={`font-medium ${
                          schedule.isCompleted ? 'text-green-700' : ''
                        }`}>
                          {schedule.penName}
                        </p>
                        <p className="text-sm text-gray-600">
                          {schedule.feedType}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <p className="text-sm font-medium">{schedule.time}</p>
                      <p className="text-xs text-gray-500">
                        {schedule.totalAmount}
                      </p>
                    </div>
                    {schedule.isCompleted ? (
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        <span className="text-sm font-medium">Fed</span>
                      </div>
                    ) : (
                      <Link href={`/feeding/${schedule.penId}/${schedule.id}`}>
                        <Button
                          size="sm"
                          className="bg-primary hover:bg-primary/90"
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Feed
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <p className="text-sm text-gray-600">
                Data synced with external systems
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-secondary rounded-full"></div>
              <p className="text-sm text-gray-600">Feeding schedules updated</p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-accent rounded-full"></div>
              <p className="text-sm text-gray-600">
                System status: All systems operational
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
