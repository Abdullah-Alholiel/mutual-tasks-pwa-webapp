# Run 19 — L4c: AI without n8n (program design, Gates 1–3 compact)

## Problem (Gate 1)
Both AI features (project generation, description generation) run through n8n webhooks.
The n8n admin login is lost and the `x-momentum-secret` no longer matches on the Pages
side, so AI generation is dead on Cloudflare (502 "AI service unavailable"). L4b (the
Cloudflare cutover) needs AI working on Pages first (owner decision D-20261115-13,
reconfirmed by worker request D-055 2026-11-20: take L4c FIRST).

User story: as a signed-in user I generate a project from a description and task/project
descriptions; on a Workers AI outage or spent free allowance an OpenRouter free-model
backup answers; when everything is exhausted I get a clear "AI help is back tomorrow"
message in EN + AR and no usage is counted.

Scope IN: port both calls into the shared function modules behind Workers AI + OpenRouter
fallback; n8n path kept behind `AI_PROVIDER_MODE=n8n` (and as auto-fallback when the `AI`
binding is absent, so Netlify production keeps working unchanged until cutover); server-side
quota (`checkRateLimit`/`incrementUsage`) unchanged; client exhaustion + 45 s timeout
handling; unit tests with mocked providers; neuron measurement field in function logs.
Scope OUT: prod deployments, key rotation (OPENROUTER_API_KEY already saved as a Pages
secret by the owner — never read), AI_USAGE_LIMITS changes, schema changes, n8n deletion.

## Data flow (Gate 2)
Client (`generateAIProject` / `generateAIDescription`) → POST /api/* (session Bearer) →
Netlify handler module (single source of truth, imported verbatim by the Pages bridge) →
`netlify/functions/shared/aiProviders.ts`:
1. `AI_PROVIDER_MODE=n8n` OR (`auto` AND no `AI` binding) → legacy n8n fetch (today's code
   path, byte-for-byte contract).
2. `auto` + binding → Workers AI primary → invalid/empty → Workers AI backup model →
   invalid/empty OR exhaustion/throw → OpenRouter fallback model (if enabled).
3. All fail → distinct error (`AI_EXHAUSTED` when the free allowance is spent, generic
   otherwise). Usage incremented ONLY on valid content (existing behavior).
The Pages bridge (`installEnv`) learns to pass OBJECT bindings through (the `AI` binding is
an object; the shim previously copied strings only) — `functions/api/_shared/env.ts`.

## Contract (Gate 3)
### Endpoints (unchanged paths + auth)
POST /api/ai-generate-project `{ description: string }`, Bearer session. 200 body:
canonical project JSON `{ name, description, icon, color, isPublic, tasks[] }` (client's
`data.name && data.tasks` path validates this directly — no client parser change needed).
POST /api/ai-generated-description `{ title: string, type: 'task'|'project' }`. 200 body:
`{ "description": "<text>" }` (client parses `data.description` first — plain text also OK).
Errors (all hosts): 400 invalid input, 401 session, 429 rate limit, 429-style exhaustion =
**503 `{ "error": "AI_EXHAUSTED" }`**, 502 provider returned unusable content, 500 generic.
Error bodies stay exactly `{ error: string }` (F19) — provider internals never leak.

### Provider chain (models probed live by Claude 2026-11-16, plans/ai-port/README.md)
- project: `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (max_tokens 1800) →
  `@cf/openai/gpt-oss-120b` (max_tokens 4000 — reasoning eats small budgets) →
  OpenRouter `AI_FALLBACK_MODEL` (default `meta-llama/llama-3.3-70b-instruct:free`,
  max_tokens 4000).
- description: `@cf/mistralai/mistral-small-3.1-24b-instruct` (max_tokens 300) →
  OpenRouter `AI_FALLBACK_MODEL` (max_tokens 300).
- Workers AI shapes: llama/mistral return `{response}`, gpt-oss returns
  `choices[0].message.content` — both parsed; `usage.*_tokens` measured when present.
- Exhaustion detection (allowance spent / rate limited / quota text) skips remaining
  Workers AI attempts and goes straight to the fallback for the rest of that UTC day
  (per-attempt check; app-wide counter intentionally NOT added — see report).

### Env switches (plain env vars, safe defaults in code — README step 7)
- `AI_PROVIDER_MODE`: `auto` (default) | `workers` | `n8n`
- `AI_FALLBACK_ENABLED`: default on; `false`/`0` disables OpenRouter
- `AI_FALLBACK_MODEL`: default `meta-llama/llama-3.3-70b-instruct:free`
- `OPENROUTER_API_KEY`: Pages secret, owner-set, never read/printed by the factory

### Prompts
Ported VERBATIM from n8n-workflows.json (primary + backup variants merged into the
primary system/user pair), plus one added line in both prompts per README step 3:
"Write in the same language as the user's text." (fixes English-for-Arabic).

### TS signatures
```ts
generateProjectWithAI(deps: { aiBinding: unknown }, description: string):
  Promise<{ ok: true; project: ValidatedProject; provider: string; model: string;
            usage?: AiTokenUsage; attempts: string[] } |
          { ok: false; error: string; exhausted: boolean; attempts: string[] }>;
generateDescriptionWithAI(deps: { aiBinding: unknown }, title: string, type: 'task'|'project'):
  Promise<{ ok: true; text: string; provider: string; model: string;
            usage?: AiTokenUsage; attempts: string[] } |
          { ok: false; error: string; exhausted: boolean; attempts: string[] }>;
```

### Client contract additions
- 45 s AbortController timeout on both AI fetches → existing TIMEOUT toast path.
- 503 `AI_EXHAUSTED` in the error body → localized message (EN + AR, navigator.language,
  same mechanism as LegalPage — the app has no i18n framework): "AI help is back
  tomorrow" / "سيعود الذكاء الاصطناعي غدًا". No other client change.

### i18n keys
`AI_EXHAUSTED` title+description in EN and AR (leaf-key counts equal; Arabic string used
when `navigator.language` starts with `ar`; dir=rtl already handled by the app shell).

### Gate-3 checklist (run explicitly)
- [x] Write path states WHO can call it: unchanged — Bearer session via
      `verifyMagicLinkSession` + per-user `checkRateLimit` (server-side, UTC day).
- [x] Frontend types accept the exact JSON the backend produces: canonical project JSON
      matches `AIGeneratedProject` + the client's direct-JSON branch; description body
      `{description}` matches the client's first parse branch.
- [x] Adapters: NO new adapter needed — response shapes were chosen to hit existing
      client branches (verified in Gate 0 read of generateAIProject.ts:126-131 and
      ai/actions.ts:88-105).
- [x] Mutations return enough data to re-render: rate-limit headers unchanged
      (X-RateLimit-*), remaining count flows as before.
- [x] i18n: EN+AR strings for the new exhaustion message, both present.
- [x] AI-limit path: usage increment stays server-side on the SAME request (F5 fix kept);
      increment only on valid content; premium `remaining === -1` convention untouched.
- [x] Error paths strip internals (F19 kept; only `{error}` bodies); CORS allowlist
      unchanged (`getCorsHeaders`).

## Risks
- Workers AI free allowance (10,000 neurons/day, resets 00:00 UTC) can spend: exhaustion
  path + OpenRouter backup + EN/AR message cover it; real neuron numbers measured on
  staging and reported (README step 9).
- gpt-oss empty content on small budgets → 4000-token retry only, empty treated invalid.
- OpenRouter free models are rate-limited per minute/day — it is the LAST resort only.
- Netlify production must keep working: `auto` mode falls back to n8n when no binding —
  gated by tests.
