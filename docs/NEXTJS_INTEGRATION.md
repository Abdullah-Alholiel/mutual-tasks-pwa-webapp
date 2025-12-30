# Next.js Integration Guide

This guide explains how to use the authentication system in a Next.js application.

## Overview

The authentication system is fully compatible with Next.js App Router and Pages Router. It automatically detects the environment and uses the appropriate configuration.

## Environment Variables

### For Next.js Projects

Add these to your `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

The code automatically uses `NEXT_PUBLIC_SUPABASE_URL` when running in Next.js.

## Client Components

### Using the `useAuth` Hook

```tsx
'use client'; // Next.js App Router

import { useAuth } from '@/hooks/useAuth';

export default function Dashboard() {
  const { user, loading, isAuthenticated, logout } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!isAuthenticated) {
    // Redirect to login or show login UI
    return <LoginPage />;
  }

  return (
    <div>
      <h1>Welcome, {user?.name}!</h1>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Direct Auth Functions

```tsx
'use client';

import { getCurrentUser, requestLogin, verifyMagicLink } from '@/lib/auth';
import { useEffect, useState } from 'react';

export default function Profile() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // getCurrentUser() automatically reads from localStorage on client-side
    getCurrentUser().then(setUser);
  }, []);

  // ... rest of component
}
```

## Server Components (Next.js App Router)

For Server Components, use `getCurrentUser()` with Next.js cookies:

```tsx
// app/dashboard/page.tsx (Server Component)
import { getCurrentUser } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  
  // getCurrentUser() can read from Next.js cookies
  const user = await getCurrentUser(undefined, cookieStore);
  
  if (!user) {
    redirect('/auth');
  }

  return (
    <div>
      <h1>Welcome, {user.name}!</h1>
    </div>
  );
}
```

## API Routes (Next.js App Router)

### Session Verification API Route

```typescript
// app/api/auth/session/route.ts
import { getCurrentUserFromRequest } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const user = await getCurrentUserFromRequest(request);
  
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return NextResponse.json({ user });
}
```

### Protected API Route Example

```typescript
// app/api/tasks/route.ts
import { getCurrentUserFromRequest } from '@/lib/auth';
import { getDatabaseClient } from '@/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const user = await getCurrentUserFromRequest(request);
  
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const db = getDatabaseClient();
  const tasks = await db.tasks.getAll({ userId: user.id });

  return NextResponse.json({ tasks });
}
```

## API Routes (Next.js Pages Router)

```typescript
// pages/api/auth/session.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserFromRequest } from '@/lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Convert Next.js request to standard Request object
  const request = new Request('http://localhost', {
    headers: req.headers as HeadersInit,
  });

  const user = await getCurrentUserFromRequest(request);

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.status(200).json({ user });
}
```

## Middleware (Next.js App Router)

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  // Protected routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    const user = await getCurrentUserFromRequest(request);
    
    if (!user) {
      return NextResponse.redirect(new URL('/auth', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/projects/:path*'],
};
```

## Setting Session as HTTP-Only Cookie (Recommended for Next.js)

You can modify the Edge Function to set cookies, or handle it in Next.js:

```typescript
// app/api/auth/verify/route.ts
import { verifyMagicLink } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect('/auth?error=invalid_token');
  }

  const result = await verifyMagicLink(token);

  if (result.success) {
    // Get session token from localStorage (set by verifyMagicLink)
    // In Next.js, you might want to set it as an HTTP-only cookie
    const cookieStore = await cookies();
    
    // Optionally set as HTTP-only cookie for better security
    // cookieStore.set('momentum_session_token', sessionToken, {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV === 'production',
    //   sameSite: 'lax',
    //   maxAge: 60 * 24 * 60 * 60, // 2 months
    // });
  }

  return NextResponse.redirect('/');
}
```

## Authentication Flow

1. **Signup/Login**: User requests magic link
   - Works in both client and server components
   - Calls Supabase Edge Function

2. **Verification**: User clicks magic link
   - In client component: `verifyMagicLink()` automatically stores token
   - In server: Handle in API route and set cookie

3. **Session Check**: 
   - Client: Use `useAuth()` hook or `getCurrentUser()` (reads from localStorage)
   - Server: Use `getCurrentUserFromRequest(request)` or `getCurrentUser(undefined, cookies)` (reads from cookies/headers)

## Best Practices for Next.js

1. **Use `useAuth` hook in client components** for reactive auth state
2. **Use `getCurrentUserFromRequest` in API routes** for server-side auth
3. **Use `getCurrentUser(undefined, cookies)` in Server Components** for server-side auth
4. **Session storage**: localStorage for client (automatic), cookies/headers for server (when provided)
5. **Use Next.js middleware** for route protection

## Migration from Vite to Next.js

The code is designed to work with both. To migrate:

1. Change environment variables from `VITE_*` to `NEXT_PUBLIC_*`
2. Update imports to use Next.js routing if needed
3. Add `'use client'` directive to components using hooks
4. Consider using Next.js API routes instead of direct Edge Function calls

## Environment Detection

The code automatically detects:
- **Vite**: Uses `import.meta.env.VITE_*`
- **Next.js**: Uses `process.env.NEXT_PUBLIC_*`
- **Server-side**: Uses `process.env.*`

No code changes needed - it works automatically!

