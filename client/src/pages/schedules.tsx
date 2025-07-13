import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { FeedingSchedule } from "@shared/schema";

interface SchedulesProps {
  operatorEmail: string;
}

export default function Schedules({ operatorEmail }: SchedulesProps) {
  const [activeFilter, setActiveFilter] = useState("today");
  
  const { data: schedules, isLoading } = useQuery<FeedingSchedule[]>({
    queryKey: ["/api/schedules", operatorEmail],
  });

  const filteredSchedules = schedules?.filter(schedule => {
    switch (activeFilter) {
      case "today":
        return schedule.status === "Active";
      case "week":
        return true; // In a real app, filter by week
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

      {/* Schedules List */}
      <div className="p-6 space-y-4">
        {filteredSchedules.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No feeding schedules found</p>
          </div>
        ) : (
          filteredSchedules.map((schedule, index) => (
            <div key={schedule.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 ${getPenColor(index)} rounded-full`}></div>
                    <h3 className="text-lg font-semibold">{schedule.penName} Schedule</h3>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(schedule.status)}`}>
                    {schedule.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Feed Time</p>
                    <p className="font-semibold">{schedule.time}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Amount</p>
                    <p className="font-semibold">{schedule.amount}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Feed Type:</span>
                    <span className="font-medium">{schedule.feedType}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Schedule ID:</span>
                    <span className="font-medium text-gray-500">{schedule.id}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Last Updated:</span>
                    <span className="font-medium text-gray-500">{schedule.lastUpdated}</span>
                  </div>
                </div>

                {/* Schedule Details */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-600 mb-2">Nutrition Details:</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center">
                      <p className="font-medium text-gray-900">{schedule.protein}</p>
                      <p className="text-gray-500">Protein</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-gray-900">{schedule.fat}</p>
                      <p className="text-gray-500">Fat</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-gray-900">{schedule.fiber}</p>
                      <p className="text-gray-500">Fiber</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
