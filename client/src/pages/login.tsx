import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useOperation } from "@/hooks/use-operation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building, ArrowLeft } from "lucide-react";

const loginSchema = z.object({
  operatorEmail: z.string().email("Please enter a valid email address"),
});

type LoginForm = z.infer<typeof loginSchema>;

interface LoginProps {
  onLoginSuccess: (operatorEmail: string) => void;
  onSwitchToOnboarding: () => void;
}

export default function Login({ onLoginSuccess, onSwitchToOnboarding }: LoginProps) {
  const { toast } = useToast();
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      operatorEmail: "",
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsCheckingEmail(true);
    try {
      // Check user role (owner or staff)
      const roleResponse = await fetch(`/api/user-role/${data.operatorEmail}`);
      
      if (roleResponse.ok) {
        const userRole = await roleResponse.json();
        
        // Store user information in localStorage
        localStorage.setItem('userRole', userRole.role);
        localStorage.setItem('operationId', userRole.operationId.toString());
        
        toast({
          title: "Login successful!",
          description: `Welcome back to CattleNutrition Pro${userRole.role === 'staff' ? ' (Staff Access)' : ''}`,
        });
        onLoginSuccess(data.operatorEmail);
      } else if (roleResponse.status === 404) {
        // Check if this is an operation owner that needs to be set up
        const operationResponse = await fetch(`/api/operation/${data.operatorEmail}`);
        
        if (operationResponse.ok) {
          toast({
            title: "Login successful!",
            description: "Welcome back to CattleNutrition Pro",
          });
          onLoginSuccess(data.operatorEmail);
        } else {
          toast({
            title: "Account not found",
            description: "No account found for this email. Please check your email or create a new operation.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Login failed",
          description: "An error occurred. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: "Unable to connect to the server. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingEmail(false);
    }
  };

  return (
    <div className="min-h-screen primary-gradient flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 text-white">
        <div className="flex items-center space-x-3">
          <Building className="h-6 w-6" />
          <h1 className="text-xl font-semibold">CattleNutrition Pro</h1>
        </div>
        <button 
          onClick={onSwitchToOnboarding}
          className="flex items-center space-x-2 text-sm opacity-80 hover:opacity-100 transition-opacity"
        >
          <span>New user?</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 bg-white rounded-t-3xl p-6 mt-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">Welcome Back</h2>
          <p className="text-gray-600">
            Sign in to your cattle operation account to continue managing your nutrition schedules.
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <Label htmlFor="operatorEmail" className="text-sm font-medium text-gray-700 mb-2">
              Operator Email *
            </Label>
            <Input
              id="operatorEmail"
              type="email"
              placeholder="operator@ranch.com"
              {...form.register("operatorEmail")}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the email address associated with your operation
            </p>
            {form.formState.errors.operatorEmail && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.operatorEmail.message}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isCheckingEmail}
            className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary-light transition-colors"
          >
            {isCheckingEmail ? "Checking..." : "Sign In"}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={onSwitchToOnboarding}
              className="text-sm text-primary hover:text-primary-light transition-colors"
            >
              Don't have an operation? Create one here
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}