import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useOperation } from "@/hooks/use-operation";
import { useQuery } from "@tanstack/react-query";

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
        <Switch>
          <Route path="/accept-invitation" component={AcceptInvitation} />
          <Route path="/invitations/:token" component={VerifyInvitation} />
          <Route path="/verify-invitation" component={VerifyInvitation} />
          <Route component={NotFound} />
        </Switch>
      </div>
    );
  }

  // If no current operation or operation doesn't exist, show login or onboarding
  if (!currentOperation || (currentOperation && !operation)) {
    if (showOnboarding) {
      return (
        <Onboarding 
          onComplete={handleOnboardingComplete} 
          onSwitchToLogin={() => setShowOnboarding(false)}
        />
      );
    } else {
      return (
        <Login 
          onLoginSuccess={handleLoginSuccess}
          onSwitchToOnboarding={() => setShowOnboarding(true)}
        />
      );
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Switch>
        <Route path="/" component={() => 
          <Dashboard 
            operationId={operationId}
            operationName={operation?.name || ""}
            operationLocation={operation?.location || ""}
          />
        } />
        <Route path="/dashboard" component={() => 
          <Dashboard 
            operationId={operationId}
            operationName={operation?.name || ""}
            operationLocation={operation?.location || ""}
          />
        } />
        <Route path="/pens" component={() => 
          <Pens operationId={operationId} />
        } />
        <Route path="/pen/:penId" component={() => 
          <PenOverview operationId={operationId} />
        } />
        <Route path="/feeding-plan/:penId" component={() => 
          <FeedingPlanDetails operationId={operationId!} />
        } />
        <Route path="/schedules" component={() => 
          <Schedules operationId={operationId} />
        } />
        <Route path="/operation" component={() => 
          <OperationPage operation={operation!} stats={stats} onLogout={handleLogout} />
        } />
        <Route path="/feeding/:penId/:scheduleId" component={() => 
          <Feeding operationId={operationId} />
        } />
        <Route path="/feeding-details/:feedingRecordId" component={() => 
          <FeedingDetails operationId={operationId} />
        } />
        <Route component={NotFound} />
      </Switch>
      
      
      <BottomNav currentOperation={currentOperation} />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
