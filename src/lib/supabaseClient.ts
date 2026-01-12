// ============================================================================
// Shared Supabase Client - Singleton for Real-time Subscriptions
// ============================================================================
// Provides a single Supabase client instance for all real-time subscriptions
// to avoid creating multiple GoTrueClient instances.
// ============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseAnonKey } from './env';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create the shared Supabase client instance
 * This ensures only one GoTrueClient is created per browser context
 */
export function getSharedSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
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



