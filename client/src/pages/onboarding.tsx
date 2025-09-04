import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertOperationSchema, type InsertOperation } from "@shared/schema";
import { useCreateOperation } from "@/hooks/use-operation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Building } from "lucide-react";

interface OnboardingProps {
  onComplete: (operation: { operatorEmail: string }) => void;
  onSwitchToLogin?: () => void;
}

export default function Onboarding({ onComplete, onSwitchToLogin }: OnboardingProps) {
  const { toast } = useToast();
  const createOperation = useCreateOperation();

  const form = useForm<InsertOperation>({
    resolver: zodResolver(insertOperationSchema),
    defaultValues: {
      inviteCode: "",
      operatorEmail: "",
      firstName: "",
      lastName: "",
      name: "",
      location: "",
    },
  });

  const onSubmit = async (data: InsertOperation) => {
    try {
      const operation = await createOperation.mutateAsync(data);
      toast({
        title: "Operation created successfully!",
        description: "Welcome to CattleNutrition Pro",
      });
      onComplete({ operatorEmail: operation.operatorEmail });
    } catch (error: any) {
      let errorMessage = "Please try again";

      if (error.message?.includes("Invalid invite code")) {
        errorMessage =
          "The invite code doesn't match your email address. Please check both fields.";
      } else if (error.message?.includes("already exists")) {
        errorMessage = "An operation with this email already exists.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Error creating operation",
        description: errorMessage,
        variant: "destructive",
      });
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
        {onSwitchToLogin && (
          <button 
            onClick={onSwitchToLogin}
            className="flex items-center space-x-2 text-sm opacity-80 hover:opacity-100 transition-opacity"
          >
            <span>Have an account?</span>
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="px-6 mb-8">
        <div className="w-full bg-white/20 rounded-full h-2">
          <div className="bg-white h-2 rounded-full transition-all duration-300 w-1/3"></div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-white rounded-t-3xl p-6">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">Setup Your Operation</h2>
          <p className="text-gray-600">
            Let's get your cattle operation configured to start managing
            nutrition schedules.
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <Label
              htmlFor="inviteCode"
              className="text-sm font-medium text-gray-700 mb-2"
            >
              Invite Code *
            </Label>
            <Input
              id="inviteCode"
              type="text"
              placeholder="Enter your invite code"
              {...form.register("inviteCode")}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              This code is provided by your organization administrator
            </p>
            {form.formState.errors.inviteCode && (
              <p className="text-sm text-red-600 mt-1">
                {form.formState.errors.inviteCode.message}
              </p>
            )}
          </div>

          <div>
            <Label
              htmlFor="operatorEmail"
              className="text-sm font-medium text-gray-700 mb-2"
            >
              Email *
            </Label>
            <Input
              id="operatorEmail"
              type="email"
              placeholder="operator@ranch.com"
              {...form.register("operatorEmail")}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              This email must match the one associated with your invite code
            </p>
            {form.formState.errors.operatorEmail && (
              <p className="text-sm text-red-600 mt-1">
                {form.formState.errors.operatorEmail.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label
                htmlFor="firstName"
                className="text-sm font-medium text-gray-700 mb-2"
              >
                First Name *
              </Label>
              <Input
                id="firstName"
                type="text"
                placeholder="John"
                {...form.register("firstName")}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              {form.formState.errors.firstName && (
                <p className="text-sm text-red-600 mt-1">
                  {form.formState.errors.firstName.message}
                </p>
              )}
            </div>

            <div>
              <Label
                htmlFor="lastName"
                className="text-sm font-medium text-gray-700 mb-2"
              >
                Last Name *
              </Label>
              <Input
                id="lastName"
                type="text"
                placeholder="Smith"
                {...form.register("lastName")}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              {form.formState.errors.lastName && (
                <p className="text-sm text-red-600 mt-1">
                  {form.formState.errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label
              htmlFor="name"
              className="text-sm font-medium text-gray-700 mb-2"
            >
              Operation Name *
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="e.g. Johnson Ranch"
              {...form.register("name")}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600 mt-1">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div>
            <Label
              htmlFor="location"
              className="text-sm font-medium text-gray-700 mb-2"
            >
              Location *
            </Label>
            <Input
              id="location"
              type="text"
              placeholder="City, State"
              {...form.register("location")}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            {form.formState.errors.location && (
              <p className="text-sm text-red-600 mt-1">
                {form.formState.errors.location.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={createOperation.isPending}
            className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary-light transition-colors"
          >
            {createOperation.isPending ? "Creating..." : "Continue"}
          </Button>

          {onSwitchToLogin && (
            <div className="text-center">
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-sm text-primary hover:text-primary-light transition-colors"
              >
                Already have an operation? Sign in here
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
