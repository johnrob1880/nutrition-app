import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Building2, User } from "lucide-react";
import type { Nutritionist, AcceptInvitationRequest } from "@shared/schema";

interface NutritionistManagementProps {
  operatorEmail: string;
}

export default function NutritionistManagement({ operatorEmail }: NutritionistManagementProps) {
  const { toast } = useToast();

  // Fetch nutritionists
  const { data: nutritionists = [], isLoading } = useQuery<Nutritionist[]>({
    queryKey: ["/api/nutritionists", operatorEmail],
    enabled: !!operatorEmail,
  });

  // Accept invitation mutation
  const acceptMutation = useMutation({
    mutationFn: async (nutritionistId: string) => {
      const requestData: AcceptInvitationRequest = {
        nutritionistId,
        operatorEmail,
      };

      const response = await fetch("/api/nutritionists/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to accept invitation");
      }

      return response.json();
    },
    onSuccess: (updatedNutritionist) => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionists", operatorEmail] });
      toast({
        title: "Invitation accepted!",
        description: `${updatedNutritionist.personalName} can now manage feed types for your pens.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error accepting invitation",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleAcceptInvitation = (nutritionistId: string) => {
    acceptMutation.mutate(nutritionistId);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Nutritionists</h3>
        </div>
        <div className="text-center py-8 text-gray-500">
          Loading nutritionists...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Nutritionists</h3>
          <p className="text-sm text-gray-600">Nutritionist invitations are managed by the external system</p>
        </div>
      </div>

      {nutritionists.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No nutritionist invitations yet</p>
              <p className="text-sm text-gray-400 mb-6">
                Nutritionist invitations will appear here when sent by the external system
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {nutritionists.map((nutritionist) => (
            <Card key={nutritionist.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{nutritionist.personalName}</CardTitle>
                    <CardDescription className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4" />
                      <span>{nutritionist.businessName}</span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    ID: {nutritionist.id}
                  </Badge>
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant={nutritionist.status === 'Active' ? 'default' : 'outline'} 
                      className="text-xs"
                    >
                      {nutritionist.status}
                    </Badge>
                    {nutritionist.status === 'Invited' && (
                      <Button
                        size="sm"
                        onClick={() => handleAcceptInvitation(nutritionist.id)}
                        disabled={acceptMutation.isPending}
                        className="h-6 px-2 text-xs"
                      >
                        {acceptMutation.isPending ? "Accepting..." : "Accept"}
                      </Button>
                    )}
                  </div>
                </div>
                {nutritionist.status === 'Active' && nutritionist.acceptedAt && (
                  <p className="text-xs text-gray-500 mt-2">
                    Accepted {new Date(nutritionist.acceptedAt).toLocaleDateString()}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}