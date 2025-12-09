import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "../features/pages/Index";
import Projects from "../features/projects/Projects";
import ProjectDetail from "../features/projects/ProjectDetail";
import Profile from "../features/profile/Profile";
import Auth from "../features/auth/Auth";
import NotFound from "../features/pages/NotFound";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { ToastTest } from "../../tests/toasts/ToastTest";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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
          
          {/* Protected routes - require authentication */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects"
            element={
              <ProtectedRoute>
                <Projects />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:id"
            element={
              <ProtectedRoute>
                <ProjectDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          
          {/* Catch-all route - not protected (404 page) */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
