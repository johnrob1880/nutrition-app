import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertOperationSchema, type InsertOperation, type Operation } from "@shared/schema";
import { useUpdateOperation } from "@/hooks/use-operation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Edit, HelpCircle, Mail, RefreshCw, LogOut } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NutritionistManagement from "@/components/nutritionist-management";

interface OperationProps {
  operation: Operation;
  stats?: {
    totalPens: number;
    totalCattle: number;
    activeSchedules: number;
    avgFeedPerDay: string;
    lastSync: string;
  };
  onLogout: () => void;
}

export default function OperationPage({ operation, stats, onLogout }: OperationProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const updateOperation = useUpdateOperation();

  const form = useForm<InsertOperation>({
    resolver: zodResolver(insertOperationSchema),
    defaultValues: {
      name: operation.name,
      operatorEmail: operation.operatorEmail,
      location: operation.location,
      inviteCode: operation.inviteCode,
    },
  });

  const onSubmit = async (data: InsertOperation) => {
    try {
      await updateOperation.mutateAsync({ id: operation.id, data });
      setIsEditing(false);
      toast({
        title: "Operation updated successfully",
        description: "Your operation information has been saved.",
      });
    } catch (error: any) {
      toast({
        title: "Error updating operation",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    form.reset();
    setIsEditing(false);
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="px-6 py-4">
          <h1 className="text-xl font-semibold text-gray-900">Operation Profile</h1>
          <p className="text-sm text-gray-600">Manage your operation information</p>
        </div>
      </div>

      {/* Profile Content */}
      <div className="p-6 space-y-6">
        <Tabs defaultValue="operation" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="operation">Operation Info</TabsTrigger>
            <TabsTrigger value="nutritionists">Team</TabsTrigger>
          </TabsList>
          
          <TabsContent value="operation">
            {/* Operation Info Card */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Operation Information</h2>
              {!isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="text-primary border-primary hover:bg-primary/5"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </div>

          <div className="p-4">
            {isEditing ? (
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-sm font-medium text-gray-700 mb-1">
                    Operation Name
                  </Label>
                  <Input
                    id="name"
                    {...form.register("name")}
                    className="w-full"
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="operatorEmail" className="text-sm font-medium text-gray-700 mb-1">
                    Operator Email
                  </Label>
                  <Input
                    id="operatorEmail"
                    type="email"
                    {...form.register("operatorEmail")}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This email links your operation to cattle pens in the external system
                  </p>
                  {form.formState.errors.operatorEmail && (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.operatorEmail.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="location" className="text-sm font-medium text-gray-700 mb-1">
                    Location
                  </Label>
                  <Input
                    id="location"
                    {...form.register("location")}
                    className="w-full"
                  />
                  {form.formState.errors.location && (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.location.message}</p>
                  )}
                </div>

                <div className="flex space-x-3 pt-4">
                  <Button
                    type="submit"
                    disabled={updateOperation.isPending}
                    className="flex-1 bg-primary hover:bg-primary-light"
                  >
                    {updateOperation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1">Operation Name</Label>
                  <p className="text-gray-900 font-medium">{operation.name}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1">Operator Email</Label>
                  <p className="text-gray-900">{operation.operatorEmail}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    This email links your operation to cattle pens in the external system
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1">Location</Label>
                  <p className="text-gray-900">{operation.location}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1">Setup Date</Label>
                  <p className="text-gray-900">{new Date(operation.setupDate).toLocaleDateString()}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Statistics Card */}
        {stats && (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold">Operation Statistics</h2>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-primary/5 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{stats.totalPens}</p>
                  <p className="text-sm text-gray-600">Total Pens</p>
                </div>
                <div className="text-center p-4 bg-secondary/5 rounded-lg">
                  <p className="text-2xl font-bold text-secondary">{stats.totalCattle}</p>
                  <p className="text-sm text-gray-600">Total Cattle</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Active Schedules:</span>
                  <span className="font-medium">{stats.activeSchedules}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Average Feed per Day:</span>
                  <span className="font-medium">{stats.avgFeedPerDay}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Data Last Synced:</span>
                  <span className="font-medium text-primary">{stats.lastSync}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Support Card */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold">Support & Help</h2>
          </div>

          <div className="p-4 space-y-3">
            <button className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
              <div className="flex items-center space-x-3">
                <HelpCircle className="h-5 w-5 text-gray-400" />
                <span className="font-medium">Help Center</span>
              </div>
              <span className="text-gray-400">›</span>
            </button>

            <button className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-gray-400" />
                <span className="font-medium">Contact Support</span>
              </div>
              <span className="text-gray-400">›</span>
            </button>

            <button className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
              <div className="flex items-center space-x-3">
                <RefreshCw className="h-5 w-5 text-gray-400" />
                <span className="font-medium">Sync Data</span>
              </div>
              <span className="text-gray-400">›</span>
            </button>
          </div>
        </div>

            {/* Logout Section */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-4">
                <button 
                  onClick={onLogout}
                  className="w-full flex items-center justify-center p-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                >
                  <LogOut className="h-5 w-5 mr-2" />
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="nutritionists">
            <NutritionistManagement operatorEmail={operation.operatorEmail} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
