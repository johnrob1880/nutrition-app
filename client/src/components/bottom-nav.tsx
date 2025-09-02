import { useLocation } from "wouter";
import { Home, Building, Calendar, User } from "lucide-react";

interface BottomNavProps {
  currentOperation: string | null;
}

export default function BottomNav({ currentOperation }: BottomNavProps) {
  const [location, setLocation] = useLocation();

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: Home, path: "/" },
    { id: "pens", label: "Pens", icon: Building, path: "/pens" },
    { id: "schedules", label: "Schedules", icon: Calendar, path: "/schedules" },
    { id: "operation", label: "Operation", icon: User, path: "/operation" },
  ];

  if (!currentOperation) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-2 z-50">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          // Make dashboard active for both "/" and "/dashboard" paths
          const isActive = location === tab.path || (tab.path === "/" && location === "/dashboard");
          
          return (
            <button
              key={tab.id}
              onClick={() => setLocation(tab.path)}
              className={`flex flex-col items-center space-y-1 py-2 px-3 transition-colors ${
                isActive 
                  ? "text-primary" 
                  : "text-gray-500 hover:text-primary"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
