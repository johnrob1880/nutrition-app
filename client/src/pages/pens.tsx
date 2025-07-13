import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Pen } from "@shared/schema";

interface PensProps {
  operatorEmail: string;
}

export default function Pens({ operatorEmail }: PensProps) {
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: pens, isLoading } = useQuery<Pen[]>({
    queryKey: ["/api/pens", operatorEmail],
  });

  const filteredPens = pens?.filter(pen =>
    pen.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pen.feedType.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-primary/10 text-primary";
      case "Maintenance":
        return "bg-accent/10 text-accent";
      default:
        return "bg-gray-100 text-gray-600";
    }
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
          <h1 className="text-xl font-semibold text-gray-900">Cattle Pens</h1>
          <p className="text-sm text-gray-600">Read-only view of pens linked to your operation</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-6 bg-white border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search pens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* Pens List */}
      <div className="p-6 space-y-4">
        {filteredPens.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">
              {searchQuery ? "No pens found matching your search" : "No pens found for this operation"}
            </p>
          </div>
        ) : (
          filteredPens.map((pen) => (
            <div key={pen.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">{pen.name}</h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(pen.status)}`}>
                    {pen.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Capacity</p>
                    <p className="font-semibold">{pen.capacity} head</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Current</p>
                    <p className="font-semibold">{pen.current} head</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Feed Type:</span>
                    <span className="font-medium">{pen.feedType}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Last Fed:</span>
                    <span className="font-medium">{pen.lastFed}</span>
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
