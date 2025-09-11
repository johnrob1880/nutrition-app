import { useState } from "react";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  useFeedingCompletionStatus,
  useMarkFeedingComplete
} from "@/hooks/use-feeding-program";
import type { InsertDailyFeedingCompletionStatus } from "@shared/schema";

interface FeedingCompletionTrackerProps {
  penProgramId: string;
  penId: number;
  penName: string;
  feedingTimes: string[];
  date?: string;
  userId: number;
  showTitle?: boolean;
}

export function FeedingCompletionTracker({
  penProgramId,
  penId,
  penName,
  feedingTimes,
  date = new Date().toISOString().split('T')[0],
  userId,
  showTitle = true,
}: FeedingCompletionTrackerProps) {
  const { toast } = useToast();
  const { data: completionStatus, refetch } = useFeedingCompletionStatus(penProgramId, date);
  const markComplete = useMarkFeedingComplete();

  const handleMarkComplete = async (feedingTime: string) => {
    try {
      const completionData: InsertDailyFeedingCompletionStatus = {
        penProgramId,
        completedByUserId: userId,
        date,
        feedingTime,
      };

      await markComplete.mutateAsync(completionData);
      await refetch();
      
      toast({
        title: "Feeding Marked Complete",
        description: `${feedingTime} feeding for ${penName} has been marked as complete.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to mark feeding as complete. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getCompletionForTime = (feedingTime: string) => {
    return completionStatus?.find(status => status.feedingTime === feedingTime);
  };

  const getCompletionStats = () => {
    const completed = feedingTimes.filter(time => getCompletionForTime(time)?.completedAt).length;
    const total = feedingTimes.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, total, percentage };
  };

  const stats = getCompletionStats();

  return (
    <Card>
      {showTitle && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{penName} - Daily Completion</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={stats.percentage === 100 ? "default" : "secondary"}>
                {stats.completed}/{stats.total} Complete
              </Badge>
              <div className="text-sm text-gray-500">
                {stats.percentage}%
              </div>
            </div>
          </div>
        </CardHeader>
      )}
      
      <CardContent className={showTitle ? "" : "pt-6"}>
        <div className="space-y-3">
          {feedingTimes.map((feedingTime) => {
            const completion = getCompletionForTime(feedingTime);
            const isCompleted = !!completion?.completedAt;
            
            return (
              <div
                key={feedingTime}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  isCompleted 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1 rounded-full ${
                    isCompleted ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  
                  <div>
                    <div className="font-medium">{feedingTime}</div>
                    {isCompleted && completion.completedAt && (
                      <div className="text-xs text-gray-500">
                        Completed at {new Date(completion.completedAt).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isCompleted ? (
                    <Badge variant="default" className="bg-green-600">
                      Complete
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarkComplete(feedingTime)}
                      disabled={markComplete.isPending}
                      className="border-blue-200 text-blue-600 hover:bg-blue-50"
                    >
                      Mark Complete
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Daily Summary */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {stats.percentage === 100 ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-green-600 font-medium">All feedings complete for today</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="text-gray-600">
                    {stats.total - stats.completed} feeding{stats.total - stats.completed !== 1 ? 's' : ''} remaining
                  </span>
                </>
              )}
            </div>
            
            <div className="text-gray-500">
              {new Date(date).toLocaleDateString()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact version for dashboard/list views
export function CompactFeedingTracker({
  penProgramId,
  penId,
  penName,
  feedingTimes,
  date = new Date().toISOString().split('T')[0],
}: Omit<FeedingCompletionTrackerProps, 'userId' | 'showTitle'>) {
  const { data: completionStatus } = useFeedingCompletionStatus(penProgramId, date);

  const stats = feedingTimes.reduce((acc, time) => {
    const isCompleted = completionStatus?.find(status => 
      status.feedingTime === time && status.completedAt
    );
    return {
      completed: acc.completed + (isCompleted ? 1 : 0),
      total: acc.total + 1,
    };
  }, { completed: 0, total: 0 });

  const percentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {feedingTimes.map((time) => {
          const isCompleted = completionStatus?.find(status => 
            status.feedingTime === time && status.completedAt
          );
          
          return (
            <div
              key={time}
              className={`w-2 h-2 rounded-full ${
                isCompleted ? 'bg-green-500' : 'bg-gray-300'
              }`}
              title={`${time} - ${isCompleted ? 'Complete' : 'Pending'}`}
            />
          );
        })}
      </div>
      
      <span className="text-xs text-gray-500">
        {stats.completed}/{stats.total}
      </span>
      
      <Badge 
        variant={percentage === 100 ? "default" : "secondary"}
        className="text-xs"
      >
        {percentage}%
      </Badge>
    </div>
  );
}