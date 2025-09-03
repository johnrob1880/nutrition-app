import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Search,
  Scale,
  TrendingUp,
  Award,
  Edit3,
  DollarSign,
  Calendar,
  Users,
  User,
  Skull,
  Syringe,
  Zap,
  FileText,
  Clock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUpdatePenWeight } from "@/hooks/use-pen";
import { useSellCattle } from "@/hooks/use-cattle-sale";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import CreatePenDialog from "@/components/create-pen-dialog";
import type {
  Pen,
  InsertCattleSale,
  CattleSale,
  Nutritionist,
  DeathLoss,
  TreatmentRecord,
  InsertDeathLoss,
  InsertTreatmentRecord,
} from "@shared/schema";
import { insertDeathLossSchema, insertTreatmentSchema } from "@shared/schema";

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

type WeightUpdateData = z.infer<typeof weightUpdateSchema>;
type CattleSaleData = z.infer<typeof cattleSaleSchema>;
type DeathLossData = z.infer<typeof deathLossSchema>;
type TreatmentData = z.infer<typeof treatmentSchema>;
type PartialSaleData = z.infer<typeof partialSaleSchema>;

export default function Pens({ operatorEmail }: PensProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPen, setSelectedPen] = useState<Pen | null>(null);
  const [isWeightDialogOpen, setIsWeightDialogOpen] = useState(false);
  const [isSellDialogOpen, setIsSellDialogOpen] = useState(false);
  const [isDeathLossDialogOpen, setIsDeathLossDialogOpen] = useState(false);
  const [isTreatmentDialogOpen, setIsTreatmentDialogOpen] = useState(false);
  const [isPartialSaleDialogOpen, setIsPartialSaleDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const { toast } = useToast();

  const { data: pens, isLoading: isPensLoading } = useQuery<Pen[]>({
    queryKey: ["/api/pens", operatorEmail],
  });

  const { data: cattleSales, isLoading: isSalesLoading } = useQuery<
    CattleSale[]
  >({
    queryKey: ["/api/cattle-sales", operatorEmail],
  });

  const { data: nutritionists = [], isLoading: isNutritionistsLoading } =
    useQuery<Nutritionist[]>({
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
      saleDate: new Date().toISOString().split("T")[0],
    },
  });

  // Death Loss Form
  const deathLossForm = useForm<DeathLossData>({
    resolver: zodResolver(deathLossSchema),
    defaultValues: {
      penId: "",
      lossDate: new Date().toISOString().split('T')[0],
      reason: "",
      cattleCount: 1,
      estimatedWeight: 0,
      tagNumbers: "",
      notes: "",
    },
  });

  // Treatment Form
  const treatmentForm = useForm<TreatmentData>({
    resolver: zodResolver(treatmentSchema),
    defaultValues: {
      penId: "",
      treatmentDate: new Date().toISOString().split('T')[0],
      treatmentType: "",
      product: "",
      dosage: "",
      cattleCount: 1,
      tagNumbers: "",
      treatedBy: operatorEmail,
      notes: "",
    },
  });

  // Partial Sale Form
  const partialSaleForm = useForm<PartialSaleData>({
    resolver: zodResolver(partialSaleSchema),
    defaultValues: {
      penId: "",
      saleDate: new Date().toISOString().split('T')[0],
      cattleCount: 1,
      finalWeight: 0,
      pricePerCwt: 0,
      tagNumbers: "",
      buyer: "",
      notes: "",
    },
  });

  // Helper function to get nutritionist info
  const getNutritionistInfo = (nutritionistId?: string) => {
    if (!nutritionistId || !nutritionists) return null;
    return nutritionists.find((n) => n.id === nutritionistId);
  };

  // Filter active pens (status Active or Maintenance with current > 0)
  const activePens =
    pens?.filter((pen) => pen.status !== "Inactive" && pen.current > 0) || [];

  const filteredActivePens = activePens.filter((pen) => {
    const nutritionist = getNutritionistInfo(pen.nutritionistId);
    const nutritionistName = nutritionist
      ? `${nutritionist.personalName} ${nutritionist.businessName}`
      : "";

    return (
      pen.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pen.feedType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pen.cattleType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      nutritionistName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Filter sold cattle (cattle sales)
  const filteredSoldCattle =
    cattleSales?.filter(
      (sale) =>
        sale.penName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sale.cattleType.toLowerCase().includes(searchQuery.toLowerCase()),
    ) || [];

  // Get sold pens (inactive pens with 0 cattle)
  const soldPens = pens?.filter(pen => pen.status === "Inactive" && pen.current === 0) || [];

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
    saleForm.setValue("saleDate", new Date().toISOString().split("T")[0]);
    setIsSellDialogOpen(true);
  };

  const handleCattleSale = async (data: CattleSaleData) => {
    if (!selectedPen) return;

    try {
      // Get operation ID using apiRequest
      const operationResponse = await apiRequest(
        "GET",
        `/api/operation/${operatorEmail}`,
      );
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

  // Death Loss handlers
  const openDeathLossDialog = (pen: Pen) => {
    setSelectedPen(pen);
    deathLossForm.setValue("penId", pen.id);
    deathLossForm.setValue("estimatedWeight", pen.currentWeight);
    setIsDeathLossDialogOpen(true);
  };

  const handleDeathLoss = async (data: DeathLossData) => {
    if (!selectedPen) return;

    try {
      const operation = await apiRequest("GET", `/api/operation/${operatorEmail}`);
      const operationData = await operation.json();

      const deathLossData: InsertDeathLoss = {
        ...data,
        operationId: operationData.id,
        operatorEmail,
      };

      await apiRequest("POST", "/api/death-loss", deathLossData);

      // Invalidate pen data to refresh counts
      queryClient.invalidateQueries({ queryKey: ["/api/pens", operatorEmail] });

      toast({
        title: "Death Loss Recorded",
        description: `${data.cattleCount} head loss recorded for ${selectedPen.name}`,
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
  const openTreatmentDialog = (pen: Pen) => {
    setSelectedPen(pen);
    treatmentForm.setValue("penId", pen.id);
    treatmentForm.setValue("cattleCount", pen.current);
    setIsTreatmentDialogOpen(true);
  };

  const openPartialSaleDialog = (pen: Pen) => {
    setSelectedPen(pen);
    partialSaleForm.setValue('penId', pen.id);
    partialSaleForm.setValue('cattleCount', Math.min(pen.current, 1));
    partialSaleForm.setValue('finalWeight', pen.currentWeight || pen.marketWeight);
    setIsPartialSaleDialogOpen(true);
  };

  const handleTreatment = async (data: TreatmentData) => {
    if (!selectedPen) return;

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
        description: `Treatment recorded for ${data.cattleCount} head in ${selectedPen.name}`,
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
    if (!selectedPen) return;

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
        description: `${data.cattleCount} head sold from ${selectedPen.name}`,
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
              <h1 className="text-xl font-semibold text-gray-900">
                Cattle Pens
              </h1>
              <p className="text-sm text-gray-600">
                Manage your cattle pens and track livestock
              </p>
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
              placeholder={
                activeTab === "active"
                  ? "Search pens..."
                  : "Search sold cattle..."
              }
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
                {searchQuery
                  ? "No active pens found matching your search"
                  : "No active pens found"}
              </p>
            </div>
          ) : (
            filteredActivePens.map((pen) => (
              <div
                key={pen.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200"
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Link href={`/pen/${pen.id}`}>
                        <h3 className="text-lg font-semibold hover:text-blue-600 cursor-pointer">{pen.name}</h3>
                      </Link>
                      {pen.status === "Active" && pen.current > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                              <Zap className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => openDeathLossDialog(pen)}>
                              <Skull className="h-4 w-4 mr-2" />
                              Record Death Loss
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openTreatmentDialog(pen)}>
                              <Syringe className="h-4 w-4 mr-2" />
                              Record Treatment
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openPartialSaleDialog(pen)}>
                              <DollarSign className="h-4 w-4 mr-2" />
                              Record Partial Sale
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getCattleTypeColor(pen.cattleType)}>
                        {pen.cattleType}
                      </Badge>
                      {pen.isCrossbred && (
                        <Badge variant="outline">Crossbred</Badge>
                      )}
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(pen.status)}`}
                      >
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
                        <p className="font-medium text-gray-900">
                          {pen.startingWeight} lbs
                        </p>
                        <p className="text-gray-500">Starting</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-primary">
                          {pen.currentWeight} lbs
                        </p>
                        <p className="text-gray-500">Current</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-gray-900">
                          {pen.marketWeight} lbs
                        </p>
                        <p className="text-gray-500">Market</p>
                      </div>
                    </div>
                    <div className="mt-2 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <TrendingUp className="h-3 w-3 text-secondary" />
                        <span className="text-xs font-medium text-secondary">
                          {pen.averageDailyGain} lbs/day
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Feed Type:</span>
                      <Link href={`/feeding-plan/${pen.id}`}>
                        <span className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer underline">
                          {pen.feedType}
                        </span>
                      </Link>
                    </div>
                    
                    {/* Nutritionist Card */}
                    {(() => {
                      const nutritionist = getNutritionistInfo(pen.nutritionistId);
                      return nutritionist ? (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-blue-900 truncate">{nutritionist.personalName}</p>
                              <p className="text-xs text-blue-700 truncate">{nutritionist.businessName}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-white" />
                            </div>
                            <p className="text-sm text-gray-600">No nutritionist assigned</p>
                          </div>
                        </div>
                      );
                    })()}
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Last Fed:</span>
                      <span className="font-medium">{pen.lastFed}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Weight Records:</span>
                      <span className="font-medium">
                        {pen.weightHistory.length} entries
                      </span>
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
                {searchQuery
                  ? "No sold cattle found matching your search"
                  : "No cattle sales recorded yet"}
              </p>
            </div>
          ) : (
            filteredSoldCattle.map((sale) => (
              <div
                key={sale.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200"
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">{sale.penName}</h3>
                    <div className="flex items-center space-x-2">
                      <Badge className={getCattleTypeColor(sale.cattleType)}>
                        {sale.cattleType}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="bg-green-50 text-green-700 border-green-200"
                      >
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
                        <p className="font-medium text-gray-900">
                          {sale.startingWeight} lbs
                        </p>
                        <p className="text-gray-500">Starting</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-primary">
                          {sale.finalWeight} lbs
                        </p>
                        <p className="text-gray-500">Final</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-secondary">
                          {sale.finalWeight - sale.startingWeight} lbs
                        </p>
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
                        <p className="font-medium text-green-900">
                          ${sale.pricePerCwt}/cwt
                        </p>
                        <p className="text-green-600">Price per CWT</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-green-900">
                          ${sale.totalRevenue.toFixed(2)}
                        </p>
                        <p className="text-green-600">Total Revenue</p>
                      </div>
                    </div>

                    <div className="text-center pt-1 border-t border-green-200">
                      <p className="text-xs text-green-700">
                        {sale.cattleCount} head × {sale.finalWeight} lbs × $
                        {sale.pricePerCwt}/cwt
                      </p>
                    </div>
                  </div>

                  {/* Additional Details */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Sale Date:</span>
                      <span className="font-medium">
                        {new Date(sale.saleDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Record Created:</span>
                      <span className="font-medium">
                        {new Date(sale.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Sale ID:</span>
                      <span className="font-medium font-mono text-xs">
                        {sale.id}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Pending Closeout Reports Section */}
          {soldPens.length > 0 && (
            <div className="mt-8 bg-white rounded-lg shadow-sm">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Pending Closeout Reports
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Nutritionist-generated performance reports for sold cattle
                </p>
              </div>
              <div className="p-4 space-y-4">
                {soldPens.map((pen) => {
                  const sale = cattleSales?.find(s => s.penId === pen.id);
                  // Get nutritionist from sale record first, then fall back to pen record
                  const nutritionistId = sale?.nutritionistId || pen.nutritionistId;
                  const nutritionist = nutritionists?.find(n => n.id === nutritionistId);
                  
                  return (
                    <div key={pen.id} className="border rounded-lg p-4 bg-orange-50 border-orange-200">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-orange-900">{pen.name} - Closeout Report</h4>
                          <p className="text-sm text-orange-700">
                            Sold {sale ? new Date(sale.saleDate).toLocaleDateString() : 'Recently'}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 text-orange-600">
                          <Clock className="h-4 w-4" />
                          <span className="text-sm font-medium">Pending</span>
                        </div>
                      </div>
                      
                      <div className="bg-white rounded p-3 mb-3">
                        <h5 className="text-sm font-medium text-gray-900 mb-2">Report Contents</h5>
                        <ul className="text-sm text-gray-600 space-y-1">
                          <li>• Feed efficiency analysis</li>
                          <li>• Weight gain performance vs. projections</li>
                          <li>• Cost per pound of gain breakdown</li>
                          <li>• Feed conversion ratio summary</li>
                          <li>• Recommendations for future lots</li>
                        </ul>
                      </div>

                      {nutritionist ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <User className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{nutritionist.personalName}</p>
                              <p className="text-xs text-gray-600">{nutritionist.businessName}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-orange-600 font-medium">Expected completion</p>
                            <p className="text-xs text-gray-500">
                              {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()} 
                              <span className="ml-1">(7 days)</span>
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-100 rounded p-3">
                          <p className="text-sm text-gray-600">
                            No active nutritionist assigned. Contact your nutritionist to generate this report.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Weight Update Dialog */}
      <Dialog open={isWeightDialogOpen} onOpenChange={setIsWeightDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Weight - {selectedPen?.name}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={weightForm.handleSubmit(handleWeightUpdate)}
            className="space-y-4"
          >
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
                <p className="text-sm text-red-600">
                  {weightForm.formState.errors.newWeight.message}
                </p>
              )}
            </div>

            {selectedPen && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Current Weight:</span>
                    <span className="font-medium">
                      {selectedPen.currentWeight} lbs
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Starting Weight:</span>
                    <span className="font-medium">
                      {selectedPen.startingWeight} lbs
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Market Weight:</span>
                    <span className="font-medium">
                      {selectedPen.marketWeight} lbs
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsWeightDialogOpen(false)}
              >
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
          <form
            onSubmit={saleForm.handleSubmit(handleCattleSale)}
            className="space-y-4"
          >
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
                <p className="text-sm text-red-600">
                  {saleForm.formState.errors.finalWeight.message}
                </p>
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
                <p className="text-sm text-red-600">
                  {saleForm.formState.errors.pricePerCwt.message}
                </p>
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
                <p className="text-sm text-red-600">
                  {saleForm.formState.errors.saleDate.message}
                </p>
              )}
            </div>

            {selectedPen && (
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cattle Count:</span>
                    <span className="font-medium">
                      {selectedPen.current} head
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Expected Revenue:</span>
                    <span className="font-medium text-green-700">
                      $
                      {(
                        ((saleForm.watch("finalWeight") || 0) *
                          (saleForm.watch("pricePerCwt") || 0) *
                          (selectedPen.current || 0)) /
                        100
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSellDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={sellCattle.isPending}>
                {sellCattle.isPending ? "Processing..." : "Sell Cattle"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Death Loss Dialog */}
      <Dialog open={isDeathLossDialogOpen} onOpenChange={setIsDeathLossDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Death Loss</DialogTitle>
          </DialogHeader>
          <form onSubmit={deathLossForm.handleSubmit(handleDeathLoss)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lossDate">Date of Loss</Label>
              <Input
                id="lossDate"
                type="date"
                {...deathLossForm.register("lossDate")}
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
              <Input
                id="treatmentDate"
                type="date"
                {...treatmentForm.register("treatmentDate")}
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
              <Label htmlFor="treatedBy">Treated By</Label>
              <Input
                id="treatedBy"
                {...treatmentForm.register("treatedBy")}
                placeholder="Name of person administering treatment"
              />
              {treatmentForm.formState.errors.treatedBy && (
                <p className="text-sm text-red-600">
                  {treatmentForm.formState.errors.treatedBy.message}
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
              <Input
                id="saleDate"
                type="date"
                {...partialSaleForm.register("saleDate")}
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
                max={selectedPen?.current || 1}
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

            {selectedPen && (
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
                      {selectedPen.current - (partialSaleForm.watch("cattleCount") || 0)} head
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
  );
}
