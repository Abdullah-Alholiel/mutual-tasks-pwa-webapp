# OWNER-QUEUE.md — items waiting on Abdullah

One line per item, newest last. Format: `- YYYY-MM-DD · what is needed · where it came from`.
An item leaves this list only by being resolved (owner answer → update STATE.json/DECISIONS.md
and strike the line by moving it to the resolved section below — never delete history).

## Open

- 2026-11-11 · RLS rewrite decision: all 13 tables run Allow-all policies (anon/authenticated/service_role, USING(true)) and anon has full DML incl TRUNCATE — the app's custom session model rides the anon key, so these policies ARE the app's access control. Need owner-approved policy design before any rewrite (owner-only: RLS) · run 4 full-stack audit (evidence in kanban/RUNS/20261111T2231Z-run4.md)
- 2026-11-11 · completion_logs missing from supabase_realtime publication while the client subscribes to it — one-command fix `ALTER PUBLICATION supabase_realtime ADD TABLE public.completion_logs;` but it is a prod DB change (owner-only) · run 4 full-stack audit

## Resolved

- 2026-11-11 · Promote staging → main (3 security fixes: F1 push auth, P1-6b push-target auth, F19 error strip) → APPROVED D-014 "Promote now"; executed this run as PR #9 (merge 04222f7), post-deploy checks green · kanban/RUNS/20261111T2231Z-run4.md
