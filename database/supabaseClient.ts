// ============================================================================
// Supabase Client - SERVER-SIDE ONLY (Node.js)
// ============================================================================
// 
// This module provides Supabase clients for SERVER-SIDE operations only:
// - Database migrations (migrate.ts)
// - Seed scripts
// - Server-side API routes
// - Any Node.js scripts
//
// DO NOT use this in browser/client-side code.
// For client-side code, use src/db/index.ts instead.
//
// Key differences:
// - Uses process.env (Node.js only)
// - Can use service role key (admin privileges)
// - Not bundled for browser
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import 'dotenv/config';

let cachedServiceClient: SupabaseClient | null = null;
let cachedClient: SupabaseClient | null = null;

/**
 * Server-side Supabase client that uses the service role key.
 * Never ship this bundle to the browser – it has admin privileges.
 */
export const getServiceSupabaseClient = (): SupabaseClient => {
  if (cachedServiceClient) return cachedServiceClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ANON_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_ANON_KEY env vars.');
  }

  cachedServiceClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false }
  });

  return cachedServiceClient;
};

/**
 * Server-side Supabase client that uses the anon key.
 * NOTE: This is for SERVER-SIDE Node.js scripts only (migrations, seed scripts, etc.).
 * For browser/client-side code, use the client created in src/db/index.ts instead.
 * 
 * This uses process.env which is only available in Node.js, not in the browser.
 */
export const getSupabaseClient = (): SupabaseClient => {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars.');
  }

  cachedClient = createClient(url, anonKey);
  return cachedClient;
};
