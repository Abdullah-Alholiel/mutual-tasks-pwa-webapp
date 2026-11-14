# L2 — Cloudflare Pages port (plan item A5) — program design (Gates 1–3)

Run 8, 2026-11-14. Phase P1. Owner decisions in play: D-002 (Pages target),
D-007 (owner creates Pages project + env vars — DONE for project, env vars pending),
D-010 (cutover owner-approved only), D-019 (dual secret header stays until the n8n
credential name is confirmed in the n8n UI — owner-side), D-021 (C1–C6 accepted).

## Problem / user story

`/api/*` on the Pages staging preview (staging.social-momentum-8zq.pages.dev) serves the
app's HTML: AI generation and push cannot work on the future production host. The port
must give Pages the same 4 API functions, security headers and SPA routing Netlify has,
so cutover (D-010) becomes a verification exercise, not a rewrite.

P0 story: as a user on the Pages URL, AI description/project generation and push
notifications behave exactly as on Netlify (same paths, same bodies, same errors).

## Scope

IN: `functions/api/*` Pages Functions (4), `_headers`, `_routes.json`, CSP hardening
(unsafe-eval + n8n host OUT — F7/F14, plan A5), `sourcemap: false` for Pages builds,
`APP_ORIGIN_ALLOWLIST` += both pages.dev origins, port contract tests.
OUT: DNS/cutover (owner, D-010), Pages env vars (owner, D-007), Netlify removal,
APP_URL switch, any client-side change.

## Architecture (the one non-obvious decision)

Pages Functions **import the Netlify handler modules verbatim** and wrap them in a thin
`Request → HandlerEvent → Response` bridge:

    functions/api/<fn>.ts            15-line adapter: installEnv(env) → toNetlifyEvent(request)
                                     → netlify handler → toResponse
    functions/api/_shared/env.ts     workerd has no process global; surfaces Pages env
                                     bindings as process.env so shared/utils.ts works unchanged
    functions/api/_shared/adapter.ts toNetlifyEvent / toResponse / NetlifyStyleResult

Parity is STRUCTURAL (same module at runtime), not asserted by source diffing. The four
handlers only touch `httpMethod` / `headers` / `body` (grep-verified run 8) and import
nothing Node-specific; `@netlify/functions` imports are type-only (erased), so wrangler
bundles cleanly. `import type { Handler }` handlers are plain functions at runtime.

Routing: `functions/api/<fn>.ts` serves `/api/<fn>` — the exact paths the client already
calls (src/lib/onesignal/pushNotificationApi.ts:40, src/features/ai-service/actions/
generateAIProject.ts:31, src/features/ai/actions.ts:18, src/hooks/useAIGeneration.ts:118).
No client change.

Pages control files are GENERATED into `dist/` by `scripts/pages-config.mjs` after the
build — never committed into `public/`: Netlify gives a `_redirects` file precedence
over netlify.toml redirects, which would shadow the `/api/*` rules that run production
today (apiRoute.test.ts guards exactly this). Pages gets `_routes.json`
(include `["/api/*", "/*"]`, exclude every static top-level file/dir — assets win over
includes when no function matches, so excludes are pure perf; `/index.html` excluded =
SPA navigations served statically, never through the Functions invoker).

CSP: netlify.toml's policy minus `'unsafe-eval'` in script-src (F7) minus the n8n host
in connect-src (F14 — the browser never calls n8n; the functions do, server-side).
Everything else byte-parity (unsafe-inline kept; cdn.jsdelivr.net kept — strict parity,
minimal diff).

`sourcemap`: `PAGES_BUILD=1 vite build` → `sourcemap: false` (maps must not ship to
pages.dev, plan A5). Netlify builds keep `'hidden'` (Sentry symbolication unchanged).

## Exact JSON shapes / TS contracts

Unchanged by construction — the same Netlify module serves both hosts:
- responses: `{ statusCode, headers, body }` internally; clients receive the same
  parsed bodies (`{ error }` on failures, `{ success, id, recipients }` on push,
  `{ success, message, usageDate, userId, usageType }` on confirm-usage, 429 rate-limit
  shape, raw n8n text 200/204 on description).
- caller auth: Bearer session token on all four (verifyMagicLinkSession, service_role).
- CORS: origin allowlist via getCorsHeaders — NOW `APP_ORIGIN_ALLOWLIST` +=
  `https://social-momentum-8zq.pages.dev` (future production) and
  `https://staging.social-momentum-8zq.pages.dev` (gateway CORS already allows both
  since 2026-11-13).
- env names needed on Pages (owner, D-007): VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
  N8N_PROJECT_WEBHOOK_URL, N8N_DESCRIPTION_WEBHOOK_URL, x_momentum_secret,
  ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY.
- i18n: no user-facing strings touched — no key changes.

## Gate 3 checklist (shown, not summarized)

- [✓] Every write path states WHO can call it: session-token auth server-side; service_role
      env-gated; RLS untouched (no DB change in this run).
- [✓] Frontend types accept the exact JSON: zero client change; same handlers produce bodies.
- [✓] Adapters exist for every API shape: functions/api adapters wrap; no double-adapting.
- [✓] Mutations return enough data: bodies identical (same module).
- [✓] i18n keys: none added/removed (no user-facing string change).
- [✓] AI-limit path: same handler code — server-side increment on the same request (P1-7
      semantics preserved verbatim).
- [✓] Errors stripped + CORS explicit allowlist (never `*`): same shared/utils.ts code;
      allowlist extended with the two owned pages.dev origins.

## Slices (Gate 4)

1. Tracer: `_shared/env.ts` + `_shared/adapter.ts` + `functions/api/ai-confirm-usage.ts`
   + port contract tests → gates green → commit.
2. Remaining 3 functions (push, generate-project, description) → gates → commit (squashed
   into the same PR).
3. `scripts/pages-config.mjs` (_headers/_routes generation + hardened CSP) +
   `PAGES_BUILD` sourcemap toggle + `APP_ORIGIN_ALLOWLIST` += 2 pages.dev origins +
   package.json `pages:build` script → gates → commit.
4. PR → CI green → two scoped reviewers → squash-merge → deploy preview (`--branch
   staging`) → full smoke against the preview URL → report.

Risks: Pages project env vars missing until owner sets them → `/api/*` on the preview
answers 500 "not configured" (page/DB/edge-function smoke still passes); CSP without
unsafe-eval breaks a hidden dependency → caught by browser smoke on the preview before
any cutover proposal.
