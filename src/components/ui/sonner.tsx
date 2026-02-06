"use client"

import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { useEffect, useState } from "react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const [position, setPosition] = useState<ToasterProps["position"]>("top-center");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if mobile device (screen width < 768px)
    const checkMobile = () => {
      if (typeof window !== "undefined") {
        const mobile = window.innerWidth < 768;
        setIsMobile(mobile);
        // Always show on bottom for mobile, top-right for desktop
        setPosition(mobile ? "bottom-center" : "top-right");
      }
    };

    // Set initial position
    checkMobile();

    // Update on resize
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position={position}
      className="toaster group"
      // Ensure toasts appear above everything
      style={{
        zIndex: 9999,
        // Add safe area padding on mobile for iOS home indicator
        ...(isMobile && {
          bottom: 'env(safe-area-inset-bottom, 0px)',
          paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
        }),
      }}
      // No gap - toasts overlap completely on top of each other
      gap={0}
      // Visible toasts count
      visibleToasts={3}
      // Toast duration (4 seconds default)
      duration={4000}
      // Close button for accessibility
      closeButton
      // Rich colors for better visibility
      richColors
      // Expand toasts on hover (desktop)
      expand={!isMobile}
      // Smooth animations
      offset={0}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl font-medium",
          description: "group-[.toast]:text-muted-foreground font-normal",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg",
          closeButton: "group-[.toast]:bg-background group-[.toast]:border-border",
        },
        // Ensure consistent styling
        style: {
          borderRadius: '14px',
          padding: '16px',
          boxShadow: '0 8px 16px -4px rgba(0, 0, 0, 0.1)',
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
