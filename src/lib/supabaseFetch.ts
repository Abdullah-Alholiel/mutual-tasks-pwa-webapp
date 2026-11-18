// ============================================================================
// Session-aware fetch wrapper for Supabase REST calls (L5 RLS, D-051)
// ============================================================================
// Scoped RLS policies (database/vps-migration/004) resolve the caller through
// the `x-momentum-session` request header. supabase-js bakes `global.headers`
// at createClient time — the token changes on login/logout, so a baked value
// goes stale. This wrapper reads the session token from storage at REQUEST
// time and injects the header per call. WebSocket (Realtime) traffic does not
// go through fetch; its policy impact is disclosed in 004 + the PR.
// ============================================================================

import { getSessionToken } from '@/lib/auth/sessionStorage';

export const SESSION_HEADER = 'x-momentum-session';

/**
 * fetch replacement passed to createClient({ global: { fetch } }).
 * Reads the current session token on EVERY call — no stale baked headers.
 */
export function momentumFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const token = getSessionToken();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set(SESSION_HEADER, token);
  }
  return fetch(input, { ...init, headers });
}
