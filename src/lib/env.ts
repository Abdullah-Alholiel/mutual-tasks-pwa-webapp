// ============================================================================
// Environment Variable Utilities
// ============================================================================
// Unified environment variable detection for both Vite and Next.js.
//
// SECURITY (F2, 2026-11-08): Vite replaces only STATICALLY ANALYZABLE
// import.meta.env accesses. Bare reads (`import.meta.env`, Object.keys,
// dynamic bracket access) force Vite to inline the ENTIRE VITE_* env object
// into the client bundle — which shipped the service-role key in dist/.
// Every VITE_ variable a client may read MUST be listed in VITE_ENV below
// with a full static member chain; nothing else reaches the bundle.
// ============================================================================

/** Client-safe VITE_ variables — the ONLY ones allowed into the bundle. */
function readViteEnv(): Record<string, string | undefined> {
  try {
    return {
      VITE_APP_URL: import.meta.env.VITE_APP_URL,
      VITE_LOG_LEVEL: import.meta.env.VITE_LOG_LEVEL,
      VITE_ONESIGNAL_APP_ID: import.meta.env.VITE_ONESIGNAL_APP_ID,
      VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
      VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
      VITE_USE_LOCAL_N8N: import.meta.env.VITE_USE_LOCAL_N8N,
    };
  } catch {
    // Non-Vite runtime (node/tsx): import.meta.env is undefined
    return {};
  }
}

const VITE_ENV: Record<string, string | undefined> = readViteEnv();

/**
 * Get environment variable, supporting both Vite and Next.js conventions
 *
 * @param viteKey - Environment variable name for Vite (e.g., 'VITE_SUPABASE_URL')
 * @param nextKey - Environment variable name for Next.js (e.g., 'NEXT_PUBLIC_SUPABASE_URL')
 * @returns Environment variable value or undefined
 */
export function getEnvVar(viteKey: string, nextKey: string): string | undefined {
  const viteValue = VITE_ENV[viteKey];
  if (typeof viteValue === 'string' && viteValue) {
    return viteValue;
  }

  if (typeof process !== 'undefined' && process.env) {
    const nextValue = process.env[nextKey];
    if (typeof nextValue === 'string' && nextValue) {
      return nextValue;
    }

    const viteFallback = process.env[viteKey];
    if (typeof viteFallback === 'string' && viteFallback) {
      return viteFallback;
    }
  }

  return undefined;
}

/**
 * Get Supabase URL from environment
 */
export function getSupabaseUrl(): string | undefined {
  return (
    getEnvVar('VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL') ||
    (typeof process !== 'undefined' ? process.env.SUPABASE_URL : undefined)
  );
}

/**
 * Get Supabase Anon Key from environment
 */
export function getSupabaseAnonKey(): string | undefined {
  return (
    getEnvVar('VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
    (typeof process !== 'undefined' ? process.env.SUPABASE_ANON_KEY : undefined)
  );
}
