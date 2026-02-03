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
import { ErrorBoundary, PageErrorBoundary } from "@/components/ui/error-boundary";
import { TaskViewModalProvider } from "@/features/tasks";
import { GlobalTaskViewModal } from "./GlobalTaskViewModal";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst', // Try cache first, retry on reconnect
      // CRITICAL: Short staleTime for instant realtime updates
      staleTime: 1000, // 1 second - data becomes stale quickly for realtime
      gcTime: 1000 * 60 * 5, // 5 minutes - garbage collect stale data faster
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
  usePWAUpdate();

  return (
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
          <DataIntegrityGuard>
            <TaskViewModalProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter
                  future={{
                    v7_startTransition: true,
                    v7_relativeSplatPath: true,
                  }}
                >
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
                </BrowserRouter>
              </TooltipProvider>
            </TaskViewModalProvider>
          </DataIntegrityGuard>
        </AuthProvider>
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
