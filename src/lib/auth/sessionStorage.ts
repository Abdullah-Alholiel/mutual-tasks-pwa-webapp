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

export const USER_CACHE_KEY = 'momentum_user_cache';

/**
 * Cached user type - stores all essential fields for synchronous hydration.
 * This ensures the user is immediately available on page load without async operations.
 */
export interface CachedUser {
  id: number;
  name: string;
  handle: string;
  email: string;
  avatar: string;
  timezone: string;
  createdAt: string; // Stored as ISO string
  updatedAt: string; // Stored as ISO string
}

/**
 * Store complete user data for synchronous hydration.
 * This is called whenever the user data is updated (login, refresh, etc.)
 * to ensure we always have fresh cached data available.
 */
export function setStoredUserSync(user: CachedUser | { id: number | string; name: string; handle: string; email?: string; avatar?: string; timezone?: string; createdAt?: Date | string; updatedAt?: Date | string } | null | undefined): void {
  if (!isBrowser()) return;

  try {
    if (user) {
      // Normalize the user object to ensure all fields are serializable
      const normalizedUser: CachedUser = {
        id: typeof user.id === 'string' ? parseInt(user.id, 10) : user.id,
        name: user.name || '',
        handle: user.handle || '',
        email: (user as any).email || '',
        avatar: (user as any).avatar || '',
        timezone: (user as any).timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        createdAt: (user as any).createdAt instanceof Date 
          ? (user as any).createdAt.toISOString() 
          : ((user as any).createdAt || new Date().toISOString()),
        updatedAt: (user as any).updatedAt instanceof Date 
          ? (user as any).updatedAt.toISOString() 
          : ((user as any).updatedAt || new Date().toISOString()),
      };
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(normalizedUser));
    } else {
      localStorage.removeItem(USER_CACHE_KEY);
    }
  } catch (error) {
    console.warn('Failed to save user cache to localStorage:', error);
  }
}

/**
 * Get stored user data synchronously.
 * Returns the cached user with Date objects for createdAt/updatedAt.
 * This is the key function that enables instant user display on page load.
 */
export function getStoredUserSync(): {
  id: number;
  name: string;
  handle: string;
  email: string;
  avatar: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
} | null {
  if (!isBrowser()) return null;

  try {
    const cached = localStorage.getItem(USER_CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as CachedUser;
    
    // Validate that essential fields exist
    if (!parsed.id || !parsed.name) {
      console.warn('Invalid cached user data, missing required fields');
      return null;
    }

    // Convert ISO strings back to Date objects
    return {
      id: parsed.id,
      name: parsed.name,
      handle: parsed.handle || '',
      email: parsed.email || '',
      avatar: parsed.avatar || '',
      timezone: parsed.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      createdAt: new Date(parsed.createdAt),
      updatedAt: new Date(parsed.updatedAt),
    };
  } catch (error) {
    console.warn('Failed to read user cache from localStorage:', error);
    return null;
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
    localStorage.removeItem(USER_CACHE_KEY);
  } catch (error) {
    console.warn('Failed to clear session token from localStorage:', error);
  }
}

