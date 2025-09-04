import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Building, UserCheck, CheckCircle } from "lucide-react";
import { acceptStaffInvitationSchema, type AcceptStaffInvitationForm } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function AcceptInvitation() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const [invitationError, setInvitationError] = useState<string | null>(null);

  const form = useForm<AcceptStaffInvitationForm>({
    resolver: zodResolver(acceptStaffInvitationSchema),
    defaultValues: {
      token: "",
    },
  });

  // Extract token from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      form.setValue('token', token);
      // Auto-accept if token is present
      handleAcceptInvitation(token);
    } else {
      setInvitationError('No invitation token found in URL');
    }
  }, []);

  const handleAcceptInvitation = async (token: string) => {
    setIsAccepting(true);
    try {
      const staffMember = await apiRequest('POST', '/api/staff/accept-invitation', { token });
      
      setIsAccepted(true);
      toast({
        title: "Welcome to the team!",
        description: "You can now access the cattle operation. Redirecting to login...",
      });
      
      // Redirect to login after a short delay
      setTimeout(() => {
        setLocation('/');
      }, 3000);
      
    } catch (error: any) {
      setInvitationError(error.message || 'Failed to accept invitation');
      toast({
        title: "Failed to accept invitation",
        description: error.message || "Please try again or contact your operation manager",
        variant: "destructive",
      });
    } finally {
      setIsAccepting(false);
    }
  };

  if (isAccepted) {
    return (
      <div className="min-h-screen primary-gradient flex flex-col items-center justify-center">
        <div className="bg-white rounded-2xl p-8 shadow-xl max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-semibold mb-2 text-gray-900">Welcome to the Team!</h1>
            <p className="text-gray-600 mb-6">
              Your invitation has been accepted successfully. You now have access to the cattle operation.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-green-900 mb-2">Your Access Includes:</h3>
              <ul className="text-sm text-green-700 space-y-1 text-left">
                <li>• Record cattle feeding activities</li>
                <li>• Update pen weights and cattle data</li>
                <li>• Record death loss and treatments</li>
                <li>• View all operation information</li>
              </ul>
            </div>
            <p className="text-sm text-gray-500">
              Redirecting to login page in a few seconds...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (invitationError) {
    return (
      <div className="min-h-screen primary-gradient flex flex-col items-center justify-center">
        <div className="bg-white rounded-2xl p-8 shadow-xl max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-semibold mb-2 text-gray-900">Invalid Invitation</h1>
            <p className="text-gray-600 mb-6">
              {invitationError}
            </p>
            <Button
              onClick={() => setLocation('/')}
              className="w-full"
            >
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen primary-gradient flex flex-col items-center justify-center">
      <div className="bg-white rounded-2xl p-8 shadow-xl max-w-md w-full mx-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            {isAccepting ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            ) : (
              <UserCheck className="h-8 w-8 text-blue-600" />
            )}
          </div>
          <h1 className="text-2xl font-semibold mb-2 text-gray-900">
            {isAccepting ? "Accepting Invitation..." : "Processing Invitation"}
          </h1>
          <p className="text-gray-600 mb-6">
            {isAccepting 
              ? "Please wait while we set up your access to the cattle operation." 
              : "We're processing your invitation to join the cattle operation team."
            }
          </p>
          {isAccepting && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700">
                This may take a few seconds...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}