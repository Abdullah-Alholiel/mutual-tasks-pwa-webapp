# Run 1 — Program design (Gates 1–3 compact)

Date: 2026-11-08 · Phase P1 · Branch: lane/run1-p1-6-push-auth → PR → staging

## Problem (Gate 0 evidence)

| ID | Evidence | Impact |
|---|---|---|
| F1 | `netlify/functions/send-push-notification.ts` has no caller auth; any internet client can send pushes to any user | Security blocker (P1-6) |
| F19 | same file line 98 returns `details: responseText` (OneSignal raw); `ai-confirm-usage.ts` line 90 returns `error.message` | internals leak to clients |
| F12 | `getCorsHeaders()` = `*`; push file hardcodes `Access-Control-Allow-Origin: *` | unauthenticated CORS wide open |
| BROKEN-PROD | client calls `/api/send-push-notification`, `/api/ai-generate-project`, `/api/ai-generated-description`, `/api/ai-confirm-usage`; netlify.toml + public/_redirects have no `/api/*` redirect | live probe: POST https://social-momentum.netlify.app/api/ai-generate-project → 404 text/html. Production AI + push flows never reach a function |
| F2 | local `dist/assets/index-*.js` contains `VITE_SUPABASE_SERVICE_ROLE_KEY:"sb_secret_…"` — bare `import.meta.env` consumers (src/lib/auth/auth.ts:25) inline the whole env object; repo .env carries the service key | P1-5 (owner-side var removal queued; this run adds the CI gate) |

## User story

As a logged-in user, my device's push notifications are triggered only by the app (or its
functions), never by an anonymous third party; failures never expose server internals; the
deployed AI/push endpoints actually execute in production.

## Scope

IN: push caller auth (function + client header), F19 strip (both files), F12 allowlist in
shared utils + push file, `/api/*` Netlify route (enabler for production verification),
CI bundle gate step in pr-gate.yml (F2 tripwire), vitest suites, design doc.
OUT: Pages Functions port (P1-9 full), atomic quota RPC (P1-7), F22 dual secret header
(n8n credential header name needed — owner/n8n-UI info, not derivable from repo), F2 .env
var removal (owner-side), AI_LIMITS values (owner-only).

## Data flow (target)

```
notificationService → sendPushNotification(payload)
  → POST /api/send-push-notification { Authorization: Bearer <momentum_session_token> }
  → netlify redirect /api/* → /.netlify/functions/<fn>
  → verifyMagicLinkSession(token) → 401 if invalid  (who: any authenticated user;
    rate-limiting per-user is P1-7 scope, noted as follow-up)
  → OneSignal send → { success, id, recipients } | { success:false, error: generic }
```

## Contracts (Gate 3)

- JSON in: `{ externalUserId, title, message, url?, icon?, data? }` (unchanged)
- JSON out 200: `{ success: true, id: string, recipients: number }`
- JSON out 200 unsubscribed: `{ success: false, error: "No subscription found for user" }`
  (externalUserId echoed; `hint` dropped — internal guidance)
- JSON out errors: `{ error: string }` ONLY — no `details`, no OneSignal/pg text
- 401 body: `{ error: "Unauthorized" }`
- CORS: origin allowlist via shared helper (`APP_ORIGIN_ALLOWLIST`: https://social-momentum.netlify.app,
  http://localhost:5173, http://localhost:4173, http://localhost:3000); Allow-Headers
  `Content-Type, authorization, x-user-timezone`
- i18n: no new user-visible strings (server error bodies consumed by JS only) — n/a
- Function signature: netlify Handler types unchanged; Pages port (P1-9) adapts later

### Contract checklist (run before implementation)

- [✓] Write path states WHO can call it: `verifyMagicLinkSession` on every POST (401 otherwise)
- [✓] Frontend types accept the exact JSON the backend produces (PushNotificationPayload unchanged; response `{success,id?,recipients?,error?}` subset-check as today)
- [✓] Adapter: response handling already in pushNotificationApi.ts (safe-parse + boolean); no double-adapting
- [✓] Mutations return enough to re-render: push result is fire-and-forget boolean (no refetch needed)
- [✓] i18n: no new user-facing strings; error copy unchanged (`Rate limit exceeded` message untouched)
- [✓] AI-limit path: untouched this run (increment still client-called; P1-7 fixes server-side)
- [✓] Error paths strip internals; CORS explicit allowlist (no `*`)

## Files changed

1. `netlify/functions/send-push-notification.ts` — auth gate, strip details, shared CORS
2. `netlify/functions/shared/utils.ts` — allowlist CORS helper (`getCorsHeaders`)
3. `netlify/functions/ai-confirm-usage.ts` — strip `details` from 500
4. `src/lib/onesignal/pushNotificationApi.ts` — send session Bearer header
5. `netlify.toml` — `/api/*` redirect (status 200, functions; placed BEFORE SPA fallback)
6. `.github/workflows/pr-gate.yml` — NEW: tsc/vitest/build + bundle service-key grep (enforcing)
7. `docs/plans/2026-11-08-run1/01-program-design.md` (this file), `00-status.md`
8. tests: `tests/functions/pushAuth.test.ts`, `tests/functions/apiRoute.test.ts`

## Risks

- Redirect order: `/api/*` must precede `/* → index.html` or SPA swallows it (verified shape in PR gates)
- Web-push flows calling from non-browser contexts get 401 — current only caller is notificationService (browser, logged in)
- Old deployed clients without the header get 401 on push until next deploy — acceptable: same deploy ships both sides (Netlify deploys atomically)
