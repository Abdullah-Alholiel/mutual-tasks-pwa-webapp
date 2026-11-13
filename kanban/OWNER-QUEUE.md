# OWNER-QUEUE.md — items waiting on Abdullah

One line per item, newest last. Format: `- YYYY-MM-DD · what is needed · where it came from`.
An item leaves this list only by being resolved (owner answer → update STATE.json/DECISIONS.md
and strike the line by moving it to the resolved section below — never delete history).

## Open

- 2026-11-11 · RLS rewrite decision: all 13 tables run Allow-all policies (anon/authenticated/service_role, USING(true)) and anon has full DML incl TRUNCATE — the app's custom session model rides the anon key, so these policies ARE the app's access control. Need owner-approved policy design before any rewrite (owner-only: RLS) · run 4 full-stack audit (evidence in kanban/RUNS/20261111T2231Z-run4.md)
- 2026-11-12 · F22 dual secret header check (10 seconds in the n8n UI): the AI webhooks use headerAuth and the credential's expected header name is encrypted at rest — confirm whether n8n wants `x-momentum-secret` or `x_momentum_secret`, then we can drop the other · run 5

## Resolved

- 2026-11-11 · Promote staging → main (3 security fixes: F1 push auth, P1-6b push-target auth, F19 error strip) → APPROVED D-014 "Promote now"; executed this run as PR #9 (merge 04222f7), post-deploy checks green · kanban/RUNS/20261111T2231Z-run4.md
- 2026-11-11 · completion_logs missing from supabase_realtime publication → DONE 2026-11-13 13:08 UTC: owner decided "do it" (Life OS D-20261112-02); applied on prod by Claude (owner session) with a fresh dump first. Proof: pg_publication_tables now lists 7 tables incl. public.completion_logs. Factory: verify only, no DB action · backup ~/backups/claude-hermes/20261113-1310-momentum-db-pub-003/
- 2026-11-12 · Apply 003_consume_ai_usage_rpc.sql on prod → DONE 2026-11-13 13:08 UTC: owner decided "do it" (Life OS D-20261113-01); applied on prod by Claude (owner session) with a fresh dump first. Proof: public.consume_ai_usage exists, execute = service_role only (anon/authenticated false), two calls in a rolled-back transaction returned 1 then 2, PostgREST schema cache reloaded. Factory: verify only, then the legacy-fallback removal (A8) is a normal staging PR · same backup dir
- 2026-11-13 · P0-2 SOUL approval (card t_0e249925) → ALREADY DONE 2026-11-05 14:57 UTC: owner approved the draft in chat and SOUL.md was replaced then (header says "approved by owner 2026-11-05"; no draft file remains). Factory: close the card · checked by Claude (owner session) 2026-11-13
- 2026-11-13 · P0-1 main protection (card t_ed96c8d0) → owner decided NO branch rules (2026-11-05 and again 2026-11-13: owner checks staging, then AI promotes). Only GitHub push protection remains, owner toggles it in the UI. Factory: drop "main protected" from the P1 preconditions, keep "never push to main" as doctrine · Life OS D-20261110-03
- 2026-11-13 · D-015 worker request (patch the factory loop skill) → DONE by Claude with the owner 2026-11-13 ~14:50 UTC, do NOT patch it again: momentum-factory-loop revised (six-step run, checkpoint-first housekeeping, launch lane, smoke gate, worker requests), new `kanban/LAUNCH-LANE.md`, new `scripts/momentum-smoke.py`, pre-run script extended. Still owed by the factory: the first run report written under the new order · backup ~/backups/claude-hermes/20261113-1500-momentum-loop-prep/
