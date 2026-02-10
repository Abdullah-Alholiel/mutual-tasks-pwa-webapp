"use client"

import { useTheme } from "next-themes";
import { Toaster as Sonner, toast as sonnerToast } from "sonner";
import { useEffect, useState } from "react";
import { CustomToast } from "./CustomToast";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      if (typeof window !== "undefined") {
        setIsMobile(window.innerWidth < 768);
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-right"
      className="toaster group"
      style={{ zIndex: 9999 }}
      gap={8}
      visibleToasts={2}
      duration={4000}
      closeButton={false}
      richColors={false}
      expand={!isMobile}
      offset={16}
      swipeDirections={['up', 'right']}
      {...props}
    />
  );
};

/**
 * Custom toast options
 */
type CustomToastOptions = {
  description?: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
};

/**
 * Custom toast function — callable directly: toast("msg") or via methods: toast.success("msg")
 * Uses Object.assign so it's both a function AND has methods.
 */
const createToast = (title: string, options?: CustomToastOptions) => {
  return sonnerToast.custom(
    (id) => (
      <CustomToast
        id={id}
        title={title}
        description={options?.description}
        type="info"
        action={options?.action}
      />
    ),
    { duration: options?.duration ?? 4000 }
  );
};

export const toast = Object.assign(createToast, {
  success: (title: string, options?: CustomToastOptions) => {
    return sonnerToast.custom(
      (id) => (
        <CustomToast
          id={id}
          title={title}
          description={options?.description}
          type="success"
          action={options?.action}
        />
      ),
      { duration: options?.duration ?? 4000 }
    );
  },

  error: (title: string, options?: CustomToastOptions) => {
    return sonnerToast.custom(
      (id) => (
        <CustomToast
          id={id}
          title={title}
          description={options?.description}
          type="error"
          action={options?.action}
        />
      ),
      { duration: options?.duration ?? 4000 }
    );
  },

  warning: (title: string, options?: CustomToastOptions) => {
    return sonnerToast.custom(
      (id) => (
        <CustomToast
          id={id}
          title={title}
          description={options?.description}
          type="warning"
          action={options?.action}
        />
      ),
      { duration: options?.duration ?? 4000 }
    );
  },

  info: (title: string, options?: CustomToastOptions) => {
    return sonnerToast.custom(
      (id) => (
        <CustomToast
          id={id}
          title={title}
          description={options?.description}
          type="info"
          action={options?.action}
        />
      ),
      { duration: options?.duration ?? 4000 }
    );
  },

  message: (title: string, options?: CustomToastOptions) => {
    return sonnerToast.custom(
      (id) => (
        <CustomToast
          id={id}
          title={title}
          description={options?.description}
          type="info"
          action={options?.action}
        />
      ),
      { duration: options?.duration ?? 4000 }
    );
  },

  dismiss: (id?: string | number) => {
    return sonnerToast.dismiss(id);
  },
});

export { Toaster };
