# Magic Link Authentication Setup Guide

This guide explains how to set up and use the magic link authentication system with MailJet email integration using Supabase Edge Functions.

## Overview

The magic link authentication system provides passwordless authentication using email verification links. Key features:

- **Signup & Login**: Users sign up or log in via magic links sent to their email
- **Session Management**: 2-month session tokens stored in localStorage
- **Email Integration**: MailJet API integration via Supabase Edge Functions
- **Task Notifications**: Automatic emails when tasks are created
- **Supabase Native**: Uses Supabase Edge Functions - no separate backend server needed

## Architecture

- **Frontend**: React/Vite app that calls Supabase Edge Functions
- **Edge Functions**: Supabase serverless functions for auth and email sending
- **Database**: Supabase PostgreSQL with repositories pattern (`src/db/`)
- **Session Storage**: localStorage (secure session tokens)

## Prerequisites

1. **Supabase Project**: With PostgreSQL database
2. **MailJet Account**: Sign up at https://www.mailjet.com/
3. **Supabase CLI**: For deploying Edge Functions (optional, can deploy via dashboard)

## Database Migration

Run the database migration to create the required tables:

```bash
npm run db:migrate
```

This will create:
- `magic_links` table for storing magic link tokens
- `sessions` table for managing user sessions
- Required indexes for performance

## Environment Variables

### Frontend (.env)

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# App URL (for email links) - Optional, auto-detected in Edge Functions
VITE_APP_URL=http://localhost:8080
```

### Supabase Edge Functions (Set in Supabase Dashboard)

Go to **Settings → Edge Functions → Secrets** and add:

```env
MailJet_API_Key=your_mailjet_api_key
MailJet_API_Secret=your_mailjet_api_secret
MailJet_From_Email=noreply@yourdomain.com
MailJet_From_Name=Momentum
APP_URL=https://mutualtask-pwa.netlify.app  # Optional - auto-detected if not set
```

**Note on APP_URL**: The Edge Function will automatically detect the environment:
- **Production**: Uses `https://mutualtask-pwa.netlify.app` when Supabase URL contains `.supabase.co`
- **Development**: Uses `http://localhost:8080` for local development
- You can override this by setting `APP_URL` or `VITE_APP_URL` in Supabase secrets

### Getting MailJet Credentials

1. Sign up for a MailJet account at https://www.mailjet.com/
2. Go to Account Settings → API Keys
3. Copy your API Key and API Secret
4. Add them to Supabase Edge Functions secrets

## Deploying Edge Functions

### Option 1: Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy auth-magic-link
supabase functions deploy send-email
```

### Option 2: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions**
3. Click **Create Function**
4. Copy and paste the function code from `supabase/functions/auth-magic-link/index.ts`
5. Repeat for `send-email`

## How It Works

### Signup Flow

1. User fills out signup form (name, email, handle)
2. Frontend calls Supabase Edge Function `auth-magic-link` with `action: 'request-signup'`
3. Edge Function creates magic link token and stores in database
4. Edge Function invokes `send-email` function to send signup email via MailJet
5. User clicks link in email (`/auth/verify?token=xxx`)
6. Frontend calls Edge Function with `action: 'verify'`
7. Edge Function verifies token, creates user account, and creates session
8. Edge Function returns session token
9. Frontend stores session token in localStorage
10. User is redirected to home page

### Login Flow

1. User enters email address
2. Frontend calls Edge Function `auth-magic-link` with `action: 'request-login'`
3. Edge Function creates magic link token for existing user
4. Edge Function invokes `send-email` function to send login email via MailJet
5. Same verification flow as signup (steps 5-10)

### Session Management

- Sessions are stored in the database with 2-month expiry
- **Client-side**: Session tokens stored in localStorage (primary)
- **Server-side**: Session tokens read from cookies/headers when available (fallback)
- `getCurrentUser()` - Works in both contexts (auto-detects client vs server)
- `getCurrentUserFromRequest(request)` - Convenience function for Next.js API routes
- `refreshSession()` - Extends session expiry (client-side only)
- `logout()` - Deletes session from database and clears localStorage

### Task Creation Emails

When a task is created:

1. Frontend calls task creation handler (existing flow)
2. After task is saved, frontend calls `notifyTaskCreated()`
3. Function fetches project participants from database
4. Calls Supabase Edge Function `send-email` for each participant
5. Edge Function sends task creation email via MailJet

## Database Repositories

The system uses your existing repository pattern:

- `src/db/magicLinks.ts` - Magic link operations
- `src/db/sessions.ts` - Session management
- `src/db/users.ts` - User operations (existing)
- All repositories integrated into `DatabaseClient` interface

## API Reference

### Frontend Auth Functions (`src/lib/auth.ts`)

- `requestLogin(email)`: Request login magic link
- `requestSignup(email, name, handle)`: Request signup magic link
- `verifyMagicLink(token)`: Verify magic link and create session
- `getCurrentUser()`: Get current user from session
- `refreshSession()`: Extend session expiry
- `logout()`: Logout and clear session

### Edge Functions

**`auth-magic-link`**:
- `POST /functions/v1/auth-magic-link`
- Actions: `request-login`, `request-signup`, `verify`

**`send-email`**:
- `POST /functions/v1/send-email`
- Types: `signup`, `signin`, `task-created`

## Security Considerations

1. **Magic Link Expiry**: Magic links expire after 15 minutes
2. **Session Tokens**: Cryptographically secure random tokens (32 bytes)
3. **Token Usage**: Magic link tokens can only be used once
4. **Session Expiry**: Sessions expire after 2 months (configurable)
5. **Database Security**: Uses Supabase RLS (Row Level Security) policies

## Troubleshooting

### Emails Not Sending

1. Check MailJet API credentials in Supabase Edge Functions secrets
2. Verify MailJet account is active
3. Check Edge Function logs in Supabase dashboard
4. Ensure sender email is verified in MailJet

### Magic Links Not Working

1. Check token expiry (15 minutes)
2. Verify token hasn't been used already
3. Check Edge Function logs
4. Verify `VITE_APP_URL` is set correctly

### Session Issues

1. Check localStorage is enabled in browser
2. Verify Supabase configuration (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
3. Check session expiry hasn't passed
4. Verify Edge Functions are deployed correctly

### Edge Functions Not Working

1. Verify functions are deployed: `supabase functions list`
2. Check function logs in Supabase dashboard
3. Ensure all secrets are set correctly
4. Verify function URLs are correct

## Testing Locally

### Start Supabase Locally

```bash
supabase start
```

### Serve Functions Locally

```bash
supabase functions serve auth-magic-link --env-file .env.local
supabase functions serve send-email --env-file .env.local
```

### Test in Frontend

1. Set `VITE_SUPABASE_URL` to `http://localhost:54321` (local Supabase)
2. Run frontend: `npm run dev`
3. Test auth flow

## Production Deployment

1. Deploy Edge Functions to Supabase
2. Set all environment variables in Supabase dashboard
3. Set `VITE_APP_URL` to your production URL
4. Configure MailJet domain authentication (SPF, DKIM, DMARC)
5. Set up email monitoring/alerts
6. Enable Supabase RLS policies for security

## Next Steps

- [ ] Set up Supabase RLS policies for `sessions` and `magic_links` tables
- [ ] Verify MailJet domain authentication
- [ ] Set up email monitoring/alerts
- [ ] Add rate limiting for magic link requests (via Supabase)
- [ ] Implement email verification on signup
- [ ] Add password reset functionality if needed

