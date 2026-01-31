import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, X } from "lucide-react";

interface PWAUpdateBannerProps {
  onRefresh: () => void;
  onDismiss: () => void;
}

/**
 * PWA Update Notification Banner
 *
 * Displays a non-intrusive banner at the bottom of the screen
 * when a new version of the PWA is available.
 *
 * Features:
 * - Auto-dismissable (X button)
 * - Force refresh button to apply update
 * - Unobtrusive design (bottom sheet style)
 * - Respects user choice (can be ignored)
 */
export function PWAUpdateBanner({ onRefresh, onDismiss }: PWAUpdateBannerProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6">
      <Card className="shadow-lg border-primary/50 bg-primary/5 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-primary/10 p-2">
              <RefreshCw className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <CardTitle className="text-base font-semibold">
                Update Available
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                A new version of Momentum is ready to install
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onDismiss}
            aria-label="Dismiss update notification"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="pb-4 pt-0">
          <p className="text-sm text-muted-foreground">
            Updates include bug fixes, performance improvements, and new features.
            Refreshing now will apply the update.
          </p>
        </CardContent>
        <CardFooter className="gap-2 pt-0">
          <Button
            variant="outline"
            onClick={onDismiss}
            className="flex-1"
          >
            Later
          </Button>
          <Button
            onClick={onRefresh}
            className="flex-1 gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Update Now
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
