# RELEASE CANDIDATE

Generated automatically by scripts/acceptance (D-045 part 3).
Promotion itself stays OWNER-APPROVED — this file is only the ready-to-promote signal
that turns into the owner's "Promote Momentum to production?" card.

- Time: 2026-11-24T23:14:40.733Z
- Staging head: 5414526
- Acceptance: last two runs green (both engines, EN+AR, zero-leftover cleanup)
- Smoke: green (the deploy script runs the full smoke before this runner)

## Commit range (main..staging)

```
5414526 test(acceptance): run-28 mid evidence — engines 8/8 both engines vs fixed deploy; runner RC bug still present in this tree
d914320 fix(acceptance): runner RC capture glued the engine banner onto the exit code (L4d) (#37)
519e128 test(acceptance): run-28 suite vs pre-fix deploy (18:05Z deploy raced rebase) — delete still FAIL, suite rerun next
d85566d test(acceptance): run-27 post-fix suite (18:05Z) — add/complete/realtime now PASS both engines; delete-project FAIL both (FK order, fixed in PR #36); WebKit AR dir race
9f78b12 docs(kanban): automated close-out — previous run died mid-run
fe67eb6 test(acceptance): run-27 red suite artifacts (pre-fix baseline, cleanup ZERO)
355f8f4 fix(projects): FK-safe project delete order — grandchildren + notifications cleared first (L4d, run 28) (#36)
3230d99 fix(tasks): preserve chosen due time through project-detail task creation (L4d, run 27) (#35)
4ad5b0b docs(kanban): run 27 — preflight complete
4ad7aa5 feat(scripts): scripted run close-out (D-073) — audits newest RUNS report, repairs dead-run leftovers, refuses live runs
2106854 docs(kanban): run 27 started — checkpoint-first, salvaged run-26 acceptance evidence, D-073/D-074 lane
40cc007 chore(kanban): weekly security sweep 2026-11-24 — refresh SEC blocker attribution, correct DEBT line, drop stale LOCK from index
a7cf9f9 fix(tasks): default due date 23:59 today + L4d acceptance suite (D-045) (#34)
57f7955 docs(kanban): run 26 started — checkpoint-first, salvage run 25 L4d suite, docker gate fix
d5f9b2a fix(security): Sentry CSP ingest host + id-only setUser + loud APP_URL failure in supabase functions (D-071) (#33)
a1e1aa1 docs(kanban): run 25 started — checkpoint-first, D-071 three small requests, lane = L4d acceptance suite
cb63720 docs(kanban): run 24 — L0 residual fix shipped (PRs #31+#32, WebKit 8.56s->1.09s, smoke 12/12), D-070 logged
e0d00bf docs(kanban): run 24 — L0 findings + reviewer results checkpoint
fdb02fc fix(auth): sign-in first paint no longer depends on a JS animation (L0) (#32)
7e90858 fix(pwa): register service worker on true idle, not at load (L0 residual) (#31)
```

## Plain-language change list

See the latest kanban/RUNS report for the human summary of every commit above.
