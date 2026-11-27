# OWNER-QUEUE.md — items waiting on Abdullah

One line per item, newest last. Format: `- YYYY-MM-DD · what is needed · where it came from`.
An item leaves this list only by being resolved (owner answer → update STATE.json/DECISIONS.md
and strike the line by moving it to the resolved section below — never delete history).

## Open

- 2026-11-22 · **Apply 004 scoped RLS on prod — NOW UNBLOCKED, needs the owner go** (OWNER-ONLY: RLS on prod). The promote went live 2026-11-22 (PR #30, a639872, Pages production, smoke 12/12), so the D-066 order ("ship the new app version first, then apply 004 right after") is satisfied. Rollout: fresh dump → quiet window → apply 004 → live gateway header probe (x-momentum-session) → 24 h watch. Rehearsal 65/65 (kanban/RUNS/rehearsal-004.txt); rollback script restores pre-tightening state verbatim. Execute in the owner/Claude session; factory verifies after · run 23
- 2026-11-22 · **L4b step 4 — switch functions APP_URL to the production address** (Claude/VPS change, not factory): sign-in links still point at the staging preview until this lands (documented at L1, 2026-11-13 16:42) · run 23
- 2026-11-22 · Netlify retirement: production is Cloudflare Pages since 2026-11-22 17:45 UTC; Netlify stays untouched as fallback for 48 h (until ≈2026-11-24), then retires on a separate owner yes · L4b step 5, run 23
- 2026-11-22 · Oracle backup bucket link (D-067: "Later, after the cutover" — the cutover landed today, so this is now actionable; needed for launch condition C3 + the L8 restore drill) · run 23
- 2026-11-16 · iPhone ?diag=1 readout of the L0 sign-in visibility issue (open https://staging.social-momentum-8zq.pages.dev/?diag=1, tap COPY THIS TEXT, paste to chat) · L0 lane item, panel now ships from the repo (D-029); re-raised by the owner 2026-11-22 (D-063). UPDATE run 24 2026-11-22: the fix is on staging (PRs #31/#32 — WebKit cold 1.09s); production gets it at the next promote, so the iPhone readout is most useful AFTER that promote lands
- standing · lawyer review of privacy and terms (C6) — draft is current as of PR #29; tracked in LAUNCH-LANE.md "Waiting on the owner"
- 2026-11-27 · **semgrep enforce-by 2026-12-11 (default+48h-veto)**: the new advisory gate (PR #43) flips to ENFORCING on 2026-12-11 unless the owner vetoes in chat/board; baseline at flip = 0 findings on 252 files · run 33
- 2026-11-27 · **pr-agent key (L7 remainder)**: the PR-review workflow needs an owner-provided CodiumAI/Qodo key before it can be built; factory cannot self-serve credentials. Spec ready: digest-pinned CLI, zai coding endpoint for the model, covers PRs to staging AND main, job success ≠ reviewed (verify the review BODY) · run 33

## Resolved

- 2026-11-16 · **Promote/production decision** (Netlify prod fails the signed-out-data smoke check; options: promote to Netlify or go straight to the Cloudflare cutover) → DONE 2026-11-22 run 23: owner go D-064 + order D-066; PR #30 merged (a639872); production deployed to Cloudflare Pages (--branch main, deployment 8dc06f40); FULL SMOKE 12/12 PASS on https://social-momentum-8zq.pages.dev INCLUDING "signed-out visitor downloads no user data"; release-verify + security PASS on main. Cloudflare Pages is production · kanban/RUNS/20261122T1735Z-run23.md
- 2026-11-16 · Confirm the Pages project env vars include VITE_ONESIGNAL_APP_ID → RESOLVED: settings were set for preview AND production by Claude with the owner 2026-11-15 (9 each, incl. secrets + AI binding, D-044/L4b UPDATE); every factory deploy pins the id from the live bundle with the D-052 drift guard (fa9620b0-…923d), and the production deploy passed that gate + full smoke 2026-11-22 · run 23
- 2026-11-18 · Realtime under scoped policies (accept short-term vs build the fix) → ANSWERED 2026-11-22 D-065: owner accepts the loss of live updates for now; app works via optimistic updates + refetch-on-focus; build signed live updates AFTER launch · run 23
- 2026-11-18 · Promote staging → main (OWNER go per D-017) → superseded by the 2026-11-22 D-064 go; executed same day as PR #30 (see above) · run 23
- 2026-11-11 · RLS rewrite decision → RESOLVED 2026-11-13: owner approved option (a) scoped-policy design (D-018); built + rehearsed as 004 (PRs #23/#26); apply is the 2026-11-22 open item above
- 2026-11-12 · F22 dual secret header check → RESOLVED 2026-11-13: owner approved keep-both-headers, close without the n8n check (D-019); settled during the Pages functions port (L2, PR #15)

- 2026-11-11 · Promote staging → main (3 security fixes: F1 push auth, P1-6b push-target auth, F19 error strip) → APPROVED D-014 "Promote now"; executed this run as PR #9 (merge 04222f7), post-deploy checks green · kanban/RUNS/20261111T2231Z-run4.md
- 2026-11-11 · completion_logs missing from supabase_realtime publication → DONE 2026-11-13 13:08 UTC: owner decided "do it" (Life OS D-20261112-02); applied on prod by Claude (owner session) with a fresh dump first. Proof: pg_publication_tables now lists 7 tables incl. public.completion_logs. Factory: verify only, no DB action · backup ~/backups/claude-hermes/20261113-1310-momentum-db-pub-003/
- 2026-11-12 · Apply 003_consume_ai_usage_rpc.sql on prod → DONE 2026-11-13 13:08 UTC: owner decided "do it" (Life OS D-20261113-01); applied on prod by Claude (owner session) with a fresh dump first. Proof: public.consume_ai_usage exists, execute = service_role only (anon/authenticated false), two calls in a rolled-back transaction returned 1 then 2, PostgREST schema cache reloaded. Factory: verify only, then the legacy-fallback removal (A8) is a normal staging PR · same backup dir
- 2026-11-13 · P0-2 SOUL approval (card t_0e249925) → ALREADY DONE 2026-11-05 14:57 UTC: owner approved the draft in chat and SOUL.md was replaced then (header says "approved by owner 2026-11-05"; no draft file remains). Factory: close the card · checked by Claude (owner session) 2026-11-13
- 2026-11-13 · P0-1 main protection (card t_ed96c8d0) → owner decided NO branch rules (2026-11-05 and again 2026-11-13: owner checks staging, then AI promotes). Only GitHub push protection remains, owner toggles it in the UI. Factory: drop "main protected" from the P1 preconditions, keep "never push to main" as doctrine · Life OS D-20261110-03
- 2026-11-13 · D-015 worker request (patch the factory loop skill) → DONE by Claude with the owner 2026-11-13 ~14:50 UTC, do NOT patch it again: momentum-factory-loop revised (six-step run, checkpoint-first housekeeping, launch lane, worker requests), new `kanban/LAUNCH-LANE.md`, new `scripts/momentum-smoke.py`, pre-run script extended. Still owed by the factory: the first run report written under the new order · backup ~/backups/claude-hermes/20261113-1500-momentum-loop-prep/

## Historical (superseded sections kept for the audit trail)

### Open now (2026-11-18, run 16 refresh) — all three answered above

- 2026-11-18 · Apply 004 scoped RLS on prod (OWNER-ONLY): PR #23 built+rehearsed; **UPDATED run 17 (PR #26, ec700a8): 004 hardened — 3 self-escalation holes closed (self-join role-locked to participant, users UPDATE column-locked against is_premium flips, ai_usage_logs anon SELECT-only), rehearsal now 65/65 on disposable PG15 (kanban/RUNS/rehearsal-004.txt). Rollback restores pre-tightening grants verbatim.** **ORDER (D-057, run 21): apply 004 ONLY AFTER the promote staging→main is live on production — the new client (sends x-momentum-session on every request, src/lib/supabaseFetch.ts) must be in users' hands first; applying 004 against today's prod client (which sends no session header) locks out every current user.** Rollout = promote first → fresh dump → quiet window → 004 → live gateway header probe → 24h watch. Needs the owner go (promote first, then 004). → SUPERSEDED 2026-11-22: promote went live; moved to Open above
- 2026-11-18 · Realtime under scoped policies (owner decision, run 15 disclosure) → ANSWERED D-065 2026-11-22 (see Resolved)
- 2026-11-18 · Promote staging → main (OWNER go per D-017) → DONE as PR #30 2026-11-22 (see Resolved)

### Open (2026-11-16 batch, pre-run-23)

- 2026-11-16 · Confirm the Pages project env vars include VITE_ONESIGNAL_APP_ID … · run 11 → RESOLVED run 23 (see Resolved)
- 2026-11-16 · iPhone ?diag=1 readout … · run 12 → still open (D-063), moved to Open above
- standing · old cloud data: copy or start fresh · staging database project (A6) · Oracle bucket link (L8) · lawyer review (C6) → old-cloud-data decision overtaken by events (the VPS DB holds the real accounts and IS production since 2026-11-15); Oracle bucket re-raised 2026-11-22 (D-067, now actionable); A6/lawyer still open

- automated close-out 2026-11-24T22:30Z: run 27 died mid-run; report 20261124T1730Z-run27.md had SECTIONS_IN_PROGRESS; informational, no owner decision needed

- run 29 (2026-11-25): OWNER ACTION — AI binding re-attach. The D-075 acceptance AI proof
  (first live run) found /api/ai-generated-description → 204-empty and /api/ai-generate-project
  → 200-empty on BOTH Pages environments: the Workers-AI `AI` binding was not reaching the
  functions (legacy n8n branch answers; n8n returns empty).
  UPDATE run 31 (2026-11-26, DIAGNOSIS SHARPENED — the earlier "one redeploy fixes it" note
  here was DISPROVEN the same day): the binding IS attached at project level on both
  environments (Pages API GET project: ai_bindings {"AI":{}} preview + production;
  OPENROUTER_API_KEY present). Run 31 redeployed staging with the merged D-077 code
  (deployment 4cddc582, smoke 12/12) and probed signed-in as qa-bot: STILL 204-empty, and
  per-deployment configs show ai_bindings null on EVERY deployment including the fresh one.
  Conclusion: project-level ai_bindings does not reach Direct Upload (wrangler) deployments
  of this project — likely also why AI never worked on Pages since the 2026-11-16 attach
  (run 20's check grepped the served bundle, it never made a real signed-in call).
  OWNER/CLAUDE-SESSION RESOLUTION PATHS (pick one, staging first): (a) re-enter the binding
  in the dashboard (Pages > social-momentum > Settings > Bindings > Workers AI) and
  redeploy; (b) decide on a repo wrangler.toml (pages_build_output_dir + ai_bindings) —
  WARNING: run 18's verified rule says toml config becomes source of truth and would
  override/drop the owner-set env vars, so this needs the owner's explicit call and a
  migration of all env vars into the toml or a CF support answer; (c) ask Cloudflare why
  deployment_configs.ai_bindings does not apply to Direct Upload deployments.
  AI generation is broken for Pages users until one of these lands. Blocking: L4d finish
  (acceptance AI proof), forced-fallback drill, launch condition C2. Informational: no data
  loss; usage rows still increment on empty answers.
  RE-CONFIRMED run 30 (2026-11-25): aiProof FAIL http=204 on BOTH acceptance runs vs two FRESH
  deploys (40f52624, d73bdf1b) — the action is still outstanding; the RC auto-writes as soon as
  this lands and two acceptance runs pass.
- run 29 (2026-11-25): run-28 close-out record — run 28 (2026-11-24 22:30Z) built PR #37 +
  twice-green acceptance + wrote RELEASE-CANDIDATE.md but died before its report; this run
  recovered the state, WITHDREW the RC (it certified 5414526 while staging moved on), and the
  D-075 guard now refuses that drift mechanically.
