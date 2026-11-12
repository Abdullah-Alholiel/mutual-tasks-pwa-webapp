# Cycle 2026-11-12 (run 5) — P1-7 atomic AI usage quota

## Problem
Three standing bug classes live on the AI quota path (P1-7 = t_11e222b8):
- **F5**: `ai-generate-project.ts` never increments usage server-side; counting relies on the
  client calling `/api/ai-confirm-usage` after creation. A user who never confirms (or an old
  bundle) gets unlimited project generations within the rate-check race.
- **F4**: `incrementUsage` (netlify/functions/shared/utils.ts) is read-then-write — two concurrent
  requests both read count=N, both write N+1 → lost increments.
- **F11**: quota day computed from client-supplied `x-user-timezone` → a ±12/13h window stretch;
  a user can get extra daily quota by rotating timezones (client-controlled input decides the
  bucket key).

## User story
As a free user I get exactly 3 project gens + 10 description gens per UTC day, enforced
server-side, with no lost counts under concurrency and no client-controlled day boundary.
Premium users remain unlimited (`remaining === -1` convention, D-005/D-012 limits unchanged).

## Scope
IN: utils.ts quota day → fixed UTC; atomic `consume_ai_usage` RPC-first increment with legacy
read-then-write fallback (RPC not yet applied to prod — owner-only migration rides this PR as
`003_consume_ai_usage_rpc.sql`, unapplied); F5 server-side increment on generate-project success;
premium `-1` header fix (`remaining - 1` produced `-2`).
OUT: F22 dual secret header (n8n credential header name is encrypted — cannot verify which of
the two headers the workflows actually match; removal could kill prod AI — owner checks n8n UI);
client-src duplicated limits copy (dead code, no UI consumer — separate cleanup); hardening PR2
separately removes the dead Express server (npm-audit criticals).

## Data flow (after this change)
generate → `checkRateLimit(admin, userId, type)` (UTC day; premium bypass) → n8n call →
on success `incrementUsage(admin, userId, type)` → `rpc('consume_ai_usage')` (atomic
INSERT..ON CONFLICT DO UPDATE count+1 RETURNING count) → if function missing (404/PGRST202)
→ legacy fallback (upsert+read+update, today's exact behavior). Confirm-usage endpoint unchanged
behaviorally (atomic inside), so stale bundles double-count at worst (client confirm + server
increment), never under-count — this is the F5 trade, documented.

## Exact JSON shapes (unchanged responses)
- 200 project: n8n body passthrough + `X-RateLimit-Remaining` (`remaining-1`, or `-1` premium).
- 200 description: n8n text body + same headers.
- 429: `buildRateLimitResponse` unchanged. Errors stay exactly `{ error: string }` (F19 holds).

## TS signatures (utils.ts)
```ts
function getTodayDate(): string                       // FIXED UTC (was (timezone))
async function checkRateLimit(admin, userId, usageType): Promise<{allowed, remaining, limit, used}>
async function incrementUsage(admin, userId, usageType): Promise<void>  // atomic-first + fallback
```
Call sites drop the timezone arg; the `x-user-timezone` header is still accepted (ignored).

## i18n keys
No new user-facing strings (429 copy unchanged). No EN/AR changes needed.

## Contract checklist (Gate 3)
- [x] Write path actor: service-role key only, inside functions; caller auth (F1) untouched.
- [x] RPC shape: `consume_ai_usage(p_user_id int, p_usage_type ai_usage_type) returns int`;
      EXECUTE granted to service_role, revoked from public; SECURITY DEFINER, search_path=public.
- [x] Frontend types untouched (no client adapter change; header contract backward-compatible).
- [x] No double-adapting; mutation returns enough for header re-render (count RETURNING).
- [x] i18n: no new strings.  [x] F5: increment on SAME request as generation (server side).
- [x] Error paths strip internals (F19 pattern kept); CORS untouched (F12 holds).

## Risks
- RPC absent at deploy time → fallback path (identical to today) — merge-safe before owner
  applies 003. 380-char log noise per call until applied (single warn).
- Stale bundles still call confirm-usage → possible double-count for project flow until bundles
  roll (under-count impossible; over-count is the safe direction).
