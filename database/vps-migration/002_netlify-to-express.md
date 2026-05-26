# Netlify Functions to Express API Migration

## Overview
The app has 4 Netlify serverless functions that need to work with the Coolify deployment.
Options: (A) Convert to Express API routes served alongside the app, or (B) Convert to Supabase Edge Functions.

**Recommended: Option A** - Express API routes, because:
- They need env vars (n8n webhooks, OneSignal keys) that are easier in Express
- They use `SUPABASE_SERVICE_ROLE_KEY` which is sensitive
- Simpler debugging and local development

## Netlify Functions Inventory

### 1. `ai-generated-description.ts` → `POST /api/ai/description`
- **Purpose**: Generate AI descriptions for tasks/projects via n8n webhook
- **Auth**: Bearer token (session verification)
- **DB Tables**: `sessions`, `ai_usage_logs`
- **Env Vars**: `N8N_DESCRIPTION_WEBHOOK_URL`, `x_momentum_secret`
- **Rate Limit**: 10/day per user

### 2. `ai-generate-project.ts` → `POST /api/ai/project`
- **Purpose**: Generate AI projects via n8n webhook
- **Auth**: Bearer token (session verification)
- **DB Tables**: `sessions`, `ai_usage_logs`
- **Env Vars**: `N8N_PROJECT_WEBHOOK_URL`, `x_momentum_secret`
- **Rate Limit**: 3/day per user

### 3. `ai-confirm-usage.ts` → `POST /api/ai/confirm-usage`
- **Purpose**: Record confirmed AI usage
- **Auth**: Bearer token (session verification)
- **DB Tables**: `sessions`, `ai_usage_logs`
- **Rate Limit**: None (just records)

### 4. `send-push-notification.ts` → `POST /api/notifications/push`
- **Purpose**: Send push notification via OneSignal
- **Auth**: None (internal use)
- **DB Tables**: None
- **Env Vars**: `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`

## Implementation Plan

### Step 1: Create Express server
```
server/
  index.ts          # Express app entry point
  routes/
    ai.ts           # AI description, project, confirm-usage routes
    notifications.ts # Push notification route
  middleware/
    auth.ts         # Session verification middleware
  utils/
    supabase.ts     # Supabase admin client
```

### Step 2: Add to Docker build
- Multi-stage build: build frontend + server
- Run both via a process manager or separate containers

### Step 3: Update frontend API calls
- Replace `/netlify/functions/xxx` paths with `/api/xxx`
- Search for: `netlify/functions` in all `.ts/.tsx` files
