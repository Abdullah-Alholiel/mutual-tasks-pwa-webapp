# Run 35 — D-081 G3: Monthly AI limits, usage meter, premium interest (Gates 0–3, compact)

## Gate 0 — retro / live-state audit (2026-11-28)

Premise re-verified against live code (D-081/D-078 line references all reproduce):

- `netlify/functions/shared/utils.ts:3-6` — limits are per **UTC day**: project 3/day,
  description 10/day. **D-081 fixes description to 20** per the owner numbers.
- `netlify/functions/shared/utils.ts:24-35` — `is_premium` bypasses **all** caps
  (remaining/limit = -1). D-081: Premium = 100 projects + 1,000 descriptions per month.
- `src/db/aiUsage.ts:29-32` — dead client-side daily config (3/5), superseded by the
  server-side P1-7 flow; `src/db/index.ts:87` constructs it but no UI consumer calls
  `db.aiUsage` (grep: only usageLimits.ts). Left untouched.
- `src/features/pages/Premium.tsx:100-101` — perks say "free: 3/day" and "free: 10/day".
- `src/features/pages/legalContent.ts:36` (privacy EN) + `:60` (privacy AR) + `:85`
  (terms EN) + `:106` (terms AR) — say "per user **per day**".
- `src/db/aiUsage.ts:44-48` — client day from device timezone (pre-F11 pattern); dead
  path, untouched.

Consumers mapped (Gate 0 connectivity walk):
- Server check: `ai-generate-project.ts:70` + `ai-generated-description.ts:83` →
  `checkRateLimit` (premium -1 branch at utils.ts:31-35). Increment on success
  (`remaining !== -1` guard, ai-generate-project.ts:93; ai-generated-description.ts ~:214).
- 429 shape: `buildRateLimitResponse` (utils.ts:224-238), messages hardcoded "today".
- Client: `generateAIProject.ts` reads `X-RateLimit-Limit/Remaining` headers (429 + 200);
  `AIProjectModal.tsx:124-138` meter chip ("N/3 left" — hardcoded 3, must read limit);
  `useAIGeneration.ts` description path reads remaining into a toast; `ai/actions.ts:59`
  matches `'Daily limit reached'` substring in the 429 body.
- AI_USAGE_LIMITS module duplication (F8): netlify/utils.ts (server truth) vs
  src/db/aiUsage.ts (dead client copy) — **not consolidated** (out of scope; no prod-DB
  or structural change requested).
- Dev standalone DB (`src/db`) uses per-device-timezone days: dev-only, untouched.

Gate-0 verdict: PROCEED. All D-081 file:line targets confirmed live.

## Gates 1-3 — product spec + architecture + program design

Problem: a hand-activated Premium user is unlimited today (money + abuse risk); pricing
surfaced to users contradicts the decided card (daily vs monthly; 10 vs 20 descriptions).

User story: as a free user I get 3 AI projects + 20 AI descriptions **per month** (UTC);
as a Premium user I get 100 + 1,000 per month; both see a usage meter and the real numbers
everywhere the limits are mentioned; a free user who hits the limit can record interest.

Scope IN (one PR): single limits module `src/lib/planLimits.ts` (owner numbers only);
`005_monthly_limits.sql` migration (schema-only, **NOT applied anywhere** — owner applies);
`getMonthlyUsage` in netlify/functions/shared/utils.ts (reads month totals, premium caps);
`checkRateLimit` + `incrementUsage` switch to monthly windows; premium interest endpoint
`netlify/functions/premium-interest.ts` (caller-authed, service-role insert, rate-limited);
client: meters read the limit from the API, Premium.tsx shows real numbers + records
interest via the endpoint; copy fix in Premium.tsx + legalContent (EN+AR, all four lines);
unit tests (monthly window, premium caps, interest validation).

Scope OUT: plan_limits DB table + RLS (owner applies 005 first); payment code (owner-only);
changing AI_USAGE_LIMITS key names; touching the dead src/db client repo; n8n paths.

### Gate 3 contract checklist (verified before implementation)

- [x] Write paths state WHO can call: premium_interest verifies session server-side
      (verifyMagicLinkSession, same as both AI functions), service-role insert
      (premium_interest has no anon policy under 004 — anon INSERT revoked on this table
      family; service_role bypasses RLS); in-memory IP+user throttle: 5/hour/user.
- [x] Frontend types accept exact backend JSON: 429/200 shapes unchanged — only header
      VALUES (limits 3→3 proj, 10→20 desc, monthly remaining) and usage-date semantics
      change. New 200-shape for interest: `{ ok: true }`; error `{ error: string }`.
- [x] Adapters: client already reads limits from headers — no new API shape to adapt;
      AIProjectModal chip label switches from hardcoded "N/3 left" to `N/{limit} left`
      (limit from headers, already fetched).
- [x] Mutations return enough to re-render: interest POST returns `{ok:true}`; UI keeps
      its own sent-state; no refetch needed.
- [x] i18n: EN + AR strings for every new user-facing string (Premium.tsx perks/CTA,
      meter chip "left" is numeric — no word change needed; toasts already bilingual via
      errorMessages.ts). legalContent EN+AR updated in the same dictionaries (leaf counts
      unchanged — text replaced in place).
- [x] AI-limit path: server-side increment stays on the SAME request as generation
      (unchanged); quota window becomes UTC month (2026-11-01..2026-11-30 boundaries via
      en-CA month string compare), computed SERVER-SIDE only (F11 preserved).
- [x] Error paths strip internals; CORS allowlist reused via getCorsHeaders.

Exact JSON shapes (unchanged unless noted):
- 429 body: `{ error: "Rate limit exceeded", message, limit, remaining: 0 }` — message
  now says monthly.
- 200 headers: X-RateLimit-Limit ∈ {3,20} (free) / {100,1000} (premium as -1 today —
  unchanged convention: premium = -1 unlimited... NO: D-081 premium = monthly caps
  100/1000, remaining counts down; -1 convention RETIRED for AI paths? — DECISION:
  keep -1 convention OUT. Premium now returns limit 100/1000 and a real remaining;
  `remaining === -1` consumers (AIProjectModal:125) keep a defensive -1 branch but it
  no longer occurs; increment guard `remaining !== -1` becomes always-increment-with-
  remaining>=0 (premium increments too — needed for its own monthly caps).
- POST /api/premium-interest: auth Bearer session; 200 `{ ok: true }`; 400
  `{ error: "message required" }` (message ≤ 500 chars, optional note); 401 unauth
  `{ error }`; 429 throttled `{ error: "Too many requests" }`; 500 generic.

TS signatures:
- `getMonthlyUsage(supabaseAdmin, userId, usageType): Promise<{used:number; remaining:number; limit:number; allowed:boolean}>`
- `PLAN_LIMITS = { free: { project_generation: 3, description_generation: 20 },
  premium: { project_generation: 100, description_generation: 1000 } }` (single module,
  imported by utils.ts; client Premium.tsx mirrors via its own import from the same file
  — vite bundles the constants only, no server code).
- `recordPremiumInterest(supabaseAdmin, userId, email, message): Promise<void>`

i18n keys: legalContent EN/AR privacy "AI features" + terms "AI features"/"Availability
and limits" paragraphs edited in place (counts equal); Premium.tsx strings (component is
English-only today — add bilingual EN/AR via the existing navigator.language pattern used
by errorMessages/LegalPage, no i18n framework exists in this repo).

Risks: premium users' usage is now counted (needed for caps); month boundary is UTC
("resets on the 1st" surfaced in copy); existing daily rows remain (no backfill needed);
the migration is NOT applied — server code must work WITHOUT the RPC/table until the
owner applies 005 (graceful: interest endpoint returns 500-generic and logs; caps work
via ai_usage_logs reads that already exist).

## 00-status.md gate table

| Gate | Status |
|---|---|
| 0 Retro/audit | DONE (premise verified live) |
| 1 Product | DONE (scope above) |
| 2 Architecture | DONE (files listed) |
| 3 Contract | DONE (checklist all ✓) |
| 4 Slices | in progress → see RUNS report |
