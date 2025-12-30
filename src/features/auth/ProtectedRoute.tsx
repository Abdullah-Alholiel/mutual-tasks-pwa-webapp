// ============================================================================
// Protected Route Component
// ============================================================================
// Wraps routes that require authentication
// Redirects to /auth if user is not authenticated
//
// With the AuthContext synchronous hydration:
// - User is available immediately from localStorage on mount
// - No loading flicker when refreshing or switching tabs
// - Loading state is only shown when we have a token but no cached user (rare)
// ============================================================================

import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/useAuth';
import { PageLoader } from '@/components/ui/loader';
import { getSessionToken } from '@/lib/auth/sessionStorage';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Protected Route Component
 * 
 * Usage:
 * ```tsx
 * <Route path="/dashboard" element={
 *   <ProtectedRoute>
 *     <Dashboard />
 *   </ProtectedRoute>
 * } />
 * ```
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, isAuthenticated } = useAuth();

  // With synchronous hydration, user should be available immediately
  // if there's cached data. Loading is only true in edge cases.

  // Case 1: User is available (from cache or fresh fetch) - render immediately
  if (user || isAuthenticated) {
    return <>{children}</>;
  }

  // Case 2: Still loading AND we have a token - show minimal loader
  // This only happens when we have a token but no cached user (rare edge case)
  const hasToken = getSessionToken() !== null;
  if (loading && hasToken) {
    return <PageLoader text="Resuming session..." />;
  }

  // Case 3: Loading without token - checking auth state
  if (loading) {
    return <PageLoader text="Authenticating..." />;
  }

  // Case 4: Not authenticated and done loading - redirect to auth
  return <Navigate to="/auth" replace />;
}
