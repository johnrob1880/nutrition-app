import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Scale, TrendingUp, Award, Edit3, DollarSign, Calendar, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUpdatePenWeight } from "@/hooks/use-pen";
import { useSellCattle } from "@/hooks/use-cattle-sale";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import CreatePenDialog from "@/components/create-pen-dialog";
import type { Pen, InsertCattleSale, CattleSale, Nutritionist } from "@shared/schema";

interface PensProps {
  operatorEmail: string;
}

const weightUpdateSchema = z.object({
  newWeight: z.number().min(1, "Weight must be positive"),
});

const cattleSaleSchema = z.object({
  finalWeight: z.number().min(1, "Final weight must be positive"),
  pricePerCwt: z.number().min(0.01, "Price per CWT must be positive"),
  saleDate: z.string().min(1, "Sale date is required"),
});

type WeightUpdateData = z.infer<typeof weightUpdateSchema>;
type CattleSaleData = z.infer<typeof cattleSaleSchema>;

export default function Pens({ operatorEmail }: PensProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPen, setSelectedPen] = useState<Pen | null>(null);
  const [isWeightDialogOpen, setIsWeightDialogOpen] = useState(false);
  const [isSellDialogOpen, setIsSellDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const { toast } = useToast();
  
  const { data: pens, isLoading: isPensLoading } = useQuery<Pen[]>({
    queryKey: ["/api/pens", operatorEmail],
  });

  const { data: cattleSales, isLoading: isSalesLoading } = useQuery<CattleSale[]>({
    queryKey: ["/api/cattle-sales", operatorEmail],
  });

  const { data: nutritionists = [], isLoading: isNutritionistsLoading } = useQuery<Nutritionist[]>({
    queryKey: ["/api/nutritionists", operatorEmail],
  });

  const updateWeight = useUpdatePenWeight();
  const sellCattle = useSellCattle();

  const weightForm = useForm<WeightUpdateData>({
    resolver: zodResolver(weightUpdateSchema),
    defaultValues: {
      newWeight: 0,
    },
  });

  const saleForm = useForm<CattleSaleData>({
    resolver: zodResolver(cattleSaleSchema),
    defaultValues: {
      finalWeight: 0,
      pricePerCwt: 0,
      saleDate: new Date().toISOString().split('T')[0],
    },
  });

  // Helper function to get nutritionist info
  const getNutritionistInfo = (nutritionistId?: string) => {
    if (!nutritionistId || !nutritionists) return null;
    return nutritionists.find(n => n.id === nutritionistId);
  };

  // Filter active pens (status Active or Maintenance with current > 0)
  const activePens = pens?.filter(pen => 
    pen.status !== 'Inactive' && pen.current > 0
  ) || [];

  const filteredActivePens = activePens.filter(pen => {
    const nutritionist = getNutritionistInfo(pen.nutritionistId);
    const nutritionistName = nutritionist ? `${nutritionist.personalName} ${nutritionist.businessName}` : '';
    
    return pen.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pen.feedType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pen.cattleType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      nutritionistName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Filter sold cattle (cattle sales)
  const filteredSoldCattle = cattleSales?.filter(sale =>
    sale.penName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sale.cattleType.toLowerCase().includes(searchQuery.toLowerCase())
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
        description: `${selectedPen.name} weight updated to ${data.newWeight} lbs`,
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

  const openSellDialog = (pen: Pen) => {
    setSelectedPen(pen);
    saleForm.setValue("finalWeight", pen.marketWeight);
    saleForm.setValue("pricePerCwt", 180); // Default price per cwt
    saleForm.setValue("saleDate", new Date().toISOString().split('T')[0]);
    setIsSellDialogOpen(true);
  };

  const handleCattleSale = async (data: CattleSaleData) => {
    if (!selectedPen) return;

    try {
      // Get operation ID using apiRequest
      const operationResponse = await apiRequest("GET", `/api/operation/${operatorEmail}`);
      const operation = await operationResponse.json();
      
      const saleData: InsertCattleSale = {
        operationId: operation.id,
        penId: selectedPen.id,
        finalWeight: data.finalWeight,
        pricePerCwt: data.pricePerCwt,
        saleDate: data.saleDate,
        operatorEmail,
      };

      await sellCattle.mutateAsync(saleData);

      toast({
        title: "Cattle Sold Successfully",
        description: `${selectedPen.current} head sold from ${selectedPen.name}`,
      });

      setIsSellDialogOpen(false);
      saleForm.reset();
    } catch (error: any) {
      toast({
        title: "Sale Failed",
        description: error.message || "Failed to process cattle sale",
        variant: "destructive",
      });
    }
  };

  if (isPensLoading || isSalesLoading) {
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Cattle Pens</h1>
              <p className="text-sm text-gray-600">Manage your cattle pens and track livestock</p>
            </div>
            <CreatePenDialog operatorEmail={operatorEmail} />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border-b border-gray-100">
        <div className="px-6 py-3">
          <div className="flex space-x-4">
            {[
              { id: "active", label: "Active Pens" },
              { id: "sold", label: "Sold Cattle" },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveTab(filter.id)}
                className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
                  activeTab === filter.id
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

      {/* Search Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder={activeTab === "active" ? "Search pens..." : "Search sold cattle..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Active Pens Tab */}
      {activeTab === "active" && (
        <div className="p-6 space-y-4">
          {filteredActivePens.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {searchQuery ? "No active pens found matching your search" : "No active pens found"}
              </p>
            </div>
          ) : (
            filteredActivePens.map((pen) => (
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
                      <div className="flex space-x-2">
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
                        {pen.status === "Active" && pen.current > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openSellDialog(pen)}
                            className="text-xs bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                          >
                            <DollarSign className="h-3 w-3 mr-1" />
                            Sell
                          </Button>
                        )}
                      </div>
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
                      <span className="text-gray-600">Nutritionist:</span>
                      <span className="font-medium">
                        {(() => {
                          const nutritionist = getNutritionistInfo(pen.nutritionistId);
                          return nutritionist 
                            ? `${nutritionist.personalName} (${nutritionist.businessName})`
                            : pen.nutritionistId || "Not assigned";
                        })()}
                      </span>
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
      )}

      {/* Sold Cattle Tab */}
      {activeTab === "sold" && (
        <div className="p-6 space-y-4">
          {filteredSoldCattle.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {searchQuery ? "No sold cattle found matching your search" : "No cattle sales recorded yet"}
              </p>
            </div>
          ) : (
            filteredSoldCattle.map((sale) => (
              <div key={sale.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">{sale.penName}</h3>
                    <div className="flex items-center space-x-2">
                      <Badge className={getCattleTypeColor(sale.cattleType)}>{sale.cattleType}</Badge>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Sold
                      </Badge>
                    </div>
                  </div>

                  {/* Sale Overview */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Cattle Count</p>
                      <p className="font-semibold flex items-center">
                        <Users className="h-4 w-4 mr-1" />
                        {sale.cattleCount} head
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Days on Feed</p>
                      <p className="font-semibold flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {sale.daysOnFeed} days
                      </p>
                    </div>
                  </div>

                  {/* Weight Details */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-700 flex items-center">
                        <Scale className="h-4 w-4 mr-1" />
                        Weight Performance
                      </h4>
                      <div className="flex items-center text-xs text-secondary">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {sale.averageDailyGain} lbs/day
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="text-center">
                        <p className="font-medium text-gray-900">{sale.startingWeight} lbs</p>
                        <p className="text-gray-500">Starting</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-primary">{sale.finalWeight} lbs</p>
                        <p className="text-gray-500">Final</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-secondary">{sale.finalWeight - sale.startingWeight} lbs</p>
                        <p className="text-gray-500">Total Gain</p>
                      </div>
                    </div>
                  </div>

                  {/* Sale Details */}
                  <div className="bg-green-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-green-700 flex items-center">
                        <DollarSign className="h-4 w-4 mr-1" />
                        Sale Information
                      </h4>
                      <div className="flex items-center text-xs text-green-600">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(sale.saleDate).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs mb-2">
                      <div className="text-center">
                        <p className="font-medium text-green-900">${sale.pricePerCwt}/cwt</p>
                        <p className="text-green-600">Price per CWT</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-green-900">${sale.totalRevenue.toFixed(2)}</p>
                        <p className="text-green-600">Total Revenue</p>
                      </div>
                    </div>
                    
                    <div className="text-center pt-1 border-t border-green-200">
                      <p className="text-xs text-green-700">
                        {sale.cattleCount} head × {sale.finalWeight} lbs × ${sale.pricePerCwt}/cwt
                      </p>
                    </div>
                  </div>

                  {/* Additional Details */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Sale Date:</span>
                      <span className="font-medium">{new Date(sale.saleDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Record Created:</span>
                      <span className="font-medium">{new Date(sale.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Sale ID:</span>
                      <span className="font-medium font-mono text-xs">{sale.id}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Weight Update Dialog */}
      <Dialog open={isWeightDialogOpen} onOpenChange={setIsWeightDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Weight - {selectedPen?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={weightForm.handleSubmit(handleWeightUpdate)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newWeight">New Weight (lbs)</Label>
              <Input
                id="newWeight"
                type="number"
                step="0.1"
                {...weightForm.register("newWeight", { valueAsNumber: true })}
                placeholder="Enter new weight"
              />
              {weightForm.formState.errors.newWeight && (
                <p className="text-sm text-red-600">{weightForm.formState.errors.newWeight.message}</p>
              )}
            </div>
            
            {selectedPen && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Current Weight:</span>
                    <span className="font-medium">{selectedPen.currentWeight} lbs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Starting Weight:</span>
                    <span className="font-medium">{selectedPen.startingWeight} lbs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Market Weight:</span>
                    <span className="font-medium">{selectedPen.marketWeight} lbs</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsWeightDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateWeight.isPending}>
                {updateWeight.isPending ? "Updating..." : "Update Weight"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cattle Sale Dialog */}
      <Dialog open={isSellDialogOpen} onOpenChange={setIsSellDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Sell Cattle - {selectedPen?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saleForm.handleSubmit(handleCattleSale)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="finalWeight">Final Weight (lbs)</Label>
              <Input
                id="finalWeight"
                type="number"
                step="0.1"
                {...saleForm.register("finalWeight", { valueAsNumber: true })}
                placeholder="Enter final weight"
              />
              {saleForm.formState.errors.finalWeight && (
                <p className="text-sm text-red-600">{saleForm.formState.errors.finalWeight.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="pricePerCwt">Price per CWT ($)</Label>
              <Input
                id="pricePerCwt"
                type="number"
                step="0.01"
                {...saleForm.register("pricePerCwt", { valueAsNumber: true })}
                placeholder="Enter price per hundredweight"
              />
              {saleForm.formState.errors.pricePerCwt && (
                <p className="text-sm text-red-600">{saleForm.formState.errors.pricePerCwt.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="saleDate">Sale Date</Label>
              <Input
                id="saleDate"
                type="date"
                {...saleForm.register("saleDate")}
              />
              {saleForm.formState.errors.saleDate && (
                <p className="text-sm text-red-600">{saleForm.formState.errors.saleDate.message}</p>
              )}
            </div>
            
            {selectedPen && (
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cattle Count:</span>
                    <span className="font-medium">{selectedPen.current} head</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Expected Revenue:</span>
                    <span className="font-medium text-green-700">
                      ${((saleForm.watch("finalWeight") || 0) * (saleForm.watch("pricePerCwt") || 0) * (selectedPen.current || 0) / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsSellDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={sellCattle.isPending}>
                {sellCattle.isPending ? "Processing..." : "Sell Cattle"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}