"use client"

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Info, 
  Calendar,
  Sparkles,
  ArrowLeft
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

export function ToastTest() {
  const navigate = useNavigate();
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  useEffect(() => {
    // Set initial width
    if (typeof window !== "undefined") {
      setViewportWidth(window.innerWidth);
    }

    // Update on resize
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="min-h-[100dvh] min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Toast Test Suite</h1>
            <p className="text-muted-foreground mt-1">
              Test all toast types and ensure they display correctly on mobile (top) and desktop (bottom)
            </p>
          </div>
        </div>

        {/* Basic Toasts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Basic Toasts
            </CardTitle>
            <CardDescription>
              Simple toast notifications with different types
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row md:flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() =>
                toast("Event has been created", {
                  description: "Sunday, December 03, 2023 at 9:00 AM",
                })
              }
              className="w-full md:w-auto"
            >
              <Calendar className="mr-2 h-4 w-4" />
              Default Toast
            </Button>

            <Button
              variant="outline"
              onClick={() =>
                toast.success("Success!", {
                  description: "Your changes have been saved successfully.",
                })
              }
              className="w-full md:w-auto"
            >
              <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
              Success Toast
            </Button>

            <Button
              variant="outline"
              onClick={() =>
                toast.error("Error occurred", {
                  description: "Failed to save changes. Please try again.",
                })
              }
              className="w-full md:w-auto"
            >
              <XCircle className="mr-2 h-4 w-4 text-red-500" />
              Error Toast
            </Button>

            <Button
              variant="outline"
              onClick={() =>
                toast.warning("Warning", {
                  description: "This action cannot be undone.",
                })
              }
              className="w-full md:w-auto"
            >
              <AlertCircle className="mr-2 h-4 w-4 text-yellow-500" />
              Warning Toast
            </Button>

            <Button
              variant="outline"
              onClick={() =>
                toast.info("Information", {
                  description: "Here's some helpful information for you.",
                })
              }
              className="w-full md:w-auto"
            >
              <Info className="mr-2 h-4 w-4 text-[#1D4ED8]" />
              Info Toast
            </Button>
          </CardContent>
        </Card>

        {/* Toasts with Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Toasts with Actions
            </CardTitle>
            <CardDescription>
              Toasts that include action buttons for user interaction
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row md:flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() =>
                toast("Event has been created", {
                  description: "Sunday, December 03, 2023 at 9:00 AM",
                  action: {
                    label: "Undo",
                    onClick: () => console.log("Undo clicked"),
                  },
                })
              }
              className="w-full md:w-auto"
            >
              Toast with Undo Action
            </Button>

            <Button
              variant="outline"
              onClick={() =>
                toast.success("File uploaded", {
                  description: "image.png has been uploaded successfully.",
                  action: {
                    label: "View",
                    onClick: () => console.log("View clicked"),
                  },
                })
              }
              className="w-full md:w-auto"
            >
              Success with Action
            </Button>

            <Button
              variant="outline"
              onClick={() =>
                toast.error("Failed to delete", {
                  description: "The item could not be deleted.",
                  action: {
                    label: "Retry",
                    onClick: () => console.log("Retry clicked"),
                  },
                })
              }
              className="w-full md:w-auto"
            >
              Error with Retry Action
            </Button>
          </CardContent>
        </Card>

        {/* Long Duration Toasts */}
        <Card>
          <CardHeader>
            <CardTitle>Long Duration Toasts</CardTitle>
            <CardDescription>
              Toasts that stay visible longer for important messages
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row md:flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() =>
                toast("Important message", {
                  description: "This toast will stay visible for 10 seconds.",
                  duration: 10000,
                })
              }
              className="w-full md:w-auto"
            >
              10 Second Toast
            </Button>

            <Button
              variant="outline"
              onClick={() =>
                toast.info("Persistent notification", {
                  description: "This toast will stay until manually closed.",
                  duration: Infinity,
                })
              }
              className="w-full md:w-auto"
            >
              Persistent Toast (Until Closed)
            </Button>
          </CardContent>
        </Card>

        {/* Multiple Toasts */}
        <Card>
          <CardHeader>
            <CardTitle>Multiple Toasts</CardTitle>
            <CardDescription>
              Test stacking behavior when multiple toasts appear
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => {
                toast("First toast");
                setTimeout(() => toast.success("Second toast"), 500);
                setTimeout(() => toast.error("Third toast"), 1000);
                setTimeout(() => toast.warning("Fourth toast"), 1500);
                setTimeout(() => toast.info("Fifth toast"), 2000);
              }}
              className="w-full md:w-auto"
            >
              Show 5 Toasts Sequentially
            </Button>
          </CardContent>
        </Card>

        {/* Mobile Positioning Test */}
        <Card>
          <CardHeader>
            <CardTitle>Mobile Positioning Test</CardTitle>
            <CardDescription>
              Verify that toasts appear at the top on mobile devices (&lt; 768px width) 
              and at the bottom on desktop devices
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Current Viewport:</p>
              <p className="text-xs text-muted-foreground">
                Width: {viewportWidth !== null ? viewportWidth : "Loading..."}px
                <br />
                Expected position: {viewportWidth !== null && viewportWidth < 768 ? "TOP" : "BOTTOM"}
                <br />
                <span className="text-xs">
                  {viewportWidth !== null && viewportWidth < 768 
                    ? "📱 Mobile view - toasts appear at top" 
                    : "🖥️ Desktop view - toasts appear at bottom"}
                </span>
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                toast("Position test", {
                  description: `This toast should appear at the ${viewportWidth !== null && viewportWidth < 768 ? "TOP" : "BOTTOM"} of the screen.`,
                })
              }
              className="w-full md:w-auto"
            >
              Test Position
            </Button>
          </CardContent>
        </Card>

        <Separator />

        {/* Instructions */}
        <Card className="bg-[#1D4ED8]/10 dark:bg-[#1D4ED8]/20 border-[#1D4ED8]/20 dark:border-[#1D4ED8]/30">
          <CardHeader>
            <CardTitle className="text-[#1D4ED8] dark:text-[#1D4ED8]">
              Testing Instructions
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[#1D4ED8] dark:text-[#1D4ED8] space-y-2">
            <p>1. On mobile: Toasts should appear at the top of the screen, below the safe area.</p>
            <p>2. On desktop: Toasts should appear at the bottom-right of the screen.</p>
            <p>3. Test on actual mobile device or resize browser to &lt; 768px width.</p>
            <p>4. Verify safe area padding on iOS devices with notch.</p>
            <p>5. Check that toasts have proper shadows, rounded corners, and are dismissible.</p>
            <p>6. Test that multiple toasts stack correctly without overlapping navigation bars.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}





