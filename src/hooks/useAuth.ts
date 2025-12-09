// ============================================================================
// React Hook for Authentication
// ============================================================================
// Works with both Vite and Next.js (client components)
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { getCurrentUser, logout, refreshSession } from '@/lib/auth';
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
 * Hook to manage authentication state
 * 
 * Usage:
 * ```tsx
 * const { user, loading, isAuthenticated } = useAuth();
 * 
 * if (loading) return <Spinner />;
 * if (!isAuthenticated) return <LoginPage />;
 * return <App />;
 * ```
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load user'));
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();

    // Refresh session on mount and periodically
    const refreshInterval = setInterval(async () => {
      await refreshSession();
    }, 30 * 60 * 1000); // Refresh every 30 minutes

    return () => clearInterval(refreshInterval);
  }, [loadUser]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      setUser(null);
      setError(null);
      // Optionally redirect to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/auth';
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to logout'));
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    await loadUser();
  }, [loadUser]);

  return {
    user,
    loading,
    error,
    refresh: handleRefresh,
    logout: handleLogout,
    isAuthenticated: user !== null && !loading,
  };
}

