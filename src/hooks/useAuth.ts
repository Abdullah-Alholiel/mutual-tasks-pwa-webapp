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

  const loadUser = useCallback(async (retryCount: number = 0): Promise<void> => {
    // Only set loading on first call
    if (retryCount === 0) {
      setLoading(true);
      setError(null);
    }
    
    try {
      // Try to get current user with retry on transient errors
      const currentUser = await getCurrentUser(undefined, undefined, retryCount < 2);
      
      if (currentUser) {
        setUser(currentUser);
        setError(null);
        setLoading(false);
        return;
      }
      
      // If no user but we have a token, it might be a transient error
      // Check if token exists in localStorage
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('momentum_session_token');
        if (token && retryCount < 2) {
          // Token exists but verification failed - likely transient error
          // Retry after a delay
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return loadUser(retryCount + 1);
        }
      }
      
      // No user and no token (or max retries reached)
      setUser(null);
      setLoading(false);
    } catch (err) {
      // Only set error if it's not a transient verification error
      const isTransientError = 
        err instanceof Error && 
        (err.name === 'SessionVerificationError' || 
         err.message.includes('transient') ||
         err.message.includes('network') ||
         err.message.includes('connection'));
      
      if (!isTransientError) {
        setError(err instanceof Error ? err : new Error('Failed to load user'));
      }
      
      // If we have a token, try one more time after delay
      if (typeof window !== 'undefined' && retryCount < 2) {
        const token = localStorage.getItem('momentum_session_token');
        if (token) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return loadUser(retryCount + 1);
        }
      }
      
      setUser(null);
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

