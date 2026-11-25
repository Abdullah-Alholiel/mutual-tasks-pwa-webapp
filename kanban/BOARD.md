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
- Runs 13-14 (2026-11-16/17/18): DIED before checkpoint (stale-lock recovery); no commits
  survived; their L4/L5 work was adopted and completed by runs 15-17.
- Run 15 (2026-11-18): **L5 SHIPPED** — PR #23 merged (bbcc1f7): 004 scoped RLS policies
  (x-momentum-session header → app_current_user_id(), SECURITY DEFINER helpers, TRUNCATE
  revoked, magic_links anon-zero) + ON DELETE CASCADE on the four tasks child FKs + client
  per-request session header. Rehearsal 52/52 (disposable PG15). Prod apply = owner-only;
  Realtime impact disclosed (owner decision pending). Report: kanban/RUNS/ run 15.
- Run 16 (2026-11-18): **D-050/D-052 SHIPPED** — PR #24 merged (3bc4669): CI security.yml
  (gitleaks BLOCKING full-history + npm audit report-only), scripts/deploy-pages-preview.sh
  (pinned-env staging deploys, never repo .env), pr-gate tsc re-armed as a ratchet vs
  baseline 97. Red proof: PR #25 fake secret → gitleaks red in 6s, closed+deleted.
  Report: kanban/RUNS/20261118T2231Z-run16.md
- Run 17 (2026-11-19): **D-053 SHIPPED** — PR #26 merged (ec700a8): 3 self-escalation holes
  closed in 004 scoped policies BEFORE the owner's prod apply — (1) participants self-join
  requires role='participant' (no self-manager/owner), (2) users UPDATE column-locked
  (is_premium/premium_since/premium_note untouchable by anon; profile columns granted),
  (3) ai_usage_logs anon SELECT-only (client increment path = zero callers; RPC is the sole
  writer). Rollback restores pre-tightening grants verbatim. Rehearsal 65/65 PASS on
  disposable PG15 (13 new proofs; kanban/RUNS/rehearsal-004.txt). Gates: tsc 97=97,
  vitest 145/145, build clean, CI green, reviewer MERGE (0 C/0 I). Staging smoke 12/12;
  prod still 22/23 (known pre-promote gap, owner queue). Report: kanban/RUNS/20261119T1733Z-run17.md
- Run 18 (2026-11-19): **D-054 SHIPPED (adapted)** — PR #27 merged (217930e):
  public/_headers (hardened CSP: no unsafe-eval [F7], no n8n host [F14]) is now
  deploy-invariant — vite copies it into EVERY build; pages-config.mjs verifies the copy
  instead of generating. TWO REFUSALS vs the worker request, both guard-tested
  (tests/functions/pagesControlFiles.test.ts): NO public/_redirects (Netlify
  file-over-toml precedence would shadow the 4 /api rules in Netlify prod; Pages
  SPA-falls-back natively — /privacy 200 live) and NO wrangler.toml (CF source-of-truth
  rule would drop the owner-set 10 env vars incl 4 secrets + the AI binding on next
  deploy). FIXED LIVE BUG found this run: the staging preview served NO security headers
  (plain vite build + wrangler upload ships no control files; functions kept answering,
  so the smoke test missed it) — all 6 headers verified live via curl after the pinned-env
  redeploy (smoke 12/12). Gates: tsc 97=97, vitest 152/152 (+7), reviewer MERGE 0C/0I.
  Prod smoke 22/23 (same known pre-promote gap). Report: kanban/RUNS/20261119T2231Z-run18.md
- Run 19 (2026-11-20): **L4c CODE MERGED, run died before closeout** — PR #28 merged
  (squash 14bdbf9): AI generation off n8n → Workers AI binding primary + OpenRouter
  fallback (D-055), 21 tests, gates green. Report file left as an empty skeleton; no
  deploy, no smoke, lock not released (pre-run script cleared it). Run 20 completed
  the tail and verified the claims.
- Run 20 (2026-11-20): **D-056 SHIPPED + L4c deploy verified** — PR #29 merged (squash
  83338bf): legal draft fixes for the lawyer (real support address momentum.pwa@gmail.com,
  named processors EN+AR, storage location Riyadh+Pages+localStorage, user-lookupability
  disclosure, AI-training claim softened to what is verified, terms→privacy pointer);
  Premium mailto honesty ('sent' → 'opened' role=status, no delivery promise). +11 tests,
  gates green (tsc 97=97, vitest 183/183, build clean, CI green), reviewer MERGE.
  Pinned-env deploy #2, smoke 12/12 (one transient paint-check FAIL re-passed, L0 class),
  /privacy EN+AR real-browser screenshots DOM-asserted + vision-verified
  (kanban/RUNS/run20-privacy-en.png / -ar.png). L4c ticked in LAUNCH-LANE (proof above);
  momentum-factory-loop skill rule 3 patched per D-055 (worker requests jump the lane
  only if they block it). Report: kanban/RUNS/20261120T2230Z-run20.md
- Run 21 (2026-11-21): **D-057 SHIPPED (docs run)** — (1) L4b cutover report written
  (kanban/RUNS/20261121T1734Z-run21-L4b-cutover-report.md): Netlify->Pages diff, FRESH full
  smoke 12/12 on the staging preview re-run this run, pre-authorised rollback steps, honest
  gap noted (signed-in AI proof still needs qa-bot/L4d or an owner sign-in); L4b stays
  unchecked — steps 2-5 need the owner go. (2) 004 ORDER TRAP fenced: apply is now gated on
  the promote going live FIRST (new client sends x-momentum-session, supabaseFetch.ts) —
  order written into OWNER-QUEUE + LAUNCH-LANE L5 + STATE blocker (commit c9abc32, grep
  proof in all three). L4d sized honestly: 2-4 h across two runs (WebKit container 2.8 GB
  not yet pulled; @qa-bot account does not exist yet) — deferred to run 22 with a plan,
  not skipped silently. No code PR this run (lane item was a docs deliverable; stop-building
  line honored). Run 20 claims re-verified: /privacy EN+AR 200, legalContent.ts:5 real
  address, smoke reproduced. Report: kanban/RUNS/20261121T1734Z-run21.md
- Run 23 (2026-11-22): **L4b steps 1–3 DONE — CLOUDFLARE PAGES IS PRODUCTION** — (run 22 died at
  its checkpoint: skeleton committed 6d709d6, lock cleared by the pre-run script; this run picked
  the lane up). Owner answered a 11-row decision batch (D-059…D-069, committed from the dirty
  tree in checkpoint 14a5c7a); D-064 = the promote go, D-066 = order (new app version first,
  004 right after). PR #30 promote (merge commit a639872, merge commit NOT squash — one
  revertible unit): CI gate + gitleaks + GitGuardian green on the PR, release-verify +
  security PASS on main post-merge. Production deploy to Pages --branch main from an isolated
  merge-commit worktree with the pinned-env build (pins from the live bundle, never repo .env):
  deployment 8dc06f40, STRICT bundle gate clean (chunk index-BWrObEOX.js, self-hosted address,
  anon role), secret sweep clean, served-bundle grep 0 secrets / 0 netlify hosts, security
  headers served (repo _headers match). FULL SMOKE 12/12 PASS on
  https://social-momentum-8zq.pages.dev incl. signed-out-visitor-downloads-no-user-data (the
  Netlify prod FAIL since 2026-11-11) + probes: unauth push 401 JSON, AI 400 function JSON,
  served hash stable across polls. Gates re-run fresh this run: tsc -b 0 errors (97 baseline),
  vitest 183/183, build exit 0. Local dist n8n/netlify host-grep hits inspected and ruled
  BENIGN (legal-page prose naming past processors D-056 + legacy-n8n log string kept for
  Netlify parity D-055; no hosts). L4b ticked (steps 4-5 remain: APP_URL switch = Claude/VPS,
  Netlify 48 h fallback then owner-yes retirement). Report: kanban/RUNS/20261122T1735Z-run23.md

- Run 24 (2026-11-22): **L0 residual FIX SHIPPED — sign-in first paint measured 8.56s → 1.09s** —
  WebKit harness (Playwright 1.62.1 noble container, iPhone viewport, first time the 2.8 GB image
  was actually pulled) against the LIVE PRODUCTION bundle measured the residual after PR #13:
  DOM at 0.93s, sign-in visible only at 7.83s (SW install starting at `load` ≈0.3s still freezes
  WebKit rAF through the entrance window); repeat visit 1.92s barely under the 2s bar. PR #31
  (squash 7e90858, reviewer MERGE-WITH-FIXES, its 1 IMPORTANT — a vacuous race test — fixed
  before merge): pwaRegister now registers the SW on TRUE IDLE (requestIdleCallback capped 2.5s /
  first interaction / plain fallback, 8s register race kept), 9→10 new unit tests, vitest alias
  for the virtual:pwa-register module. Staging re-measure after #31: cold STILL 8.56s → second
  root cause proven: the mom-reveal CSS floor holds only 0.6s, then framer-motion inline
  opacity:0 rules until its rAF loop runs. PR #32 (squash fdb02fc, reviewer MERGE, all MINOR):
  opacity removed from the entrance initial props of the 4 sign-in wrappers (the lane's fix
  direction (a): first paint must not depend on a JS animation). Post-merge pinned-env preview
  deploy + FULL SMOKE 12/12 + WebKit: cold 1.09s, repeat 0.82s — BOTH <2s, PASS with margin.
  Evidence JSON + screenshots: kanban/RUNS/20261122T2233Z-run24-evidence/. L0 stays UNCHECKED:
  production still serves the pre-fix bundle (promote = owner decision); owner iPhone check +
  D-063 diag readout remain. D-070 logged (default+48h-veto). Deferred worker requests (D-027,
  no silence): D-068 production-plan refresh, D-069 Sentry CSP+setUser — not built, budget.
  Report: kanban/RUNS/20261122T2233Z-run24.md

- Run 30 (2026-11-25): **G1 SHIPPED (first growth-lane item) + AI break re-confirmed on two
  fresh deploys** — PR #39 merged (squash 28675be, reviewer MERGE, 2 real MINORs fixed
  pre-merge in cf81702): sign-in logo without tile (D-046) — glow/shadow/sheen/plate removed
  (anti-slop), transparent assets mechanically derived from the brand icon
  (scripts/derive-transparent-logo.py; dark variant recolors the near-black wordmark light for
  the dark auth screen), 4 unit tests incl. byte-hash dark≠light. Real-browser proof on the
  deployed preview (d73bdf1b, head d1b5633): light/dark/forced-rtl phone screenshots, NO tile,
  wordmark readable both themes, old plate asset 0 hits
  (kanban/RUNS/20261125T2231Z-run30-evidence/). PR #40 merged (48a5b0d): dead
  useOneSignalPush hook deleted + diag banner v6 fix (both run-11 factory candidates CLOSED).
  L4d twice-green attempt on final head d1b5633: engines 8/8 BOTH engines + cleanup ZERO +
  freshness OK on both runs, aiProof FAIL http=204 BOTH runs — the Workers-AI binding is still
  not attached (owner action from run 29 pending; 204-empty = legacy n8n branch answering,
  netlify/functions/ai-generated-description.ts:205-207). RC correctly withheld; L4d stays
  open, mechanically owner-blocked. Full smoke 12/12 twice. Gates fresh: vitest 210/210,
  tsc 97=baseline, build 0. Report: kanban/RUNS/20261125T2231Z-run30.md

## Factory candidates (small, pre-scored; next runs pick from LAUNCH-LANE first)

- run 12 reviewer MINORs (none user-blocking): LegalPage unmount resets html lang/dir
  unconditionally; auth legal links do full page reloads (SPA-nav nit);
  checkIntegrity export lacks its own token guard (sole caller is gated today).
