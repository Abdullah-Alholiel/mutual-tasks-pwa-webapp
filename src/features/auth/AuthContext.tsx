// ============================================================================
// AuthContext - Global Authentication State Management
// ============================================================================
// This context provides synchronous access to the authenticated user.
// The user is initialized from localStorage BEFORE any component renders,
// ensuring no "undefined" or "U" flickering in the UI.
//
// Key Features:
// - Synchronous hydration from localStorage on mount
// - Background verification/refresh via React Query
// - Single source of truth for auth state across the app
// ============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getCurrentUser, logout as performLogout, refreshSession } from '@/lib/auth/auth';
import {
  setSessionToken,
  getSessionToken,
  getStoredUserSync,
  setStoredUserSync,
  clearSessionToken,
} from '@/lib/auth/sessionStorage';
import { toast } from '@/components/ui/sonner';
import type { User } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface AuthContextValue {
  /** The authenticated user, null if not authenticated */
  user: User | null;
  /** True only during initial verification when no cached user exists */
  loading: boolean;
  /** Error from the last auth operation */
  error: Error | null;
  /** True if user is authenticated (user !== null) */
  isAuthenticated: boolean;
  /** Refresh the user data from the server */
  refresh: () => Promise<void>;
  /** Log out the current user */
  logout: () => Promise<void>;
  /** Set the user (used after successful login) */
  setUser: (user: User | null) => void;
}

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ============================================================================
// Synchronous Initialization
// ============================================================================

/**
 * Get initial user state synchronously from localStorage.
 * This runs BEFORE React renders, ensuring user is available immediately.
 */
function getInitialUser(): User | null {
  const cached = getStoredUserSync();
  if (cached && cached.id && cached.name) {
    return cached as User;
  }
  return null;
}

/**
 * Check if we have a valid session token
 */
function hasValidToken(): boolean {
  return !!getSessionToken();
}

// ============================================================================
// Provider Component
// ============================================================================

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Initialize user synchronously from localStorage - this is the key fix!
  // The user is available on the FIRST render, not after an async operation.
  // Using a ref to track the initial cached user for comparison during verification
  const initialUser = getInitialUser();
  const [user, setUserState] = useState<User | null>(initialUser);

  // Loading is only true if we have a token but no cached user (rare edge case)
  const [loading, setLoading] = useState<boolean>(() => {
    const hasToken = hasValidToken();
    // Only show loading if we have a token but no cached user
    return hasToken && !initialUser;
  });

  const [error, setError] = useState<Error | null>(null);
  const queryClient = useQueryClient();

  // Memoized setUser that also updates localStorage
  const setUser = useCallback((newUser: User | null) => {
    setUserState(newUser);
    setStoredUserSync(newUser);
  }, []);

  // Background verification - fetches fresh user data from server
  // CRITICAL: This function NEVER clears a valid cached user during verification.
  // It only updates the user if we get fresh valid data from the server.
  const verifySession = useCallback(async () => {
    const token = getSessionToken();
    if (!token) {
      // No token = not authenticated, clear user
      setUserState(null);
      setStoredUserSync(null);
      setLoading(false);
      return;
    }

    // Get current cached user to preserve during verification
    const cachedUser = getStoredUserSync();

    try {
      const freshUser = await getCurrentUser(undefined, undefined, true);

      if (freshUser) {
        // Update state and cache with fresh data
        setUserState(freshUser);
        setStoredUserSync(freshUser);
        setError(null);
      } else {
        // getCurrentUser returned null - this could be:
        // 1. Token is truly invalid
        // 2. Network/transient error
        // 
        // If we have a cached user, KEEP IT. Don't flash undefined.
        // Only clear if we have no cached user (meaning the token was explicitly rejected)
        if (!cachedUser) {
          // No cached user and server returned null = token is invalid
          setUserState(null);
          setStoredUserSync(null);
          clearSessionToken();
        }
        // If we have a cached user, keep using it (optimistic UI)
        // The next refresh cycle will try again
      }
    } catch (err) {
      // On error, keep cached user (don't log out on network errors)
      console.warn('Session verification failed:', err);
      setError(err instanceof Error ? err : new Error('Session verification failed'));
      // Don't clear user on transient errors - user stays logged in with cached data
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle handoff token from URL (magic link flow)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const handoffToken = urlParams.get('handoff_token');

    if (handoffToken) {
      const expiresAt = urlParams.get('expires_at') || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
      setSessionToken(handoffToken, expiresAt);

      // Clean up URL
      urlParams.delete('handoff_token');
      urlParams.delete('expires_at');
      const newSearch = urlParams.toString();
      const newUrl = newSearch
        ? `${window.location.pathname}?${newSearch}`
        : window.location.pathname;
      window.history.replaceState({}, '', newUrl);

      toast.success("You're in! Welcome back. 👋");

      // Verify the new session
      verifySession();
    }
  }, [verifySession]);

  // Initial verification on mount (background, non-blocking)
  useEffect(() => {
    // Always verify in background to ensure user data is fresh
    verifySession();

    // Periodic session refresh
    const refreshInterval = setInterval(async () => {
      const refreshed = await refreshSession();
      if (refreshed) {
        verifySession();
      }
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(refreshInterval);
  }, [verifySession]);

  // Refresh handler
  const refresh = useCallback(async () => {
    await verifySession();
  }, [verifySession]);

  // Logout handler
  const logout = useCallback(async () => {
    try {
      await performLogout();
    } catch (err) {
      console.error('Logout failed:', err);
    }

    // Clear all state
    setUserState(null);
    setStoredUserSync(null);
    queryClient.clear();

    // Redirect to auth
    if (typeof window !== 'undefined') {
      window.location.href = '/auth';
    }
  }, [queryClient]);

  // Memoize context value
  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    error,
    isAuthenticated: !!user,
    refresh,
    logout,
    setUser,
  }), [user, loading, error, refresh, logout, setUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access authentication state.
 * Must be used within an AuthProvider.
 */
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;

