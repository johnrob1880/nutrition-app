import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Scale, TrendingUp, Award, Edit3, DollarSign, Calendar, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUpdatePenWeight } from "@/hooks/use-pen";
import { useSellCattle } from "@/hooks/use-cattle-sale";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Pen, InsertCattleSale, CattleSale } from "@shared/schema";

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

  // Filter active pens (status Active or Maintenance with current > 0)
  const activePens = pens?.filter(pen => 
    pen.status !== 'Inactive' && pen.current > 0
  ) || [];

  const filteredActivePens = activePens.filter(pen =>
    pen.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pen.feedType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pen.cattleType.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <h1 className="text-xl font-semibold text-gray-900">Cattle Pens</h1>
          <p className="text-sm text-gray-600">Read-only view of pens linked to your operation</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="bg-white border-b border-gray-200">
          <div className="px-6 pt-4">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="active">Active Pens</TabsTrigger>
              <TabsTrigger value="sold">Sold Cattle</TabsTrigger>
            </TabsList>
          </div>
          
          {/* Search Bar */}
          <div className="p-6 pt-4">
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
        <TabsContent value="active" className="mt-0">
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
                          variant="default"
                          onClick={() => openSellDialog(pen)}
                          className="text-xs bg-green-600 hover:bg-green-700"
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
        </TabsContent>

        {/* Sold Cattle Tab */}
        <TabsContent value="sold" className="mt-0">
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
                        <p className="text-sm text-gray-600">Final Weight</p>
                        <p className="font-semibold flex items-center">
                          <Scale className="h-4 w-4 mr-1" />
                          {sale.finalWeight} lbs
                        </p>
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
        </TabsContent>
      </Tabs>

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

      {/* Sell Cattle Dialog */}
      <Dialog open={isSellDialogOpen} onOpenChange={setIsSellDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sell Cattle</DialogTitle>
          </DialogHeader>
          {selectedPen && (
            <form onSubmit={saleForm.handleSubmit(handleCattleSale)} className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Selling cattle from <strong>{selectedPen.name}</strong> ({selectedPen.cattleType})
                </p>
                
                <div className="grid grid-cols-2 gap-2 text-xs text-center mb-4 p-3 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium text-primary">{selectedPen.current}</p>
                    <p className="text-gray-500">Head Count</p>
                  </div>
                  <div>
                    <p className="font-medium">{selectedPen.cattleType}</p>
                    <p className="text-gray-500">Type</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="finalWeight" className="text-sm font-medium">
                      Final Weight (lbs per head)
                    </Label>
                    <Input
                      id="finalWeight"
                      type="number"
                      min="1"
                      step="0.1"
                      {...saleForm.register("finalWeight", { valueAsNumber: true })}
                      className="mt-1"
                    />
                    {saleForm.formState.errors.finalWeight && (
                      <p className="text-sm text-red-600 mt-1">
                        {saleForm.formState.errors.finalWeight.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="pricePerCwt" className="text-sm font-medium">
                      Price per Hundredweight ($)
                    </Label>
                    <Input
                      id="pricePerCwt"
                      type="number"
                      min="0.01"
                      step="0.01"
                      {...saleForm.register("pricePerCwt", { valueAsNumber: true })}
                      className="mt-1"
                    />
                    {saleForm.formState.errors.pricePerCwt && (
                      <p className="text-sm text-red-600 mt-1">
                        {saleForm.formState.errors.pricePerCwt.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="saleDate" className="text-sm font-medium">
                      Sale Date
                    </Label>
                    <Input
                      id="saleDate"
                      type="date"
                      {...saleForm.register("saleDate")}
                      className="mt-1"
                    />
                    {saleForm.formState.errors.saleDate && (
                      <p className="text-sm text-red-600 mt-1">
                        {saleForm.formState.errors.saleDate.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Revenue Calculation Preview */}
                {saleForm.watch("finalWeight") && saleForm.watch("pricePerCwt") && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                    <p className="text-sm font-medium text-green-800">Estimated Revenue</p>
                    <p className="text-lg font-bold text-green-900">
                      ${((saleForm.watch("finalWeight") * saleForm.watch("pricePerCwt") / 100) * selectedPen.current).toFixed(2)}
                    </p>
                    <p className="text-xs text-green-700">
                      {selectedPen.current} head × {saleForm.watch("finalWeight")} lbs × ${saleForm.watch("pricePerCwt")}/cwt
                    </p>
                  </div>
                )}
              </div>

              <div className="flex space-x-3">
                <Button
                  type="submit"
                  disabled={sellCattle.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {sellCattle.isPending ? "Processing Sale..." : "Complete Sale"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsSellDialogOpen(false)}
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
