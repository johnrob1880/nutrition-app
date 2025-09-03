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
import BottomNav from "@/components/bottom-nav";
import NotFound from "@/pages/not-found";

import type { DashboardStats } from "@shared/schema";

function AppContent() {
  const [currentOperation, setCurrentOperation] = useState<string | null>(
    localStorage.getItem("operatorEmail")
  );
  const [showOnboarding, setShowOnboarding] = useState(false);

  const { data: operation } = useOperation(currentOperation || "");
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard", currentOperation],
    enabled: !!currentOperation,
  });

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
    setCurrentOperation(null);
    setShowOnboarding(false);
    // Clear query cache to ensure fresh data on next login
    queryClient.clear();
  };

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
            operatorEmail={currentOperation}
            operationName={operation?.name || ""}
            operationLocation={operation?.location || ""}
          />
        } />
        <Route path="/dashboard" component={() => 
          <Dashboard 
            operatorEmail={currentOperation}
            operationName={operation?.name || ""}
            operationLocation={operation?.location || ""}
          />
        } />
        <Route path="/pens" component={() => 
          <Pens operatorEmail={currentOperation} />
        } />
        <Route path="/pen/:penId" component={() => 
          <PenOverview operatorEmail={currentOperation} />
        } />
        <Route path="/schedules" component={() => 
          <Schedules operatorEmail={currentOperation} />
        } />
        <Route path="/operation" component={() => 
          <OperationPage operation={operation!} stats={stats} onLogout={handleLogout} />
        } />
        <Route path="/feeding/:penId/:scheduleId" component={() => 
          <Feeding operatorEmail={currentOperation} />
        } />
        <Route path="/feeding-details/:feedingRecordId" component={() => 
          <FeedingDetails operatorEmail={currentOperation} />
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
