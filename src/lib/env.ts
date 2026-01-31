// ============================================================================
// Environment Variable Utilities
// ============================================================================
// Unified environment variable detection for both Vite and Next.js
// ============================================================================

/**
 * Get environment variable, supporting both Vite and Next.js conventions
 * 
 * @param viteKey - Environment variable name for Vite (e.g., 'VITE_SUPABASE_URL')
 * @param nextKey - Environment variable name for Next.js (e.g., 'NEXT_PUBLIC_SUPABASE_URL')
 * @returns Environment variable value or undefined
 */
export function getEnvVar(viteKey: string, nextKey: string): string | undefined {
  // Try Vite environment variables first (for Vite projects)
  // @ts-expect-error - import.meta.env is available in Vite
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const viteValue = import.meta.env[viteKey];
    if (viteValue && typeof viteValue === 'string') {
      return viteValue;
    }
  }
  
  // Try Next.js environment variables (for Next.js projects or fallback)
  if (typeof process !== 'undefined' && process.env) {
    const nextValue = process.env[nextKey];
    if (nextValue && typeof nextValue === 'string') {
      return nextValue;
    }
  }
  
  // Fallback: try Vite convention in process.env (for server-side in Vite)
  if (typeof process !== 'undefined' && process.env) {
    const viteFallback = process.env[viteKey];
    if (viteFallback && typeof viteFallback === 'string') {
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

