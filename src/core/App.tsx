import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "../features/pages/Index";
import Projects from "../features/projects/Projects";
import ProjectDetail from "../features/projects/ProjectDetail";
import Profile from "../features/profile/Profile";
import Auth from "../features/auth/Auth";
import FriendProfile from "../features/friends/pages/FriendProfile";
import NotFound from "../features/pages/NotFound";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import { ToastTest } from "../../tests/toasts/ToastTest";
import { usePWAUpdate } from "@/hooks/usePWAUpdate";
import { MainTabsShell } from "../layout/MainTabsShell";
import { AppLayout } from "../layout/AppLayout";
import { DataIntegrityGuard } from "@/components/DataIntegrityGuard";
import { GlobalErrorBoundary } from "@/components/ui/GlobalErrorBoundary";
import { PWAUpdateBanner } from "@/components/PWAUpdateBanner";
import { useEffect } from "react";
import { initializeOneSignal } from "@/lib/onesignal/oneSignalService";
import { PERFORMANCE_CONFIG } from "@/config/appConfig";
import { logger } from "@/lib/monitoring/logger";
import { initializeSentry } from "@/lib/sentry";
import { PageErrorBoundary } from "@/components/ui/error-boundary";
/**
 * OneSignal Initializer - runs once on app load
 * Placed inside AuthProvider to ensure user context is available
 */
function OneSignalInitializer() {
  useEffect(() => {
    // Initialize OneSignal in background
    initializeOneSignal().catch((err) => {
      logger.warn('[OneSignal] Initialization error (non-fatal):', err);
    });
  }, []);

  return null;
}


import { GlobalTaskViewModal } from "./GlobalTaskViewModal";
import { TaskViewModalProvider } from "@/features/tasks";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst', // Try cache first, retry on reconnect
      staleTime: PERFORMANCE_CONFIG.CACHING.TASK_DATA_STALE_TIME, // 0 seconds - INSTANT REFRESH on realtime
      gcTime: PERFORMANCE_CONFIG.CACHING.TASK_DATA_GC_TIME,
      refetchOnWindowFocus: true, // Refetch when user returns to tab
      refetchOnMount: true, // Refetch when component mounts
      refetchOnReconnect: true, // Refetch on network reconnect
      retry: 3,
    },
    mutations: {
      networkMode: 'offlineFirst', // Queue mutations when offline
      retry: 3,
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

// Setup online manager for offline support
onlineManager.setEventListener((setOnline) => {
  return typeof window !== 'undefined'
    ? (() => {
      const handleOnline = () => setOnline(true);
      const handleOffline = () => setOnline(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    })()
    : undefined;
});

const App = () => {
  // Initialize Sentry on app mount
  useEffect(() => {
    initializeSentry();
  }, []);

  const { needRefresh, forceUpdate } = usePWAUpdate();

  return (
    <GlobalErrorBoundary>
      <ThemeProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister,
            dehydrateOptions: {
              shouldDehydrateQuery: (query) => {
                const queryKey = query.queryKey;
                // CRITICAL: Never persist task data - always fetch from DB
                const keyStr = JSON.stringify(queryKey).toLowerCase();
                if (keyStr.includes('task')) {
                  return false; // Tasks must always come from database
                }
                // Exclude session queries from persistence
                return queryKey[0] !== 'session_v2';
              },
            },
          }}
        >
          {/* AuthProvider must be inside QueryClientProvider for useQueryClient access */}
          <AuthProvider>
            {/* Initialize OneSignal push notifications */}
            <OneSignalInitializer />
            <DataIntegrityGuard>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                {needRefresh && (
                  <PWAUpdateBanner
                    onRefresh={forceUpdate}
                    onDismiss={() => {/* User can ignore - state will update on next check */ }}
                  />
                )}
                <BrowserRouter
                  future={{
                    v7_startTransition: true,
                    v7_relativeSplatPath: true,
                  }}
                >
                  <TaskViewModalProvider>
                    <GlobalTaskViewModal />
                    <Routes>
                      {/* Public routes - no authentication required */}
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/auth/verify" element={<Auth />} />

                      {/* Test routes - accessible in development */}
                      <Route path="/test/toasts" element={<ToastTest />} />

                      <Route
                        element={
                          <ProtectedRoute>
                            <AppLayout />
                          </ProtectedRoute>
                        }
                      >
                        <Route path="/" element={<PageErrorBoundary><MainTabsShell /></PageErrorBoundary>} />
                        <Route path="/projects" element={<PageErrorBoundary><MainTabsShell /></PageErrorBoundary>} />
                        <Route path="/friends" element={<PageErrorBoundary><MainTabsShell /></PageErrorBoundary>} />
                        <Route path="/profile" element={<PageErrorBoundary><MainTabsShell /></PageErrorBoundary>} />
                        <Route path="/projects/:id" element={<PageErrorBoundary><ProjectDetail /></PageErrorBoundary>} />
                        <Route path="/friends/:id" element={<PageErrorBoundary><FriendProfile /></PageErrorBoundary>} />
                      </Route>

                      {/* Catch-all route - not protected (404 page) */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </TaskViewModalProvider>
                </BrowserRouter>
              </TooltipProvider>
            </DataIntegrityGuard>
          </AuthProvider>
        </PersistQueryClientProvider>
      </ThemeProvider>
    </GlobalErrorBoundary>
  );
};

export default App;
