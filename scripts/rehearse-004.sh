#!/usr/bin/env bash
# ============================================================================
# rehearse-004.sh — L5 rehearsal of the scoped RLS policies on a DISPOSABLE DB
# ============================================================================
# Spins up a throwaway PostgreSQL 15 container, applies 001 -> 002_premium ->
# 003 -> 004, and runs the acceptance probes required by D-018/D-049:
#   1. anon blocked from other users' rows (every user-scoped table)
#   2. anon blocked from TRUNCATE
#   3. anon blocked from magic_links entirely
#   4. app flows pass with a valid session header (member reads/writes, joins,
#      owner/manager paths)
#   5. rollback restores Allow-all — then 004 re-applies cleanly
#
# METHOD (the two things a rehearsal harness must get right):
#   * RLS only applies to non-owner roles. ALL probes run via `SET ROLE anon`
#     (RLS applies; policies are TO anon). Setup/seed stays as postgres.
#   * One psql invocation = one PostgREST request = one identity: the session
#     header is injected into the SAME psql session via set_config(.., false)
#     (session-level), emulating the `x-momentum-session` request header the
#     browser will send and PostgREST exposes as request.headers.
# NEVER points at production. Read-only with respect to the repo.
# ============================================================================
set -uo pipefail

CONTAINER=momentum-rls-rehearsal
# Random per-run password for the throwaway container (never a literal — a
# hardcoded credential here trips secret scanners; generated at runtime,
# lives only inside this run).
PGPASSWORD_SUPER="$(head -c 16 /dev/urandom | base64 | tr -d '=+/' | head -c 24)"
REPO="${1:-/home/ubuntu/worktrees/momentum/run13-rls}"
MIG="$REPO/database/vps-migration"

psql_admin() {
  docker exec -i -e PGPASSWORD="$PGPASSWORD_SUPER" "$CONTAINER" \
    psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"
}

# run_as TOKEN SQL — ONE -c string: SET ROLE + header GUC + the probe share a
# single implicit transaction. Verified in run 14 that ANY other arrangement
# (split -c flags, SET LOCAL in its own -c, WHERE-false wrapper) loses either
# the role or the GUC before the probe runs. The set_config row + RES marker
# are stripped from output by the awk filter.
run_as() {
  local token="$1" sql="$2" gj
  if [ -n "$token" ]; then
    gj="{\"x-momentum-session\":\"$token\"}"
  else
    gj="{\"x-momentum-session\":null}"
  fi
  docker exec -i -e PGPASSWORD="$PGPASSWORD_SUPER" "$CONTAINER" \
    psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -t -A \
    -c "SET ROLE anon; SELECT set_config('request.headers', '$gj', false); SELECT 'RES'; $sql" \
    | awk 'f; $0=="RES"{f=1}'
}

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

echo "== 1. Starting disposable Postgres 15 =="
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD="$PGPASSWORD_SUPER" postgres:15-alpine >/dev/null
ready=""
for i in $(seq 1 45); do
  if docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then ready=1; break; fi
  sleep 2
done
[ -n "$ready" ] || { echo "FAIL: postgres not ready"; docker logs "$CONTAINER" 2>&1 | tail -3; exit 1; }
echo "PASS: container ready"

echo "== 2. Applying schema chain 001 -> 002_premium -> 003 =="
psql_admin < "$MIG/001_full_schema.sql"          || { echo "FAIL: 001"; exit 1; }
psql_admin < "$MIG/002_premium.sql"              || { echo "FAIL: 002_premium"; exit 1; }
psql_admin < "$MIG/003_consume_ai_usage_rpc.sql" || { echo "FAIL: 003"; exit 1; }
echo "PASS: base schema + premium + atomic RPC applied"

echo "== 3. Seed rehearsal data (fixture, not real users) =="
psql_admin <<'SQL'
INSERT INTO public.users (id, name, handle, email, avatar, timezone) VALUES
  (1, 'Alice Rehearsal', '@alice', 'alice@rehearsal.test', '', 'UTC'),
  (2, 'Bob Rehearsal',   '@bob',   'bob@rehearsal.test',   '', 'UTC'),
  (3, 'Carol Rehearsal', '@carol', 'carol@rehearsal.test', '', 'UTC');
SELECT setval('public.users_id_seq', 3);
INSERT INTO public.user_stats (user_id) VALUES (1),(2),(3);
INSERT INTO public.projects (id, name, owner_id, is_public) VALUES
  (1, 'Alice private', 1, false),
  (2, 'Public proj',   1, true);
SELECT setval('public.projects_id_seq', 2);
INSERT INTO public.project_participants (project_id, user_id, role) VALUES
  (1, 1, 'owner'), (2, 1, 'owner');
INSERT INTO public.tasks (id, project_id, creator_id, title, type, due_date) VALUES
  (1, 1, 1, 'Alice private task', 'one_off', now() + interval '1 day'),
  (2, 2, 1, 'Public task',        'one_off', now() + interval '1 day');
SELECT setval('public.tasks_id_seq', 2);
INSERT INTO public.task_statuses (task_id, user_id, status) VALUES
  (1, 1, 'active'), (2, 1, 'active'), (2, 2, 'active');
INSERT INTO public.friends (user_id, friend_id, status) VALUES (1, 2, 'accepted');
INSERT INTO public.completion_logs (user_id, task_id, xp_earned) VALUES (1, 1, 10);
INSERT INTO public.notifications (user_id, type, message) VALUES
  (1, 'friend_request', 'hello'), (2, 'friend_accepted', 'hi');
INSERT INTO public.ai_usage_logs (user_id, usage_type, usage_date, count) VALUES
  (1, 'description_generation', CURRENT_DATE, 1);
INSERT INTO public.magic_links (token, user_id, email, expires_at) VALUES
  ('ml-token', 1, 'alice@rehearsal.test', now() + interval '1 hour');
INSERT INTO public.sessions (user_id, token, expires_at) VALUES
  (1, 'alice-session-token', now() + interval '1 day'),
  (2, 'bob-session-token',   now() + interval '1 day'),
  (1, 'expired-token',       now() - interval '1 day');
SQL
# Mirror the production Allow-all-era TRUNCATE grant BEFORE applying 004, so
# the TRUNCATE proofs test 004's REVOKE (004 revokes it again) instead of
# testing an ordering artifact. magic_links is used in the proofs because it
# has NO inbound foreign keys — a rejection there is decided by the privilege
# alone (tasks would fail on FK even with the privilege granted).
# 004 re-revokes TRUNCATE, so the state after apply is the scoped posture.
psql_admin -c "GRANT TRUNCATE ON ALL TABLES IN SCHEMA public TO anon;"
echo "PASS: seeded (+ prod-mirror TRUNCATE grant)"

# Apply the migration AFTER seeding + the mirror grant: proofs then exercise
# 004 itself (and its TRUNCATE REVOKE), not pre/post ordering artifacts.
psql_admin < "$MIG/004_rls_scoped_policies.sql" || { echo "FAIL: 004"; exit 1; }
echo "PASS: 004 scoped policies applied"

blocked=0
echo "== 4. PROOF: unsigned caller (no session) is BLOCKED from user rows =="
n=$(run_as "" "SELECT count(*) FROM public.tasks;")
[ "$n" = "1" ] && echo "PASS: unsigned sees exactly the public project task (1 of 2)" || { echo "FAIL: unsigned sees $n tasks (want 1: public only)"; blocked=1; }

n=$(run_as "" "SELECT count(*) FROM public.notifications WHERE user_id = 2;")
[ "$n" = "0" ] && echo "PASS: unsigned sees 0 of Bob's notifications" || { echo "FAIL: unsigned sees $n notifications"; blocked=1; }

n=$(run_as "" "SELECT count(*) FROM public.completion_logs;")
[ "$n" = "0" ] && echo "PASS: unsigned sees 0 completion logs" || { echo "FAIL: unsigned sees $n logs"; blocked=1; }

n=$(run_as "" "SELECT count(*) FROM public.projects;")
[ "$n" = "1" ] && echo "PASS: unsigned sees only the public project (1 of 2)" || { echo "FAIL: unsigned project visibility = $n (want 1)"; blocked=1; }

n=$(run_as "" "SELECT count(*) FROM public.users;")
[ "$n" = "0" ] && echo "PASS: unsigned sees 0 user profiles" || { echo "FAIL: unsigned sees $n users (want 0)"; blocked=1; }

n=$(run_as "" "SELECT count(*) FROM public.user_stats;")
[ "$n" = "0" ] && echo "PASS: unsigned sees 0 user_stats rows" || { echo "FAIL: unsigned sees $n user_stats"; blocked=1; }

n=$(run_as "" "SELECT count(*) FROM public.ai_usage_logs;")
[ "$n" = "0" ] && echo "PASS: unsigned sees 0 ai_usage rows" || { echo "FAIL: unsigned sees $n ai_usage"; blocked=1; }

r=$(run_as "" "SELECT count(*) FROM public.magic_links;" 2>&1)
echo "$r" | grep -q "ERROR" && echo "PASS: magic_links SELECT revoked for anon ($(echo "$r" | grep ERROR | head -1 | cut -c1-50))" || { echo "FAIL: magic_links readable ($r)"; blocked=1; }

r=$(run_as "" "INSERT INTO public.notifications (user_id, type, message) VALUES (2, 'friend_request', 'anon spam') RETURNING id;" 2>&1)
echo "$r" | grep -q "ERROR" && echo "PASS: unsigned INSERT into Bob's notifications rejected" || { echo "FAIL: unsigned INSERT into Bob's notifications succeeded: $r"; blocked=1; }

r=$(run_as "" "TRUNCATE public.magic_links;" 2>&1)
echo "$r" | grep -q "ERROR" && echo "PASS: unsigned TRUNCATE rejected ($(echo "$r" | grep ERROR | head -1 | cut -c1-60))" || { echo "FAIL: unsigned TRUNCATE succeeded"; blocked=1; }

echo "== 5. PROOF: expired token is not an identity =="
n=$(run_as "expired-token" "SELECT count(*) FROM public.tasks;")
[ "$n" = "1" ] && echo "PASS: expired token = unsigned (only the public task, 1 of 2)" || { echo "FAIL: expired token sees $n tasks (want 1)"; blocked=1; }

echo "== 6. PROOF: app flows pass WITH a valid session (Alice) =="
n=$(run_as "alice-session-token" "SELECT count(*) FROM public.tasks;")
[ "$n" = "2" ] && echo "PASS: Alice sees 2 tasks (private + public project)" || { echo "FAIL: Alice sees $n tasks (want 2)"; blocked=1; }

n=$(run_as "alice-session-token" "SELECT count(*) FROM public.users;")
[ "$n" = "3" ] && echo "PASS: signed-in Alice sees the 3-user directory (seed = Alice, Bob, Carol)" || { echo "FAIL: Alice sees $n users (want 3)"; blocked=1; }

r=$(run_as "alice-session-token" "UPDATE public.task_statuses SET status='completed', completed_at=now() WHERE task_id=1 AND user_id=1 RETURNING id;" 2>&1)
echo "$r" | grep -qE '^[0-9]+$' && echo "PASS: Alice completes her own task-status row" || { echo "FAIL: Alice cannot update her status row: $r"; blocked=1; }

r=$(run_as "alice-session-token" "UPDATE public.task_statuses SET status='completed' WHERE task_id=2 AND user_id=2 RETURNING id;" 2>&1)
echo "$r" | grep -qE '^[0-9]+$' && { echo "FAIL: Alice wrote Bob's status row"; blocked=1; } || echo "PASS: Alice cannot write Bob's status row"

n=$(run_as "alice-session-token" "SELECT count(*) FROM public.friends;")
[ "$n" = "1" ] && echo "PASS: Alice sees her friend edge" || { echo "FAIL: Alice sees $n friend edges (want 1)"; blocked=1; }

r=$(run_as "alice-session-token" "INSERT INTO public.friends (user_id, friend_id, status) VALUES (1, 2, 'pending') RETURNING id;" 2>&1)
echo "$r" | grep -qE '^[0-9]+$' && echo "PASS: Alice inserts her own outgoing friend edge" || { echo "FAIL: own-edge insert rejected: $r"; blocked=1; }

r=$(run_as "bob-session-token" "INSERT INTO public.project_participants (project_id, user_id, role) VALUES (2, 2, 'participant') RETURNING user_id;" 2>&1)
echo "$r" | grep -q '^2$' && echo "PASS: Bob self-joins the public project (own row)" || { echo "FAIL: public-project self-join rejected: $r"; blocked=1; }

r=$(run_as "alice-session-token" "INSERT INTO public.project_participants (project_id, user_id, role) VALUES (2, 3, 'participant') RETURNING user_id;" 2>&1)
echo "$r" | grep -q '^3$' && echo "PASS: owner adds a new member (Alice adds Carol to proj 2)" || { echo "FAIL: owner add-member rejected: $r"; blocked=1; }

r=$(run_as "alice-session-token" "INSERT INTO public.task_statuses (task_id, user_id, status) VALUES (2, 2, 'upcoming') RETURNING id;" 2>&1)
echo "$r" | grep -qE '^[0-9]+$' && echo "PASS: owner creates status rows for members (manager flow)" || { echo "FAIL: manager status insert rejected: $r"; blocked=1; }

# The acting-client notification flow, exactly as the corrected client sends
# it (plain INSERT, no RETURNING — notifications.go L5 note): Alice notifies
# Bob. Rejection here = the app flow would break.
r=$(run_as "alice-session-token" "INSERT INTO public.notifications (user_id, type, message) VALUES (2, 'project_joined', 'joined');" 2>&1)
echo "$r" | grep -q "ERROR" && { echo "FAIL: recipient notification rejected: $r"; blocked=1; } || echo "PASS: acting client writes a notification for the recipient (no RETURNING)"

# Documented limitation: with RETURNING the new row must ALSO pass the SELECT
# policy — invisible to the actor -> rejected BY DESIGN (client must not use
# .select() on cross-user notification inserts; fixed in the same PR).
r=$(run_as "alice-session-token" "INSERT INTO public.notifications (user_id, type, message) VALUES (2, 'project_joined', 'joined2') RETURNING id;" 2>&1)
echo "$r" | grep -q "ERROR" && echo "PASS: RETURNING on a cross-user notification insert is rejected (by design; client updated)" || { echo "FAIL: RETURNING cross-user insert unexpectedly succeeded: $r"; blocked=1; }

n=$(run_as "alice-session-token" "SELECT count(*) FROM public.sessions WHERE token='alice-session-token';")
[ "$n" = "1" ] && echo "PASS: session probe reads own session" || { echo "FAIL: own session not readable"; blocked=1; }

r=$(run_as "alice-session-token" "UPDATE public.sessions SET expires_at=now()+interval '30 days' WHERE token='bob-session-token' RETURNING token;" 2>&1)
echo "$r" | grep -q "ERROR" && echo "PASS: anon session writes rejected (function-side only)" || { echo "FAIL: session UPDATE went through: $r"; blocked=1; }

echo "== 6b. PROOF: reviewer-coverage probes (run 15 review) =="
# Recipient reads his OWN notification (the insert from section 6).
n=$(run_as "bob-session-token" "SELECT count(*) FROM public.notifications WHERE user_id = 2;")
[ "$n" = "2" ] && echo "PASS: Bob reads his own notifications (2: seeded + recipient insert)" || { echo "FAIL: Bob sees $n of his own notifications (want 2)"; blocked=1; }
# users_update_self: profile edits stay self-scoped.
r=$(run_as "alice-session-token" "UPDATE public.users SET name='Alice R.' WHERE id = 1 RETURNING id;" 2>&1)
echo "$r" | grep -q '^1$' && echo "PASS: Alice updates her own profile" || { echo "FAIL: self profile update rejected: $r"; blocked=1; }
r=$(run_as "alice-session-token" "UPDATE public.users SET name='hacked' WHERE id = 2 RETURNING id;" 2>&1)
echo "$r" | grep -qE '^[0-9]+$' && { echo "FAIL: Alice wrote Bob's profile"; blocked=1; } || echo "PASS: Alice cannot update Bob's profile"
# friends delete: unfriend removes own edge (re-seeded right after — the
# accept flow in section 7 needs this edge to still exist).
r=$(run_as "alice-session-token" "DELETE FROM public.friends WHERE user_id = 1 AND friend_id = 2 RETURNING user_id;" 2>&1)
echo "$r" | grep -q '^1$' && echo "PASS: Alice removes her outgoing friend edge" || { echo "FAIL: own-edge delete rejected: $r"; blocked=1; }
docker exec -i -e PGPASSWORD="$PGPASSWORD_SUPER" "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q \
  -c "INSERT INTO public.friends (user_id, friend_id, status) VALUES (1, 2, 'pending');"
# participants UPDATE by manager (role change flow).
r=$(run_as "alice-session-token" "UPDATE public.project_participants SET role='manager' WHERE project_id = 2 AND user_id = 3 RETURNING role;" 2>&1)
echo "$r" | grep -q '^manager$' && echo "PASS: owner/manager changes a member role" || { echo "FAIL: manager role change rejected: $r"; blocked=1; }
# task_recurrence DML follows task membership.
r=$(run_as "alice-session-token" "INSERT INTO public.task_recurrence (task_id, recurrence_pattern, recurrence_interval, next_occurrence) VALUES (2, 'Daily', 1, now() + interval '1 day') RETURNING id;" 2>&1)
echo "$r" | grep -qE '^[0-9]+$' && echo "PASS: member inserts a recurrence row" || { echo "FAIL: recurrence insert rejected: $r"; blocked=1; }
# authenticated role is deny-all (guards against a future key/role mixup).
n=$(docker exec -i -e PGPASSWORD="$PGPASSWORD_SUPER" "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -t -A \
  -c "SET ROLE authenticated; SELECT count(*) FROM public.tasks;" 2>&1)
[ "$n" = "0" ] && echo "PASS: authenticated role sees 0 rows (deny-all posture)" || { echo "FAIL: authenticated role sees $n tasks"; blocked=1; }

echo "== 6c. PROOF: D-053 self-escalation holes are CLOSED (run 17) =="
# (1) Signed-in user PATCHes their OWN row to flip premium columns -> must
#     fail on the COLUMN privilege (002_premium added is_premium/premium_since/
#     premium_note; the client profile path only writes name/handle/email/
#     avatar/timezone/notification_preferences/updated_at — verified from
#     toUserRow in src/db/transformers.ts).
r=$(run_as "alice-session-token" "UPDATE public.users SET is_premium = true WHERE id = 1 RETURNING id;" 2>&1)
echo "$r" | grep -qi "ERROR" && echo "PASS: own-row is_premium flip REJECTED (column privilege)" || { echo "FAIL: anon could flip is_premium: $r"; blocked=1; }
r=$(run_as "alice-session-token" "UPDATE public.users SET premium_since = now(), premium_note = 'self-granted' WHERE id = 1 RETURNING id;" 2>&1)
echo "$r" | grep -qi "ERROR" && echo "PASS: premium_since/premium_note write REJECTED" || { echo "FAIL: anon could write premium audit columns: $r"; blocked=1; }
# ...while the profile screen's columns keep working (column-level GRANT).
r=$(run_as "alice-session-token" "UPDATE public.users SET timezone = 'Asia/Riyadh', notification_preferences = '{\"push\":true}' WHERE id = 1 RETURNING id;" 2>&1)
echo "$r" | grep -q '^1$' && echo "PASS: profile columns (timezone, notification_preferences) still writable" || { echo "FAIL: legitimate profile write broke: $r"; blocked=1; }

# (2) Self-insert as manager/owner on a public project -> must fail; the
#     self-join branch is join-only (role = 'participant'). Section 6 already
#     gave Bob a participant row: remove it first (admin) so every proof below
#     exercises the POLICY, not the (project_id, user_id) PK.
docker exec -i -e PGPASSWORD="$PGPASSWORD_SUPER" "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q \
  -c "DELETE FROM public.project_participants WHERE project_id = 2 AND user_id = 2;" >/dev/null
r=$(run_as "bob-session-token" "INSERT INTO public.project_participants (project_id, user_id, role) VALUES (2, 2, 'manager') RETURNING user_id;" 2>&1)
echo "$r" | grep -qi "ERROR" && echo "PASS: self-insert as manager on public project REJECTED" || { echo "FAIL: anon self-promoted to manager: $r"; blocked=1; }
r=$(run_as "bob-session-token" "INSERT INTO public.project_participants (project_id, user_id, role) VALUES (2, 2, 'owner') RETURNING user_id;" 2>&1)
echo "$r" | grep -qi "ERROR" && echo "PASS: self-insert as owner on public project REJECTED" || { echo "FAIL: anon self-promoted to owner: $r"; blocked=1; }
# ...while the plain participant self-join still works (re-run of the section-6 proof).
r=$(run_as "bob-session-token" "INSERT INTO public.project_participants (project_id, user_id, role) VALUES (2, 2, 'participant') RETURNING user_id;" 2>&1)
echo "$r" | grep -q '^2$' && echo "PASS: normal participant self-join still works" || { echo "FAIL: join flow broke: $r"; blocked=1; }
# (Bob is a participant again — sections 7/7b expect his membership.)

# (3) ai_usage_logs is anon SELECT-only: the legacy client increment path has
#     zero callers (src/db/aiUsage.ts is dead code; every real increment runs
#     through consume_ai_usage(), service_role). All anon writes must fail.
r=$(run_as "alice-session-token" "DELETE FROM public.ai_usage_logs WHERE user_id = 1 RETURNING id;" 2>&1)
echo "$r" | grep -qi "ERROR" && echo "PASS: anon DELETE of own ai_usage row REJECTED" || { echo "FAIL: anon deleted a usage row: $r"; blocked=1; }
r=$(run_as "alice-session-token" "UPDATE public.ai_usage_logs SET count = 0 WHERE user_id = 1 RETURNING id;" 2>&1)
echo "$r" | grep -qi "ERROR" && echo "PASS: anon counter-zeroing UPDATE on ai_usage REJECTED" || { echo "FAIL: anon forged a usage counter: $r"; blocked=1; }
r=$(run_as "alice-session-token" "INSERT INTO public.ai_usage_logs (user_id, usage_type, usage_date, count) VALUES (1, 'description_generation', CURRENT_DATE, 999) RETURNING id;" 2>&1)
echo "$r" | grep -qi "ERROR" && echo "PASS: anon INSERT into ai_usage REJECTED" || { echo "FAIL: anon inserted a usage row: $r"; blocked=1; }
# ...while the read path and the atomic RPC keep working.
n=$(run_as "alice-session-token" "SELECT count(*) FROM public.ai_usage_logs WHERE user_id = 1;")
[ "$n" = "1" ] && echo "PASS: Alice still reads her usage row (SELECT survived)" || { echo "FAIL: usage read broke ($n rows)"; blocked=1; }
n=$(docker exec -i -e PGPASSWORD="$PGPASSWORD_SUPER" "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -t -A \
  -c "SELECT public.consume_ai_usage(1, 'description_generation');" 2>&1)
[ "$n" = "2" ] && echo "PASS: consume_ai_usage RPC still increments (seed 1 -> 2)" || { echo "FAIL: RPC broken after 004 changes: $n"; blocked=1; }

echo "== 6d. PROOF: participants UPDATE cannot cross the policy line =="
# A role change must stay within what the actor already manages. Bob is a
# participant of project 2 (re-joined in 6c); his UPDATE on his OWN row has a
# USING clause that fails (he is not a manager) -> RLS denial = 0 rows,
# silently. Assert on the RESULTING STATE, not on an error.
r=$(run_as "bob-session-token" "UPDATE public.project_participants SET role = 'manager' WHERE project_id = 2 AND user_id = 2 RETURNING role;" 2>&1)
echo "$r" | grep -q "ERROR" && { echo "FAIL: UPDATE should fail silently (0 rows), not error: $r"; blocked=1; } || true
n=$(run_as "bob-session-token" "SELECT count(*) FROM public.project_participants WHERE project_id = 2 AND user_id = 2 AND role = 'manager';")
[ "$n" = "0" ] && echo "PASS: Bob cannot self-promote via UPDATE (row still role=participant)" || { echo "FAIL: Bob escalated via UPDATE ($n manager rows)"; blocked=1; }
# And the legitimate manager path still works (re-run of section 6b's proof
# under the tightened file: Alice promotes Carol).
r=$(run_as "alice-session-token" "UPDATE public.project_participants SET role = 'manager' WHERE project_id = 2 AND user_id = 3 RETURNING role;" 2>&1)
echo "$r" | grep -q '^manager$' && echo "PASS: legitimate manager role-change still works" || { echo "FAIL: manager role-change broke: $r"; blocked=1; }
psql_admin -c "UPDATE public.project_participants SET role = 'participant' WHERE project_id = 2 AND user_id = 3;" >/dev/null

echo "== 7. PROOF: Bob's view is scoped to Bob =="
n=$(run_as "bob-session-token" "SELECT count(*) FROM public.tasks;")
[ "$n" = "1" ] && echo "PASS: Bob sees exactly his 1 accessible task" || { echo "FAIL: Bob sees $n tasks (want 1)"; blocked=1; }

n=$(run_as "bob-session-token" "SELECT count(*) FROM public.completion_logs;")
[ "$n" = "0" ] && echo "PASS: Bob sees none of Alice's completion logs" || { echo "FAIL: Bob sees $n logs (want 0)"; blocked=1; }

r=$(run_as "bob-session-token" "UPDATE public.friends SET status='accepted' WHERE user_id=1 AND friend_id=2 AND status='pending' RETURNING status;" 2>&1)
echo "$r" | grep -q '^accepted$' && echo "PASS: Bob accepts Alice's request (recipient-side update)" || { echo "FAIL: recipient cannot accept: $r"; blocked=1; }

r=$(run_as "bob-session-token" "UPDATE public.projects SET name='hacked' WHERE id=1 RETURNING id;" 2>&1)
echo "$r" | grep -qE '^[0-9]+$' && { echo "FAIL: Bob modified Alice's private project"; blocked=1; } || echo "PASS: Bob cannot modify Alice's private project"

echo "== 7b. PROOF: task deletion via FK cascades (run 15 rehearsal finding) =="
# Postgres filters DELETE targets through the table's SELECT policies, so
# client-side cleanup of other users' rows is impossible under scoped RLS
# (a manager DELETE policy admits but reaches 0 hidden rows — proven live on
# a disposable PG15 in run 15). 004 therefore puts ON DELETE CASCADE on all
# four child FKs of tasks. Proofs here:
#   (1) a signed-in NON-member (Carol) cannot delete the task — an RLS-denied
#       DELETE is NOT an error, it affects 0 rows, so assert survival;
#   (2) the owner's single task DELETE removes EVERY participant's
#       status/completion/notification rows (cascade), no FK violation.
psql_admin <<'SQL'
INSERT INTO public.tasks (id, project_id, creator_id, title, type, due_date) VALUES
  (4, 2, 1, 'FK-trap rehearsal task', 'one_off', now() + interval '1 day');
INSERT INTO public.task_statuses (task_id, user_id, status) VALUES
  (4, 1, 'active'), (4, 2, 'active');
INSERT INTO public.completion_logs (user_id, task_id, xp_earned) VALUES
  (1, 4, 3), (2, 4, 5);
INSERT INTO public.notifications (user_id, type, message, task_id) VALUES
  (2, 'task_created', 'fk trap rehearsal', 4);
-- Dave: signed in, NO membership anywhere (Bob self-joined and Carol was
-- added by the owner in section 6, so both are members here by design —
-- tasks_delete_member lets members delete, matching the client today).
INSERT INTO public.users (id, name, handle, email, avatar, timezone) VALUES
  (4, 'Dave Rehearsal', '@dave', 'dave@rehearsal.test', '', 'UTC');
SELECT setval('public.users_id_seq', 4);
INSERT INTO public.user_stats (user_id) VALUES (4);
INSERT INTO public.sessions (user_id, token, expires_at) VALUES
  (4, 'dave-session-token', now() + interval '1 day');
SQL
echo "PASS: seeded task 4 (Alice owner; Bob holds status + completion + notification)"

# (1) Dave is signed in but has NO membership: his DELETE must leave the task
#     and every child row untouched (RLS denial = 0 rows, not an error). On a
#     public project he can SEE the task — visible != deleteable.
r=$(run_as "dave-session-token" "DELETE FROM public.tasks WHERE id = 4;" 2>&1)
echo "$r" | grep -q "ERROR" && { echo "FAIL: non-member DELETE errored (expected a silent 0-row denial): $r"; blocked=1; }
n=$(run_as "dave-session-token" "SELECT count(*) FROM public.tasks WHERE id = 4;")
[ "$n" = "1" ] && echo "PASS: non-member can see the public task" || { echo "FAIL: non-member cannot see the public task"; blocked=1; }
n=$(psql_admin -tAc "SELECT count(*) FROM public.tasks WHERE id = 4;")
[ "$n" = "1" ] && echo "PASS: non-member DELETE left the task in place" || { echo "FAIL: non-member deleted a task"; blocked=1; }
n=$(psql_admin -tAc "SELECT count(*) FROM public.task_statuses WHERE task_id = 4;")
[ "$n" = "2" ] && echo "PASS: non-member DELETE touched none of the children" || { echo "FAIL: children changed by a non-member delete"; blocked=1; }

# (2) The owner deletes the task with ONE statement; the cascade removes
#     Bob's rows too (which client-side cleanup cannot reach).
r=$(run_as "alice-session-token" "DELETE FROM public.tasks WHERE id = 4;" 2>&1)
echo "$r" | grep -q "ERROR" && { echo "FAIL: owner task delete errored: $r"; blocked=1; } || echo "PASS: owner deletes the task (single statement, no FK violation)"

n=$(psql_admin -tAc "SELECT count(*) FROM public.tasks WHERE id = 4;")
[ "$n" = "0" ] && echo "PASS: task 4 fully removed" || { echo "FAIL: task 4 still present"; blocked=1; }
n=$(psql_admin -tAc "SELECT count(*) FROM public.task_statuses WHERE task_id = 4;")
[ "$n" = "0" ] && echo "PASS: cascade removed BOTH users' task-status rows" || { echo "FAIL: $n status rows survived the delete"; blocked=1; }
n=$(psql_admin -tAc "SELECT count(*) FROM public.completion_logs WHERE task_id = 4;")
[ "$n" = "0" ] && echo "PASS: cascade removed BOTH users' completion logs (Bob's were invisible to Alice)" || { echo "FAIL: $n completion logs survived"; blocked=1; }
n=$(psql_admin -tAc "SELECT count(*) FROM public.notifications WHERE task_id = 4;")
[ "$n" = "0" ] && echo "PASS: cascade removed the recipient's notification" || { echo "FAIL: $n notifications survived"; blocked=1; }

echo "== 8. Rollback restores Allow-all, then 004 re-applies =="
psql_admin < "$MIG/004_rollback_rls.sql" || { echo "FAIL: rollback script errored"; blocked=1; }
n=$(run_as "" "SELECT count(*) FROM public.tasks;")
[ "$n" = "2" ] && echo "PASS: rollback restores unsigned full visibility (Allow-all era)" || { echo "FAIL: rollback state wrong ($n tasks)"; blocked=1; }
r=$(run_as "" "TRUNCATE public.magic_links;" 2>&1)
echo "$r" | grep -q "ERROR" && { echo "FAIL: rollback TRUNCATE state wrong: $r"; blocked=1; } || echo "PASS: rollback restores anon TRUNCATE (001-era parity)"

psql_admin < "$MIG/004_rls_scoped_policies.sql" || { echo "FAIL: re-apply 004"; blocked=1; }
n=$(run_as "" "SELECT count(*) FROM public.tasks;")
[ "$n" = "1" ] && echo "PASS: 004 re-applied cleanly — scoped again (public task only)" || { echo "FAIL: re-apply broken ($n tasks for unsigned, want 1)"; blocked=1; }
n=$(psql_admin -tAc "SELECT count(*) FROM pg_policies WHERE schemaname='public' AND policyname LIKE 'Allow all%';")
[ "$n" = "0" ] && echo "PASS: no Allow-all policies remain after re-apply" || { echo "FAIL: $n Allow-all policies remain"; blocked=1; }

echo "== 9. Policy inventory (post re-apply) =="
psql_admin -c "SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname;"

echo
if [ "$blocked" = "0" ]; then
  echo "REHEARSAL RESULT: ALL PROOFS PASS"
  exit 0
else
  echo "REHEARSAL RESULT: FAILURES PRESENT (see above)"
  exit 1
fi
