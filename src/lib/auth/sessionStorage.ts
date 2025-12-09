// ============================================================================
// Unified Session Storage Abstraction
// ============================================================================
// Handles session token storage/retrieval for both client and server contexts
// Primary: localStorage (client-side)
// Note: iOS Safari and PWA have isolated storage. Session transfer uses URL handoff.
// ============================================================================

export const SESSION_TOKEN_KEY = 'momentum_session_token';
export const SESSION_EXPIRY_KEY = 'momentum_session_expiry';

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Get session token from localStorage (client-side only)
 * Note: Don't check expiry client-side - let server determine validity
 * Server can extend sessions, so we should always check with server
 */
function getSessionTokenFromStorage(): string | null {
  if (!isBrowser()) return null;
  
  try {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    return token;
  } catch (error) {
    // localStorage may not be available (e.g., in SSR or incognito mode)
    console.warn('Failed to access localStorage:', error);
    return null;
  }
}

/**
 * Get session token from request cookies or headers (server-side)
 */
function getSessionTokenFromRequest(request?: Request | { headers: Headers }): string | null {
  if (!request) return null;

  const headers = 'headers' in request ? request.headers : (request as Request).headers;
  
  // Try Authorization header first
  const authHeader = headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try cookie (if set as a cookie)
  const cookies = headers.get('cookie');
  if (cookies) {
    const sessionCookie = cookies
      .split(';')
      .find(c => c.trim().startsWith(`${SESSION_TOKEN_KEY}=`));
    if (sessionCookie) {
      return sessionCookie.split('=')[1];
    }
  }

  return null;
}

/**
 * Get session token from Next.js cookies helper
 */
function getSessionTokenFromNextCookies(
  cookies?: { get: (name: string) => { value: string } | undefined }
): string | null {
  if (!cookies) return null;
  const sessionCookie = cookies.get(SESSION_TOKEN_KEY);
  return sessionCookie?.value || null;
}

/**
 * Unified session token getter
 * Tries multiple sources in order of priority:
 * 1. localStorage (client-side)
 * 2. Request cookies/headers (server-side)
 * 3. Next.js cookies helper (server-side)
 */
export function getSessionToken(
  request?: Request | { headers: Headers },
  nextCookies?: { get: (name: string) => { value: string } | undefined }
): string | null {
  // Client-side: try localStorage
  if (isBrowser()) {
    const storageToken = getSessionTokenFromStorage();
    if (storageToken) return storageToken;
  }

  // Server-side: try request cookies/headers
  if (request) {
    const token = getSessionTokenFromRequest(request);
    if (token) return token;
  }

  // Server-side: try Next.js cookies helper
  if (nextCookies) {
    const token = getSessionTokenFromNextCookies(nextCookies);
    if (token) return token;
  }

  return null;
}

/**
 * Store session token in localStorage (client-side only)
 * Note: iOS Safari and PWA have isolated storage. Cross-context transfer uses URL handoff.
 * 
 * Session expires in 60 days as set by the server
 */
export function setSessionToken(token: string, expiresAt: string): void {
  if (!isBrowser()) {
    console.warn('setSessionToken can only be called client-side');
    return;
  }
  
  try {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
    localStorage.setItem(SESSION_EXPIRY_KEY, expiresAt);
  } catch (error) {
    console.warn('Failed to save session token to localStorage:', error);
  }
}

/**
 * Clear session token from localStorage (client-side only)
 */
export function clearSessionToken(): void {
  if (!isBrowser()) {
    console.warn('clearSessionToken can only be called client-side');
    return;
  }
  
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_EXPIRY_KEY);
  } catch (error) {
    console.warn('Failed to clear session token from localStorage:', error);
  }
}

