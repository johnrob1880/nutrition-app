import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useOperation } from "@/hooks/use-operation";
import { useQuery } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/error-boundary";

import Onboarding from "@/pages/onboarding";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Pens from "@/pages/pens";
import PenOverview from "@/pages/pen-overview";
import Schedules from "@/pages/schedules";
import OperationPage from "@/pages/operation";
import Feeding from "@/pages/feeding";
import FeedingDetails from "@/pages/feeding-details";
import FeedingPlanDetails from "@/pages/feeding-plan";
import AcceptInvitation from "@/pages/accept-invitation";
import VerifyInvitation from "@/pages/verify-invitation";
import BottomNav from "@/components/bottom-nav";
import NotFound from "@/pages/not-found";

import type { DashboardStats } from "@shared/schema";

function AppContent() {
  const [currentOperation, setCurrentOperation] = useState<string | null>(
    localStorage.getItem("operatorEmail")
  );
  const [operationId, setOperationId] = useState<number | null>(
    localStorage.getItem("operationId") ? Number(localStorage.getItem("operationId")) : null
  )

  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check if we're on an invitation route first (before authentication)
  const isInvitationRoute = window.location.pathname.startsWith('/invitations/') || 
                           window.location.pathname === '/verify-invitation' ||
                           window.location.pathname === '/accept-invitation';

  const { data: operation } = useOperation(currentOperation || "");
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard", operationId],
    enabled: !!operationId,
  });

  // Set operation ID when operation data is fetched
  useEffect(() => {
    if (operation?.id && operationId !== operation.id) {
      localStorage.setItem("operationId", operation.id.toString());
      setOperationId(operation.id);
    }
  }, [operation, operationId]);

  const handleOnboardingComplete = (operationData: { operatorEmail: string }) => {
    localStorage.setItem("operatorEmail", operationData.operatorEmail);
    setCurrentOperation(operationData.operatorEmail);
    setShowOnboarding(false);
  };

  const handleLoginSuccess = (operatorEmail: string) => {
    localStorage.setItem("operatorEmail", operatorEmail);
    setCurrentOperation(operatorEmail);
    setShowOnboarding(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("operatorEmail");
    localStorage.removeItem("userRole");
    localStorage.removeItem("operationId");
    setCurrentOperation(null);
    setShowOnboarding(false);
    // Clear query cache to ensure fresh data on next login
    queryClient.clear();
  };

  // Handle invitation routes first (no authentication required)
  if (isInvitationRoute) {
    return (
      <div className="min-h-screen">
        <ErrorBoundary>
          <Switch>
            <Route path="/accept-invitation" component={AcceptInvitation} />
            <Route path="/invitations/:token" component={VerifyInvitation} />
            <Route path="/verify-invitation" component={VerifyInvitation} />
            <Route component={NotFound} />
          </Switch>
        </ErrorBoundary>
      </div>
    );
  }

  // If no current operation or operation doesn't exist, show login or onboarding
  if (!currentOperation || (currentOperation && !operation)) {
    if (showOnboarding) {
      return (
        <ErrorBoundary>
          <Onboarding
            onComplete={handleOnboardingComplete}
            onSwitchToLogin={() => setShowOnboarding(false)}
          />
        </ErrorBoundary>
      );
    } else {
      return (
        <ErrorBoundary>
          <Login
            onLoginSuccess={handleLoginSuccess}
            onSwitchToOnboarding={() => setShowOnboarding(true)}
          />
        </ErrorBoundary>
      );
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Switch>
        <Route path="/" component={() => (
          <ErrorBoundary>
            <Dashboard
              operationId={operationId}
              operationName={operation?.name || ""}
              operationLocation={operation?.location || ""}
            />
          </ErrorBoundary>
        )} />
        <Route path="/dashboard" component={() => (
          <ErrorBoundary>
            <Dashboard
              operationId={operationId}
              operationName={operation?.name || ""}
              operationLocation={operation?.location || ""}
            />
          </ErrorBoundary>
        )} />
        <Route path="/pens" component={() => (
          <ErrorBoundary>
            <Pens operationId={operationId} />
          </ErrorBoundary>
        )} />
        <Route path="/pen/:penId" component={() => (
          <ErrorBoundary>
            <PenOverview operationId={operationId} />
          </ErrorBoundary>
        )} />
        <Route path="/feeding-plan/:penId" component={() => (
          <ErrorBoundary>
            <FeedingPlanDetails operationId={operationId!} />
          </ErrorBoundary>
        )} />
        <Route path="/schedules" component={() => (
          <ErrorBoundary>
            <Schedules operationId={operationId} />
          </ErrorBoundary>
        )} />
        <Route path="/operation" component={() => (
          <ErrorBoundary>
            <OperationPage operation={operation!} stats={stats} onLogout={handleLogout} />
          </ErrorBoundary>
        )} />
        <Route path="/feeding/:penId/:scheduleId" component={() => (
          <ErrorBoundary>
            <Feeding operationId={operationId} />
          </ErrorBoundary>
        )} />
        <Route path="/feeding-details/:feedingRecordId" component={() => (
          <ErrorBoundary>
            <FeedingDetails operationId={operationId} />
          </ErrorBoundary>
        )} />
        <Route component={NotFound} />
      </Switch>

      <ErrorBoundary>
        <BottomNav currentOperation={currentOperation} />
      </ErrorBoundary>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log critical app-level errors
        console.error("App-level error:", error, errorInfo);
      }}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <AppContent />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
