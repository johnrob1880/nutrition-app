import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Scale, TrendingUp, Award, Edit3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUpdatePenWeight } from "@/hooks/use-pen";
import { useToast } from "@/hooks/use-toast";
import type { Pen } from "@shared/schema";

interface PensProps {
  operatorEmail: string;
}

const weightUpdateSchema = z.object({
  newWeight: z.number().min(1, "Weight must be positive"),
});

type WeightUpdateData = z.infer<typeof weightUpdateSchema>;

export default function Pens({ operatorEmail }: PensProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPen, setSelectedPen] = useState<Pen | null>(null);
  const [isWeightDialogOpen, setIsWeightDialogOpen] = useState(false);
  const { toast } = useToast();
  
  const { data: pens, isLoading } = useQuery<Pen[]>({
    queryKey: ["/api/pens", operatorEmail],
  });

  const updateWeight = useUpdatePenWeight();

  const weightForm = useForm<WeightUpdateData>({
    resolver: zodResolver(weightUpdateSchema),
    defaultValues: {
      newWeight: 0,
    },
  });

  const filteredPens = pens?.filter(pen =>
    pen.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pen.feedType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pen.cattleType.toLowerCase().includes(searchQuery.toLowerCase())
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

  const getCattleTypeColor = (cattleType: string) => {
    switch (cattleType) {
      case "Steers":
        return "bg-blue-100 text-blue-800";
      case "Heifers":
        return "bg-pink-100 text-pink-800";
      case "Mixed":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleWeightUpdate = async (data: WeightUpdateData) => {
    if (!selectedPen) return;

    if (data.newWeight <= selectedPen.startingWeight) {
      toast({
        title: "Invalid Weight",
        description: `Current weight must be greater than starting weight (${selectedPen.startingWeight} lbs)`,
        variant: "destructive",
      });
      return;
    }

    try {
      await updateWeight.mutateAsync({
        penId: selectedPen.id,
        newWeight: data.newWeight,
        operatorEmail,
      });

      toast({
        title: "Weight Updated",
        description: `Successfully updated weight for ${selectedPen.name}`,
      });

      setIsWeightDialogOpen(false);
      weightForm.reset();
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update weight",
        variant: "destructive",
      });
    }
  };

  const openWeightDialog = (pen: Pen) => {
    setSelectedPen(pen);
    weightForm.setValue("newWeight", pen.currentWeight);
    setIsWeightDialogOpen(true);
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
                  <div className="flex items-center space-x-2">
                    <Badge className={getCattleTypeColor(pen.cattleType)}>{pen.cattleType}</Badge>
                    {pen.isCrossbred && <Badge variant="outline">Crossbred</Badge>}
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(pen.status)}`}>
                      {pen.status}
                    </span>
                  </div>
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

                {/* Weight Information */}
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-700 flex items-center">
                      <Scale className="h-4 w-4 mr-1" />
                      Weight Tracking
                    </h4>
                    {pen.status === "Active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openWeightDialog(pen)}
                        className="text-xs"
                      >
                        <Edit3 className="h-3 w-3 mr-1" />
                        Update
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="text-center">
                      <p className="font-medium text-gray-900">{pen.startingWeight} lbs</p>
                      <p className="text-gray-500">Starting</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-primary">{pen.currentWeight} lbs</p>
                      <p className="text-gray-500">Current</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-gray-900">{pen.marketWeight} lbs</p>
                      <p className="text-gray-500">Market</p>
                    </div>
                  </div>
                  <div className="mt-2 text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <TrendingUp className="h-3 w-3 text-secondary" />
                      <span className="text-xs font-medium text-secondary">{pen.averageDailyGain} lbs/day</span>
                    </div>
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
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Weight Records:</span>
                    <span className="font-medium">{pen.weightHistory.length} entries</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Weight Update Dialog */}
      <Dialog open={isWeightDialogOpen} onOpenChange={setIsWeightDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Current Weight</DialogTitle>
          </DialogHeader>
          {selectedPen && (
            <form onSubmit={weightForm.handleSubmit(handleWeightUpdate)} className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Updating weight for <strong>{selectedPen.name}</strong> ({selectedPen.cattleType})
                </p>
                
                <div className="grid grid-cols-3 gap-2 text-xs text-center mb-4 p-3 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium">{selectedPen.startingWeight} lbs</p>
                    <p className="text-gray-500">Starting</p>
                  </div>
                  <div>
                    <p className="font-medium text-primary">{selectedPen.currentWeight} lbs</p>
                    <p className="text-gray-500">Current</p>
                  </div>
                  <div>
                    <p className="font-medium">{selectedPen.marketWeight} lbs</p>
                    <p className="text-gray-500">Target</p>
                  </div>
                </div>

                <Label htmlFor="newWeight" className="text-sm font-medium">
                  New Current Weight (lbs)
                </Label>
                <Input
                  id="newWeight"
                  type="number"
                  min={selectedPen.startingWeight + 1}
                  max={selectedPen.marketWeight}
                  step="0.1"
                  {...weightForm.register("newWeight", { valueAsNumber: true })}
                  className="mt-1"
                />
                {weightForm.formState.errors.newWeight && (
                  <p className="text-sm text-red-600 mt-1">
                    {weightForm.formState.errors.newWeight.message}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Must be greater than {selectedPen.startingWeight} lbs (starting weight)
                </p>
              </div>

              <div className="flex space-x-3">
                <Button
                  type="submit"
                  disabled={updateWeight.isPending}
                  className="flex-1"
                >
                  {updateWeight.isPending ? "Updating..." : "Update Weight"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsWeightDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
