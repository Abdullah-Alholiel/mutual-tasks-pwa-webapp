// ============================================================================
// React Hook for Authentication
// ============================================================================
// This hook provides access to the global authentication state.
// It wraps the AuthContext to maintain backwards compatibility with existing code.
// ============================================================================

import { useAuthContext } from './AuthContext';
import type { User } from '@/types';

export interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

/**
 * Hook to access authentication state.
 * 
 * This hook consumes the AuthContext which provides:
 * - Synchronous user hydration from localStorage (no flicker!)
 * - Background session verification
 * - Automatic session refresh
 * 
 * @example
 * ```tsx
 * const { user, isAuthenticated, logout } = useAuth();
 * 
 * if (!isAuthenticated) {
 *   return <Navigate to="/auth" />;
 * }
 * 
 * return <div>Welcome, {user?.name}!</div>;
 * ```
 */
export function useAuth(): UseAuthReturn {
  const { user, loading, error, refresh, logout, isAuthenticated } = useAuthContext();

  return {
    user,
    loading,
    error,
    refresh,
    logout,
    isAuthenticated,
  };
}
