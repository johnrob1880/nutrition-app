import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, XCircle, User, Building2, Mail } from "lucide-react";

const acceptInvitationSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(20, "Username must be 20 characters or less"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  email: z.string().email("Valid email address required"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  operationName: z.string().min(2, "Operation name must be at least 2 characters"),
  location: z.string().min(2, "Location must be at least 2 characters")
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type AcceptInvitationForm = z.infer<typeof acceptInvitationSchema>;

async function fetchInvitation(token: string) {
  console.log('🔍 Fetching invitation with token:', token);
  const url = `/api/invitations/${token}`;
  console.log('🔗 Request URL:', url);
  
  const response = await fetch(url);
  console.log('📡 Response status:', response.status);
  
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
      console.log('❌ Error response:', errorData);
    } catch (e) {
      console.log('❌ Failed to parse error response:', e);
      errorData = { error: { message: `HTTP ${response.status}: ${response.statusText}` } };
    }
    throw new Error(errorData.error?.message || `Failed to fetch invitation (${response.status})`);
  }
  
  const data = await response.json();
  console.log('✅ Success response:', data);
  return data;
}

async function acceptInvitation(token: string, data: AcceptInvitationForm) {
  const response = await fetch(`/api/invitations/${token}/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: data.username,
      password: data.password,
      fullName: data.fullName,
      operationName: data.operationName,
      location: data.location
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to accept invitation');
  }
  
  return response.json();
}

export default function VerifyInvitation() {
  const [, navigate] = useLocation();
  const params = useParams();
  const [token, setToken] = useState<string>("");
  const [showForm, setShowForm] = useState(false);

  // Extract token from URL parameters or query string
  useEffect(() => {
    console.log('🔍 Extracting token from URL...');
    console.log('📍 Current URL:', window.location.href);
    console.log('🛤️ Route params:', params);
    
    // First try route parameter (/invitations/:token)
    if (params.token) {
      console.log('✅ Found token in route params:', params.token);
      setToken(params.token);
    } else {
      // Then try query parameters (/verify-invitation?code=xxx or ?token=xxx)
      const urlParams = new URLSearchParams(window.location.search);
      console.log('🔍 URL search params:', window.location.search);
      
      const codeParam = urlParams.get('code');
      const tokenParam = urlParams.get('token');
      
      console.log('🎫 Code param:', codeParam);
      console.log('🎫 Token param:', tokenParam);
      
      if (codeParam) {
        console.log('✅ Using code param as token:', codeParam);
        setToken(codeParam);
      } else if (tokenParam) {
        console.log('✅ Using token param:', tokenParam);
        setToken(tokenParam);
      } else {
        console.log('❌ No token found in URL');
      }
    }
  }, [params]);

  // Fetch invitation details
  const { data: invitationData, isLoading: isLoadingInvitation, error: invitationError } = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => fetchInvitation(token),
    enabled: !!token,
    retry: false
  });

  // Accept invitation mutation
  const acceptMutation = useMutation({
    mutationFn: (data: AcceptInvitationForm) => acceptInvitation(token, data),
    onSuccess: (data) => {
      // Store user data and operation info for producer app
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('operatorEmail', data.user.email);
      
      // Navigate to producer dashboard
      navigate('/dashboard');
    }
  });

  const form = useForm<AcceptInvitationForm>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      email: "",
      fullName: "",
      operationName: "",
      location: ""
    }
  });

  // Pre-fill email from invitation data
  useEffect(() => {
    if (invitationData?.invitation?.producerEmail) {
      form.setValue('email', invitationData.invitation.producerEmail);
      form.setValue('fullName', invitationData.invitation.producerName || '');
    }
  }, [invitationData, form]);

  const onSubmit = (data: AcceptInvitationForm) => {
    acceptMutation.mutate(data);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-2 sm:p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-red-600">Invalid Invitation</CardTitle>
            <CardDescription>
              No invitation token found in the URL. Please check your invitation link.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoadingInvitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-2 sm:p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
            <CardTitle>Verifying Invitation</CardTitle>
            <CardDescription>
              Please wait while we verify your invitation...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (invitationError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-2 sm:p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-red-600">Invitation Error</CardTitle>
            <CardDescription>
              {invitationError.message || 'Unable to verify invitation. It may have expired or been used already.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/')} 
              className="w-full"
              variant="outline"
            >
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!showForm) {
    return (
      <Card className="w-full min-h-screen rounded-none">
          <CardHeader className="text-center px-4 sm:px-6">
            <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-green-500 mx-auto mb-3 sm:mb-4" />
            <CardTitle className="text-xl sm:text-2xl">You're Invited!</CardTitle>
            <CardDescription className="text-base sm:text-lg">
              Welcome to CattleNutrition Pro
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6 px-3 sm:px-6">
            <div className="bg-white rounded-lg p-4 sm:p-6 border">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Invitation Details</h3>
              
              <div className="space-y-3">
                <div className="flex items-start sm:items-center gap-3">
                  <User className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5 sm:mt-0" />
                  <div>
                    <p className="font-medium text-sm sm:text-base">From: {invitationData?.consultant?.name || 'Consultant'}</p>
                    <p className="text-sm text-gray-600">
                      {invitationData?.consultant?.company ?
                        invitationData.consultant.company :
                        'Nutrition Professional'
                      }
                    </p>
                    {invitationData?.consultant?.credentials && (
                      <p className="text-xs text-gray-500">{invitationData.consultant.credentials}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-start sm:items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5 sm:mt-0" />
                  <div>
                    <p className="font-medium text-sm sm:text-base">To: {invitationData?.invitation?.producerName}</p>
                    <p className="text-sm text-gray-600">{invitationData?.invitation?.producerEmail}</p>
                  </div>
                </div>
                
                {invitationData?.invitation?.message && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 mt-3 sm:mt-4">
                    <p className="text-xs sm:text-sm font-medium text-green-800 mb-2">Personal Message:</p>
                    <p className="text-green-700 italic text-sm sm:text-base">"{invitationData.invitation.message}"</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-lg p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3">What you'll get:</h3>
              <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Professional consultation on cattle nutrition programs
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Advanced feeding schedule and record management
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Expert guidance tailored to your operation
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Real-time collaboration with your consultant
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button 
                onClick={() => setShowForm(true)}
                className="w-full sm:flex-1"
                size="default"
              >
                Accept Invitation & Get Started
              </Button>
              <Button 
                onClick={() => navigate('/')}
                variant="outline"
                size="default"
                className="w-full sm:w-auto"
              >
                Decline
              </Button>
            </div>
          </CardContent>
        </Card>
    );
  }

  return (
    <Card className="min-h-screen w-full rounded-none">
        <CardHeader className="text-center px-4 sm:px-6">
          <Building2 className="w-12 h-12 sm:w-16 sm:h-16 text-green-500 mx-auto mb-3 sm:mb-4" />
          <CardTitle className="text-xl sm:text-2xl">Complete Your Setup</CardTitle>
          <CardDescription>
            Create your account and set up your cattle operation
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
            {acceptMutation.error && (
              <Alert className="border-red-200 bg-red-50">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  {acceptMutation.error.message}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  {...form.register("username")}
                  placeholder="Choose a username"
                />
                {form.formState.errors.username && (
                  <p className="text-sm text-red-600">{form.formState.errors.username.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  {...form.register("email")}
                  readOnly
                  className="bg-gray-50"
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-red-600">{form.formState.errors.email.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  {...form.register("password")}
                  placeholder="Create a secure password"
                />
                {form.formState.errors.password && (
                  <p className="text-sm text-red-600">{form.formState.errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  {...form.register("confirmPassword")}
                  placeholder="Confirm your password"
                />
                {form.formState.errors.confirmPassword && (
                  <p className="text-sm text-red-600">{form.formState.errors.confirmPassword.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                {...form.register("fullName")}
                placeholder="Your full name"
              />
              {form.formState.errors.fullName && (
                <p className="text-sm text-red-600">{form.formState.errors.fullName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="operationName">Operation Name</Label>
              <Input
                id="operationName"
                {...form.register("operationName")}
                placeholder="Name of your cattle operation"
              />
              {form.formState.errors.operationName && (
                <p className="text-sm text-red-600">{form.formState.errors.operationName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                {...form.register("location")}
                placeholder="City, State or Region"
              />
              {form.formState.errors.location && (
                <p className="text-sm text-red-600">{form.formState.errors.location.message}</p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 sm:pt-6">
              <Button 
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
                className="w-full sm:flex-1"
              >
                Back
              </Button>
              <Button 
                type="submit"
                disabled={acceptMutation.isPending}
                className="w-full sm:flex-1"
              >
                {acceptMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  'Complete Setup'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
  );
}