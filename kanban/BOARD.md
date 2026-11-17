# BOARD.md — pointer + phase gates

## Single work queue

The live board is the Hermes kanban board `momentum-factory`:

    hermes kanban --board momentum-factory list

Board hygiene: items move TODO → WIP → IN-REVIEW → DONE ✅. A run picks ≥1 user-visible item
+ at most 1 hardening item (when the factory loop is unpaused). This file mirrors phase
context only — do NOT maintain a parallel task list here.

## Phases (source: KICKOFF §2; current phase lives in kanban/STATE.json)

- **P0 Bootstrap** — DONE when: skills written+archived, SOUL approved, board seeded, crons
  created, `main` branch-protected + GitHub push protection on (owner), Telegram ack tested.
- **P1 Safety net** — `staging` branch; pr-gate (tsc, vitest, build, bundle secret-grep,
  migrations fresh-apply) · security (gitleaks, npm audit high ENFORCING) · semgrep · pr-agent ·
  release-verify; Cloudflare Pages (main=prod, staging=preview) with 4 Pages Functions,
  `_headers`/`_redirects`, CSP w/o `unsafe-eval` and w/o the n8n host; fixes F1/F5 + atomic
  UTC-day quota RPC + single limits module + error stripping + CORS allowlist; staging Supabase
  (managed free, no real data); RLS 100% + port baseline; encrypted offsite backup (NOT R2;
  owner-approved target) + 1 restore drill; watchdog + backup-verify + security-sweep crons live.
  Exit: injected secret and failing test turn a PR red; watchdog escalates an injected failure;
  restore drill passes; Pages preview serves staging with the service-role key absent from the bundle.
- **P2 Paid AI tier** — provider = owner decision (DECISIONS D-004). Design per R1 §4
  (plan_limits, subscriptions, webhook_events, atomic consume_ai_usage, Turnstile, spend guard,
  AI cost logging). Exit: pay → entitlement → limit change verified DB→API→UI on staging.
- **P3 Production autonomy (Level B)** — only when ALL: 10 consecutive green promotes; every gate
  enforcing; RLS 100% + bundle clean 14 days; rollback drill <15 min; 2 restore drills; Telegram
  ack tested; branch+push protection on. Any red release-verify → back to A.
- **P4 Public launch** — owner buys domain → Pages custom domain, Cloudflare Tunnel for the
  Supabase host, Supabase redirect URLs + OneSignal origin switched ONCE, privacy/terms, retire Netlify.

## Hard rails (from kanban/DECISIONS.md — primacy)

staging = all work · main = owner-approved releases only · never push main · never R2 ·
AI limits owner-only · Level A until P3 conditions met.

## Lock guard / dead-run watchdog (LOCK 2h)

- A factory run holds `kanban/LOCK.json` while live; >2h old = dead run, safe to take over.
- `kanban/LOCK.json` is gitignored (run-scoped, regenerated per run).

## Run history

- Run 1 (2026-11-08): PR #6 merged — F1 push caller auth + /api route repair + F2 bundle gate.
- Run 2 (2026-11-09): PR #7 merged — P1-6b push-target authorization. Leftovers closed in run 3.
- Run 3 (2026-11-10): PR #8 merged — P1-8/F19 error-detail strip on AI functions (bef8197).
  Report: kanban/RUNS/20261110T2359Z-run3.md
- Run 4 (2026-11-11): **PROMOTE EXECUTED** — D-014 owner-approved; PR #9 staging→main
  (merge commit 04222f7, merge not squash), prod verified live, push hole closed. Plus:
  PR #10 merged — P1-11 realtime fix (friends subscription, 714923d). Full-stack audit found
  allow-all RLS on all 13 tables (escalated, owner-only) + completion_logs publication gap
  (escalated). Sweep port-diff abort fixed. Report: kanban/RUNS/20261111T2231Z-run4.md
- Run 5 (2026-11-12): **P1-7 SHIPPED** — PR #11 merged (cd2ddac): atomic AI usage quota
  (F11 UTC-day key, F4 consume_ai_usage RPC + legacy fallback, F5 server-side project increment,
  client confirm → no-op; RPC migration 003 ready but UNAPPLIED — owner-gated). PR #12 merged
  (dcb50e2): dead Express server/Dockerfile + express/zod removed → npm audit 2crit+19high →
  1crit+16high. Report: kanban/RUNS/20261112T2231Z-run5.md
- Run 6 (2026-11-13): L0 shipped — PR #13 merged (259912b): sign-in screen invisible on iOS
  Safari (opacity-0 framer-motion wrappers + SW stall). Report in kanban/RUNS/.
- Run 7 (2026-11-14): L1 shipped — PR #14 merged (ad30096): magic-link fails honestly when the
  email send fails (502 {success:false}); email-delivery mapper + 10 tests; deployed to the VPS
  functions container. Report: kanban/RUNS/20261114T1735Z-run7.md
- Run 8 (2026-11-14): **L2 SHIPPED** — PR #15 merged (61b0fdf): Cloudflare Pages port complete
  (4 Pages Functions importing the Netlify handlers verbatim, hardened _headers/_routes.json
  generated into dist/, PAGES_BUILD sourcemap:false, pages.dev origins allowlisted). Deployed
  --branch staging; full smoke 11/11 PASS on staging.social-momentum-8zq.pages.dev; /api probes
  exact JSON. Env-var pitfall (repo .env poisons local builds) documented in LAUNCH-LANE.
  Report: kanban/RUNS/20261114T2231Z-run8.md
- Run 9 (2026-11-15): **L3 SHIPPED** — PR #16 merged (d6b3b2b): release-verify runs the smoke
  HTTP legs from CI; pr-gate bundle config gate (fails on key/address mismatch = the
  2026-11-13 incident class); red proof on a poisoned build. Full smoke 21/21.
- Run 10 (2026-11-15): DIED before checkpoint (lock found stale ~19h later) — its uncommitted
  L4 slice was adopted and completed by run 11. No commits survived.
- Run 11 (2026-11-16): **L4 SHIPPED** — PR #17 merged (14309c4): OneSignal non-blocking load
  (dynamic import + 2s cap + sticky failure; hanging-CDN browser proof 0.81s render; reachable
  proof OneSignal @0.8s) + D-029 diag panel shipped in-repo. PR #18 merged (e30b75d): D-031 DB
  diagnostic dev-only (was shippable to every visitor; with open RLS it is an anon write path).
  Staging preview redeployed 3× with pinned env (URL+anon key+OneSignal app id); full smoke
  21/21 twice; 2 glm-5.3-flash reviewers (all findings MINOR/P2; fixes applied).
  Report: kanban/RUNS/20261116T1733Z-run11.md
- Run 12 (2026-11-16): **D-025 SHIPPED + PROD SMOKE FAIL FIXED ON STAGING** — PR #19 (7844c45)
  /privacy + /terms DRAFT pages EN+AR (auth links + og:image, twitter:site removed); PR #20
  (d7270a5) ?lang= override; PR #21 (835b80e) DataIntegrityGuard no longer fetches ALL
  tasks/projects for signed-out visitors (the smoke FAIL found on production this run — prod
  still exposed until promote/ownership decision, see OWNER-QUEUE); PR #22 (921b8b0) reviewer
  IMPORTANTs (absolute og:image, 44px targets). Staging preview final deploy 5047501f: full
  smoke 12/12 PASS; AR proof: html lang=ar dir=rtl, screenshots in cron/output/run12-shots/.
  Process slip: one follow-up commit landed direct on staging, recovered via PR #20.
  Report: kanban/RUNS/20261116T2232Z-run12.md

## Factory candidates (small, pre-scored; next runs pick from LAUNCH-LANE first)

- src/hooks/useOneSignalPush.ts is dead code (zero consumers; duplicates init outside the
  idle-scheduled path) — reviewer A finding, run 11. Delete in a hardening slot (L6 area).
- diag-panel.js banner says "v4 run x/3" while the file header + summary say v6/2 runs —
  cosmetic, fix when touching the panel next.
- run 12 reviewer MINORs (none user-blocking): LegalPage unmount resets html lang/dir
  unconditionally; auth legal links do full page reloads (SPA-nav nit);
  checkIntegrity export lacks its own token guard (sole caller is gated today).
