// ============================================================================
// Shared Supabase Client - Singleton for Real-time Subscriptions
// ============================================================================
// Provides a single Supabase client instance for all real-time subscriptions
// to avoid creating multiple GoTrueClient instances.
// ============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseAnonKey } from './env';

// Add global type definition for development HMR
declare global {
  interface Window {
    __supabaseClient?: SupabaseClient;
  }
}

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create the shared Supabase client instance
 * This ensures only one GoTrueClient is created per browser context
 */
export function getSharedSupabaseClient(): SupabaseClient {
  // Return existing local instance
  if (supabaseClient) {
    return supabaseClient;
  }

  // Check for global instance (during HMR in development)
  if (import.meta.env.DEV && window.__supabaseClient) {
    supabaseClient = window.__supabaseClient;
    return supabaseClient;
  }

  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.'
    );
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

  // Store in global window for HMR support
  if (import.meta.env.DEV) {
    window.__supabaseClient = supabaseClient;
  }

  return supabaseClient;
}

/**
 * Get the shared Supabase client, or undefined if not configured
 * Use this in hooks that can gracefully handle missing Supabase configuration
 */
export function getSharedSupabaseClientOrUndefined(): SupabaseClient | undefined {
  try {
    return getSharedSupabaseClient();
  } catch {
    return undefined;
  }
}



