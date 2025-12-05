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
 * Client-side Supabase client that uses the anon key.
 * Safe to use in the browser.
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
