// ============================================================================
// Unified Authentication Utilities
// ============================================================================
// Single source of truth for all authentication operations
// Works with both Vite and Next.js (client and server)
// ============================================================================

import { getDatabaseClient } from '@/db';
import type { User } from '@/types';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env';
import {
  getSessionToken,
  setSessionToken,
  clearSessionToken,
} from '@/lib/auth/sessionStorage';

/**
 * Get Supabase URL lazily (called inside functions, not at module load)
 * This ensures environment variables are available in Vite
 */
function getSupabaseUrlLazy(): string {
  const url = getSupabaseUrl();
  if (!url) {
    // Debug: log what we tried to find
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      console.error('Environment check - import.meta.env keys:', Object.keys(import.meta.env));
      console.error('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
    }
    if (typeof process !== 'undefined' && process.env) {
      console.error('Environment check - process.env keys:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
    }
    throw new Error(
      'Supabase URL not configured. Please set VITE_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in your .env file and restart the dev server.'
    );
  }
  
  // Ensure URL doesn't have trailing slash
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/**
 * Get Supabase Anon Key lazily (called inside functions, not at module load)
 * This ensures environment variables are available in Vite
 */
function getSupabaseAnonKeyLazy(): string {
  const key = getSupabaseAnonKey();
  if (!key) {
    throw new Error(
      'Supabase Anon Key not configured. Please set VITE_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file and restart the dev server.'
    );
  }
  return key;
}

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Custom error class for session verification failures
 */
export class SessionVerificationError extends Error {
  constructor(
    message: string,
    public readonly isTransient: boolean = false,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'SessionVerificationError';
  }
}

/**
 * Verify a session token and return the user
 * This is the core session verification logic used by all auth functions
 * 
 * @throws SessionVerificationError if verification fails
 *   - isTransient: true for network/database errors (should retry)
 *   - isTransient: false for invalid/expired tokens (should clear)
 */
async function verifySessionToken(token: string): Promise<User | null> {
  try {
    const db = getDatabaseClient();
    const userId = await db.sessions.getUserIdFromToken(token);
    
    if (!userId) {
      // Token is invalid or expired - not a transient error
      return null;
    }

    // Update last accessed time
    try {
      await db.sessions.updateLastAccessed(token);
    } catch (error) {
      // If update fails but we have a valid userId, it's likely a transient error
      // Log it but don't fail the verification
      console.warn('Failed to update last accessed time (non-critical):', error);
    }
    
    // Get user details
    const user = await db.users.getById(userId);
    
    if (!user) {
      // User not found - token might be invalid, but could also be transient
      // Return null but don't throw - let caller decide
      return null;
    }
    
    return user;
  } catch (error) {
    // Check if it's a network/database connection error (transient)
    const isNetworkError = 
      error instanceof TypeError && error.message.includes('fetch') ||
      error instanceof Error && (
        error.message.includes('network') ||
        error.message.includes('connection') ||
        error.message.includes('timeout') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('Failed to fetch')
      );
    
    if (isNetworkError) {
      // This is a transient error - don't clear the token
      throw new SessionVerificationError(
        'Network error during session verification',
        true,
        error
      );
    }
    
    // For other errors, check if it's a database configuration issue
    const isConfigError = 
      error instanceof Error && (
        error.message.includes('Supabase configuration') ||
        error.message.includes('not configured') ||
        error.message.includes('environment')
      );
    
    if (isConfigError) {
      // Configuration error - likely transient during dev server restart
      throw new SessionVerificationError(
        'Database configuration error during session verification',
        true,
        error
      );
    }
    
    // Unknown error - assume transient to be safe
    throw new SessionVerificationError(
      'Unknown error during session verification',
      true,
      error
    );
  }
}

/**
 * Get current user from session
 * Client-side: Reads from localStorage
 * Server-side: Requires request or cookies parameter
 * 
 * @param request - Optional Request object for server-side token extraction
 * @param nextCookies - Optional Next.js cookies helper for server-side
 * @param retryOnTransientError - Whether to retry on transient errors (default: false)
 */
export async function getCurrentUser(
  request?: Request | { headers: Headers },
  nextCookies?: { get: (name: string) => { value: string } | undefined },
  retryOnTransientError: boolean = false
): Promise<User | null> {
  const token = getSessionToken(request, nextCookies);
  if (!token) return null;

  try {
    const user = await verifySessionToken(token);
    
    // If token is invalid (not expired, just invalid), clear it
    if (!user && isBrowser()) {
      // Only clear if we're sure it's invalid (not a transient error)
      clearSessionToken();
    }
    
    return user;
  } catch (error) {
    // Handle SessionVerificationError
    if (error instanceof SessionVerificationError) {
      // If it's a transient error, preserve the token and optionally retry
      if (error.isTransient) {
        if (retryOnTransientError) {
          // Retry once after a short delay
          await new Promise(resolve => setTimeout(resolve, 500));
          try {
            return await getCurrentUser(request, nextCookies, false);
          } catch (retryError) {
            // If retry also fails, return null but preserve token
            console.warn('Session verification retry failed:', retryError);
            return null;
          }
        }
        // Transient error - preserve token, return null
        console.warn('Session verification failed (transient error, preserving token):', error.message);
        return null;
      } else {
        // Non-transient error - token is invalid, clear it
        if (isBrowser()) {
          clearSessionToken();
        }
        return null;
      }
    }
    
    // Unknown error - be conservative and preserve token
    console.error('Unexpected error during session verification:', error);
    return null;
  }
}

/**
 * Get current user from Next.js request
 * Convenience function for Next.js API routes and Server Components
 * 
 * @param request - Next.js Request object
 * @returns User or null if not authenticated
 */
export async function getCurrentUserFromRequest(request: Request): Promise<User | null> {
  return getCurrentUser(request);
}

/**
 * Refresh session token (extends expiry)
 * Client-side only - extends session expiry by 2 months
 */
export async function refreshSession(): Promise<boolean> {
  if (!isBrowser()) {
    console.warn('refreshSession can only be called client-side');
    return false;
  }

  const token = getSessionToken();
  if (!token) return false;

  try {
    const db = getDatabaseClient();
    const session = await db.sessions.findByToken(token);
    
    if (!session) {
      clearSessionToken();
      return false;
    }

    // Extend session by 2 months
    const newExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    await db.sessions.extendExpiry(token, newExpiresAt);
    setSessionToken(token, newExpiresAt.toISOString());
    
    return true;
  } catch (error) {
    console.error('Failed to refresh session:', error);
    return false;
  }
}

/**
 * Logout user
 * Client-side only - deletes session from database and clears localStorage
 */
export async function logout(): Promise<void> {
  if (!isBrowser()) {
    console.warn('logout can only be called client-side');
    return;
  }

  const token = getSessionToken();
  
  if (token) {
    try {
      const db = getDatabaseClient();
      await db.sessions.delete(token);
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  }
  
  clearSessionToken();
}

/**
 * Request login magic link
 * Works in both client and server contexts
 */
export async function requestLogin(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const supabaseUrl = getSupabaseUrlLazy();
    const supabaseAnonKey = getSupabaseAnonKeyLazy();
    
    const response = await fetch(`${supabaseUrl}/functions/v1/auth-magic-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({
        action: 'request-login',
        email: email.trim().toLowerCase(),
      }),
    });

    // Handle non-OK responses and non-JSON responses
    let data: any;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        return { success: false, error: 'Invalid response from server' };
      }
    } else {
      const text = await response.text();
      return { success: false, error: text || 'Failed to send magic link' };
    }
    
    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to send magic link' };
    }
    
    return data;
  } catch (error) {
    console.error('Failed to request login:', error);
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      return { success: false, error: 'Network error. Please check your connection and ensure the Edge Function is deployed.' };
    }
    const errorMessage = error instanceof Error ? error.message : 'Failed to send magic link';
    return { success: false, error: errorMessage };
  }
}

/**
 * Request signup magic link
 * Works in both client and server contexts
 */
export async function requestSignup(
  email: string,
  name: string,
  handle: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const supabaseUrl = getSupabaseUrlLazy();
    const supabaseAnonKey = getSupabaseAnonKeyLazy();
    
    const response = await fetch(`${supabaseUrl}/functions/v1/auth-magic-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({
        action: 'request-signup',
        email: email.trim().toLowerCase(),
        name: name.trim(),
        handle: handle.trim(),
      }),
    });

    // Handle non-OK responses and non-JSON responses
    let data: any;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        return { success: false, error: 'Invalid response from server' };
      }
    } else {
      const text = await response.text();
      return { success: false, error: text || 'Failed to send magic link' };
    }
    
    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to send magic link' };
    }
    
    return data;
  } catch (error) {
    console.error('Failed to request signup:', error);
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      return { success: false, error: 'Network error. Please check your connection and ensure the Edge Function is deployed.' };
    }
    const errorMessage = error instanceof Error ? error.message : 'Failed to send magic link';
    return { success: false, error: errorMessage };
  }
}

/**
 * Verify magic link token and create session
 * Client-side only - stores session token in cookies and localStorage
 */
export async function verifyMagicLink(token: string): Promise<{ 
  success: boolean; 
  error?: string; 
  sessionToken?: string;
  expiresAt?: string;
}> {
  if (!isBrowser()) {
    return { success: false, error: 'Magic link verification must be done in the browser' };
  }

  try {
    const supabaseUrl = getSupabaseUrlLazy();
    const supabaseAnonKey = getSupabaseAnonKeyLazy();
    
    const response = await fetch(`${supabaseUrl}/functions/v1/auth-magic-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({
        action: 'verify',
        token,
      }),
    });

    // Handle non-OK responses and non-JSON responses
    let data: any;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        return { success: false, error: 'Invalid response from server' };
      }
    } else {
      const text = await response.text();
      return { success: false, error: text || 'Verification failed' };
    }
    
    if (!response.ok) {
      return { success: false, error: data.error || 'Verification failed' };
    }

    // Store session token (client-side only) in both cookies and localStorage
    if (data.sessionToken && data.expiresAt) {
      setSessionToken(data.sessionToken, data.expiresAt);
    }
    
    return { 
      success: true, 
      sessionToken: data.sessionToken,
      expiresAt: data.expiresAt
    };
  } catch (error) {
    console.error('Failed to verify magic link:', error);
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      return { success: false, error: 'Network error. Please check your connection and ensure the Edge Function is deployed.' };
    }
    const errorMessage = error instanceof Error ? error.message : 'Verification failed';
    return { success: false, error: errorMessage };
  }
}

/**
 * Get session token (for use in custom implementations)
 * Client-side: Returns from localStorage
 * Server-side: Requires request or cookies parameter
 */
export function getSessionTokenForAPI(
  request?: Request | { headers: Headers },
  nextCookies?: { get: (name: string) => { value: string } | undefined }
): string | null {
  return getSessionToken(request, nextCookies);
}

