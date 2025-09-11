import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, Info } from "lucide-react";
import { useAutoMigration } from "@/hooks/use-feeding-migration";

interface MigrationNoticeProps {
  penId: number;
  onMigrationComplete?: () => void;
}

export function MigrationNotice({ penId, onMigrationComplete }: MigrationNoticeProps) {
  const { needsMigration, isReady, migrate, isMigrating } = useAutoMigration(penId);
  const [showDetails, setShowDetails] = useState(false);

  if (isReady || !needsMigration) {
    return null; // No migration needed
  }

  const handleMigrate = async () => {
    await migrate();
    onMigrationComplete?.();
  };

  return (
    <Card className="mb-6 border-blue-200 bg-blue-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-blue-900">System Upgrade Available</CardTitle>
          </div>
          <Badge variant="secondary">New Features</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-blue-800">
            This pen can be upgraded to use our new feeding program system with enhanced features:
          </p>
          
          {showDetails && (
            <ul className="text-sm text-blue-700 space-y-1 ml-4">
              <li>• Advanced multi-phase feeding programs</li>
              <li>• Variance-only recording (faster data entry)</li>
              <li>• Multiple daily feeding times</li>
              <li>• Real-time completion tracking</li>
              <li>• Better nutritional planning tools</li>
            </ul>
          )}

          <div className="flex items-center gap-2">
            <Button
              onClick={handleMigrate}
              disabled={isMigrating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isMigrating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Upgrading...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Upgrade Now
                </>
              )}
            </Button>
            
            <Button
              variant="ghost"
              onClick={() => setShowDetails(!showDetails)}
              className="text-blue-600"
            >
              {showDetails ? 'Hide Details' : 'Learn More'}
            </Button>
          </div>
          
          <p className="text-xs text-blue-600">
            Your existing data will be preserved and enhanced. This upgrade is recommended for all pens.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}