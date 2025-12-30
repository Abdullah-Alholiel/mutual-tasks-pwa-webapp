// ============================================================================
// Next.js Server-Side Authentication Utilities
// ============================================================================
// For use in Next.js API routes and Server Components
// ============================================================================

/**
 * Next.js API Route Handler for verifying session tokens
 * 
 * Usage in Next.js API route (app/api/auth/session/route.ts):
 * ```typescript
 * import { verifySessionFromRequest } from '@/lib/auth-nextjs';
 * 
 * export async function GET(request: Request) {
 *   const user = await verifySessionFromRequest(request);
 *   if (!user) {
 *     return Response.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *   return Response.json({ user });
 * }
 * ```
 */

import { getDatabaseClient } from '../../db';
import type { User } from '../../types';

/**
 * Get session token from Next.js request headers or cookies
 */
function getSessionTokenFromRequest(request: Request): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try cookie (if you set it as a cookie)
  const cookies = request.headers.get('cookie');
  if (cookies) {
    const sessionCookie = cookies
      .split(';')
      .find(c => c.trim().startsWith('momentum_session_token='));
    if (sessionCookie) {
      return sessionCookie.split('=')[1];
    }
  }

  return null;
}

/**
 * Verify session from Next.js request and return user
 * Use this in Next.js API routes or Server Components
 */
export async function verifySessionFromRequest(request: Request): Promise<User | null> {
  const token = getSessionTokenFromRequest(request);
  if (!token) return null;

  try {
    const db = getDatabaseClient();
    const userId = await db.sessions.getUserIdFromToken(token);
    
    if (!userId) {
      return null;
    }

    // Update last accessed time
    await db.sessions.updateLastAccessed(token);
    
    // Get user details
    const user = await db.users.getById(userId);
    return user;
  } catch (error) {
    console.error('Failed to verify session:', error);
    return null;
  }
}

/**
 * Get session token from Next.js cookies
 * Use this when you set the session as an HTTP-only cookie
 */
export function getSessionTokenFromCookies(cookies: {
  get: (name: string) => { value: string } | undefined;
}): string | null {
  const sessionCookie = cookies.get('momentum_session_token');
  return sessionCookie?.value || null;
}
