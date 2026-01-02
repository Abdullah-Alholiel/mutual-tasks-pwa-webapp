import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
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
import { ToastTest } from "../../tests/toasts/ToastTest";
import { usePWAUpdate } from "@/hooks/usePWAUpdate";
import { MainTabsShell } from "../layout/MainTabsShell";
import { AppLayout } from "../layout/AppLayout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

const App = () => {
  usePWAUpdate();

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            // Exclude session queries from persistence
            // Auth state is managed by AuthContext with localStorage
            const queryKey = query.queryKey;
            return queryKey[0] !== 'session_v2';
          },
        },
      }}
    >
      {/* AuthProvider must be inside QueryClientProvider for useQueryClient access */}
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
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
                <Route path="/" element={<MainTabsShell />} />
                <Route path="/projects" element={<MainTabsShell />} />
                <Route path="/friends" element={<MainTabsShell />} />
                <Route path="/profile" element={<MainTabsShell />} />
                <Route path="/projects/:id" element={<ProjectDetail />} />
                <Route path="/friends/:id" element={<FriendProfile />} />
              </Route>

              {/* Catch-all route - not protected (404 page) */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
};

export default App;
