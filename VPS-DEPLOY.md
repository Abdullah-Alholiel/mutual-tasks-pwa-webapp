# VPS Deployment Guide - Self-Hosted Supabase

This branch (`vps-deploy`) contains all changes needed to run the mutual-tasks PWA with a **self-hosted Supabase** instance on a Coolify VPS, instead of the cloud-hosted Supabase.

## What Changed from Main

### New Files
- `database/vps-migration/001_full_schema.sql` - Complete schema (14 tables matching remote DB exactly)
- `database/vps-migration/002_netlify-to-express.md` - Netlify function migration plan
- `server/index.ts` - Express API server replacing all 4 Netlify functions
- `Dockerfile` - Multi-stage Docker build for Coolify
- `.env.vps-example` - Environment variable template for VPS deployment

### Schema Additions (not in main branch migrations)
- `friends` table - Required by the friends feature, was only on remote Supabase
- `ai_usage_logs` table - Required by AI features (description generation, project generation)
- `completion_logs` table - Tracks task completions with XP/difficulty
- `task_recurrence` table - Handles recurring task patterns
- `completed_at` column on `task_statuses` - Was in a separate SQL migration file only
- Realtime publication for all live-updated tables including `friends`

### API Migration (Netlify → Express)
4 Netlify functions migrated to Express routes in `server/index.ts`:
- `ai-generated-description` → `POST /api/ai-generated-description`
- `ai-generate-project` → `POST /api/ai-generate-project`
- `ai-confirm-usage` → `POST /api/ai-confirm-usage`
- `send-push-notification` → `POST /api/send-push-notification`

### Deployment Target
- **Frontend + API**: Coolify (Docker) on VPS, single container
- **Database**: Self-hosted Supabase (Docker Compose) on same VPS
- **Edge Functions**: Supabase Edge Runtime (Deno) - `auth-magic-link`, `send-email`
- **Port**: App served on port 3001 (configurable via `API_PORT`)

## Setup Steps

### 1. Start Self-Hosted Supabase
```bash
cd ~/supabase-project
# Ensure .env has all required keys (use utils/generate-keys.sh)
docker compose up -d
```

### 2. Apply Schema Migration
```bash
# Connect to the local DB and run the full schema
docker compose exec -T db psql -U supabase_admin -p 5433 -d postgres \
  < ../mutual-tasks-pwa-webapp/database/vps-migration/001_full_schema.sql
```

### 3. Configure App Environment
```bash
cp .env.vps-example .env
# Fill in the values from your supabase-project/.env:
#   - VITE_SUPABASE_URL (Kong gateway URL, e.g. http://YOUR_VPS_IP:8001)
#   - VITE_SUPABASE_ANON_KEY (SUPABASE_PUBLISHABLE_KEY)
#   - VITE_SUPABASE_SERVICE_ROLE_KEY (SUPABASE_SECRET_KEY)
#   - N8N_DESCRIPTION_WEBHOOK_URL (for AI description generation)
#   - N8N_PROJECT_WEBHOOK_URL (for AI project generation)
#   - ONESIGNAL_APP_ID + ONESIGNAL_REST_API_KEY (for push notifications)
```

### 4. Deploy via Coolify
- Point Coolify to the `vps-deploy` branch
- Set environment variables in Coolify's env editor
- Coolify will use the Dockerfile to build and deploy

### 5. Verify
```bash
# Check API server health
curl http://YOUR_VPS_IP:3001/api/health

# Check Supabase REST
curl -H "apikey: YOUR_ANON_KEY" http://YOUR_VPS_IP:8001/rest/v1/users

# Check edge functions
curl http://YOUR_VPS_IP:8001/functions/v1/hello
```

## Architecture

```
[Coolify: Web App + API (vps-deploy)]
  ├── Express API :3001 (/api/*)
  └── Static frontend (:3001 /*)
         |
         | HTTP (port 8001)
         v
[Docker: Supabase Stack]
  ├── Kong (API Gateway) :8001
  ├── Auth (GoTrue) :9999
  ├── PostgREST :3000
  ├── Realtime :4000
  ├── Storage :5000
  ├── Edge Functions :9000
  ├── PostgreSQL :5433
  └── ... (meta, analytics, imgproxy, vector, studio)
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Kong gateway URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Publishable API key (sb_publishable_*) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Secret key for admin operations |
| `API_PORT` | No | Express server port (default: 3001) |
| `CORS_ORIGIN` | No | Allowed origins (default: *) |
| `N8N_DESCRIPTION_WEBHOOK_URL` | AI desc | n8n webhook for description generation |
| `N8N_PROJECT_WEBHOOK_URL` | AI proj | n8n webhook for project generation |
| `x_momentum_secret` | AI | Secret for n8n webhook auth |
| `ONESIGNAL_APP_ID` | Push | OneSignal app ID |
| `ONESIGNAL_REST_API_KEY` | Push | OneSignal API key |

## Troubleshooting

### Stack won't start / services crash-looping
Most common cause: password mismatch between `.env` and DB roles.
Fix: temporarily override pg_hba.conf with trust, set passwords, restore.
See session history for the exact procedure.

### RPC/POST returns 401
Kong validates opaque keys (`sb_publishable_*`) and translates to JWTs for PostgREST.
Ensure `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` in `.env` match what the app sends.

### Edge functions not found
Edge functions must be in `supabase-project/volumes/functions/<name>/index.ts`.

### PostgreSQL port
Self-hosted Supabase uses port **5433** (not default 5432). Set `POSTGRES_PORT=5433` in `.env`.
