# VPS Deployment Guide - Self-Hosted Supabase

This branch (`vps-deploy`) contains all changes needed to run the mutual-tasks PWA with a **self-hosted Supabase** instance on a Coolify VPS, instead of the cloud-hosted Supabase.

## What Changed from Main

### New Files
- `database/vps-migration/001_full_schema.sql` - Complete schema (13 tables + missing `friends` and `ai_usage_logs`)
- `database/vps-migration/002_netlify-to-express.md` - Netlify function migration plan
- `.env.vps-example` - Environment variable template for VPS deployment

### Schema Additions (not in main branch migrations)
- `friends` table - Required by the friends feature, was only on remote Supabase
- `ai_usage_logs` table - Required by AI features (description generation, project generation)
- `completed_at` column on `task_statuses` - Was in a separate SQL migration file only
- Realtime publication for all live-updated tables including `friends`

### Deployment Target
- **Frontend**: Coolify (Docker) on VPS
- **Database**: Self-hosted Supabase (Docker Compose) on same VPS
- **Edge Functions**: Supabase Edge Runtime (Deno) - `auth-magic-link`, `send-email`
- **Netlify Functions**: Migrated to Express API server or Supabase Edge Functions

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
docker compose exec -T db psql -U supabase_admin -d postgres < ../mutual-tasks-pwa-webapp/database/vps-migration/001_full_schema.sql
```

### 3. Configure App Environment
```bash
cp .env.vps-example .env
# Fill in the values from your supabase-project/.env:
#   - VITE_SUPABASE_URL (Kong gateway URL)
#   - VITE_SUPABASE_ANON_KEY (SUPABASE_PUBLISHABLE_KEY)
#   - VITE_SUPABASE_SERVICE_ROLE_KEY (SUPABASE_SECRET_KEY)
```

### 4. Deploy via Coolify
- Point Coolify to the `vps-deploy` branch
- Set environment variables in Coolify's env editor
- Deploy

## Architecture

```
[Coolify: Web App (vps-deploy)]
         |
         | HTTP (port 8000)
         v
[Docker: Supabase Stack]
  ├── Kong (API Gateway) :8000
  ├── Auth (GoTrue) :9999
  ├── PostgREST :3000
  ├── Realtime :4000
  ├── Storage :5000
  ├── Edge Functions :9000
  ├── PostgreSQL :5432
  └── ... (meta, analytics, imgproxy, vector)
```

## Troubleshooting

### Stack won't start / services crash-looping
Most common cause: password mismatch between `.env` and DB roles.
Use `utils/db-passwd.sh` to reset all DB passwords to match `.env`.

### RPC/POST returns 401
Kong validates opaque keys and translates to JWTs for PostgREST.
Ensure `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` in `.env` match what the app sends.

### Edge functions not found
Edge functions must be in `supabase-project/volumes/functions/<name>/index.ts`.
