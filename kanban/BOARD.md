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
