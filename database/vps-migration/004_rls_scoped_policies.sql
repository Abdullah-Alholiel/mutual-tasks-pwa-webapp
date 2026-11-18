-- ============================================================================
-- 004_rls_scoped_policies.sql — L5: replace Allow-all RLS with scoped policies
-- ============================================================================
-- Owner decision D-018 (2026-11-13, option a): the app's custom session model
-- rides the anon key, so anon policies ARE the access control. Functions use
-- service_role (bypasses RLS) and are unaffected.
--
-- MECHANISM
--   The browser sends its session token on every REST call via the header
--   `x-momentum-session` (client change in the same PR, src/lib/supabaseClient.ts
--   globalHeaders). PostgREST exposes request headers to policies through the
--   `request.headers` GUC (jsonb, header names lowercased). app_current_user_id()
--   resolves the token to a user id; policies compare that id to the row.
--
--   SECURITY DEFINER on every helper is REQUIRED for correctness, not only
--   convenience: projects (owner_id) and project_participants (user_id) reference
--   each other; plain invoker policies on either table would recurse through the
--   other (PostgREST surfaces that as infinite-recursion 500s). Definer helpers
--   also make the role checks (owner/manager) readable from participants without
--   granting anon extra rights. search_path pinned on all of them.
--
--   Permission model verified against the app source (run 13):
--     * add/remove member + task edit/delete: UI-gated to project owner or
--       manager -> enforced here via is_project_manager().
--     * join public project: the joiner inserts THEIR OWN participant row ->
--       allowed when user_id = caller AND the project is_public.
--     * add members / remove member flows insert or delete task_statuses FOR
--       OTHER users (caller = owner/manager) -> status INSERT/DELETE allow the
--       project owner/manager for rows in that project's tasks.
--     * completion status rows are always the user's own -> UPDATE own-only.
--     * notifications are written by the ACTING user's client on behalf of
--       others (friend request, project joined, task events) -> INSERT allowed
--       to any signed-in caller; SELECT/UPDATE/DELETE strictly own rows.
--       (Spam potential is inherent to the client-driven design; unchanged.)
--     * sign-up (users + first user_stats row) and all session lifecycle
--       happen inside auth-magic-link with service_role -> no anon INSERT on
--       users; sessions get SELECT-only (token resolution probes).
--     * magic_links: never touched client-side -> NO anon access at all.
--
-- REALTIME IMPACT (disclosed to the owner in the run report — NOT silently
-- shipped): Realtime evaluates policies per subscriber WITHOUT request headers,
-- so header-scoped policies stop live postgres_changes delivery entirely. The
-- app stays usable (optimistic updates + refetch-on-focus), but live
-- cross-client updates need a follow-up (Realtime authorized-subscriber token
-- or a signed-claims design) — owner decision after rehearsal.
--
-- TRUNCATE is a table privilege, NOT covered by policies: explicit REVOKE.
-- The run-4 audit found anon could TRUNCATE every table (Allow-all era);
-- 001 never revoked the distribution default.
--
-- ROLLBACK: 004_rollback_rls.sql restores the run-4 Allow-all state verbatim.
--
-- APPLY (rehearsal copy only; PRODUCTION = OWNER-ONLY, separate go):
--   psql ... -f 004_rls_scoped_policies.sql   (single transaction + NOTIFY)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. Drop every Allow-all policy from 001 (by name, idempotent)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','user_stats','projects','project_participants','tasks',
    'task_statuses','completion_logs','notifications','task_recurrence',
    'magic_links','sessions','friends','ai_usage_logs'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
      'Allow all for anon on ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
      'Allow all for authenticated on ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
      'Allow all for service_role on ' || t, t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 1. Helper functions (all SECURITY DEFINER, search_path pinned)
-- ----------------------------------------------------------------------------

-- Resolve the app session token (request header x-momentum-session) to a user
-- id. NULL when the header is absent or the token is unknown/expired. A token
-- is a long random value — guessing one is not a practical attack — and every
-- policy still requires the id to match the row.
CREATE OR REPLACE FUNCTION public.app_current_user_id()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.user_id
  FROM public.sessions s
  CROSS JOIN (
    SELECT current_setting('request.headers', true)::jsonb -> 'x-momentum-session' AS val
  ) h
  WHERE s.token = coalesce(
          CASE
            -- PostgREST sets request.headers to a jsonb object keyed by
            -- lowercased header names; values are strings (array form kept
            -- as a defensive fallback for version drift).
            WHEN jsonb_typeof(h.val) = 'array' THEN h.val ->> 0
            ELSE h.val #>> '{}'
          END,
          ''
        )
    AND s.expires_at > now()
  LIMIT 1;
$$;

-- Caller is the project's owner (users.owner_id column).
CREATE OR REPLACE FUNCTION public.is_project_owner(p_project_id integer)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_project_id
      AND p.owner_id = public.app_current_user_id()
  );
$$;

-- Caller holds an ACTIVE participant row with one of the given roles.
CREATE OR REPLACE FUNCTION public.has_project_role(
  p_project_id integer,
  p_roles project_role[]
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_participants pp
    WHERE pp.project_id = p_project_id
      AND pp.user_id = public.app_current_user_id()
      AND pp.removed_at IS NULL
      AND pp.role = ANY (p_roles::project_role[])
  );
$$;

-- Caller is owner OR an active owner/manager participant (the UI's
-- "can manage" gate: add/remove members, task edit/delete).
CREATE OR REPLACE FUNCTION public.is_project_manager(p_project_id integer)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_project_owner(p_project_id)
      OR public.has_project_role(p_project_id, ARRAY['owner','manager']::project_role[]);
$$;

-- Caller is owner OR an active participant of any role.
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id integer)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_project_owner(p_project_id)
      OR public.has_project_role(p_project_id, ARRAY['owner','manager','participant']::project_role[]);
$$;

-- Read visibility: member, or the project is public.
CREATE OR REPLACE FUNCTION public.can_view_project(p_project_id integer)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_project_member(p_project_id)
      OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = p_project_id AND p.is_public
      );
$$;

-- ----------------------------------------------------------------------------
-- 2. sessions — anon may ONLY read a session row matching its own token
--    (client-side session probes, src/lib/auth/auth.ts findByToken). Sessions
--    are created/extended/deleted by auth-magic-link with service_role only.
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.sessions FROM anon;
GRANT SELECT ON public.sessions TO anon;

CREATE POLICY sessions_select_own ON public.sessions
  FOR SELECT TO anon
  USING (user_id = public.app_current_user_id());

-- ----------------------------------------------------------------------------
-- 3. magic_links — NO anon access at all (verify path = function, service_role)
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.magic_links FROM anon;

-- ----------------------------------------------------------------------------
-- 4. users — signed-in directory: profile lookups by handle/email (friend
--    search, member add) need all rows; writes scoped to self. No anon INSERT
--    (sign-up runs in the function with service_role; sequence ids are not
--    client-assignable anyway).
-- ----------------------------------------------------------------------------
CREATE POLICY users_select_signed_in ON public.users
  FOR SELECT TO anon
  USING (public.app_current_user_id() IS NOT NULL);

CREATE POLICY users_update_self ON public.users
  FOR UPDATE TO anon
  USING (id = public.app_current_user_id())
  WITH CHECK (id = public.app_current_user_id());

CREATE POLICY users_delete_self ON public.users
  FOR DELETE TO anon
  USING (id = public.app_current_user_id());

-- ----------------------------------------------------------------------------
-- 5. user_stats — friends' public stat cards read all rows (signed-in);
--    writes scoped to self (created with the account by the function).
-- ----------------------------------------------------------------------------
CREATE POLICY user_stats_select_signed_in ON public.user_stats
  FOR SELECT TO anon
  USING (public.app_current_user_id() IS NOT NULL);

CREATE POLICY user_stats_insert_self ON public.user_stats
  FOR INSERT TO anon
  WITH CHECK (user_id = public.app_current_user_id());

CREATE POLICY user_stats_update_self ON public.user_stats
  FOR UPDATE TO anon
  USING (user_id = public.app_current_user_id())
  WITH CHECK (user_id = public.app_current_user_id());

CREATE POLICY user_stats_delete_self ON public.user_stats
  FOR DELETE TO anon
  USING (user_id = public.app_current_user_id());

-- ----------------------------------------------------------------------------
-- 6. projects — read: member or public; write: owner only
-- ----------------------------------------------------------------------------
CREATE POLICY projects_select_member_or_public ON public.projects
  FOR SELECT TO anon
  USING (public.can_view_project(id));

CREATE POLICY projects_insert_own ON public.projects
  FOR INSERT TO anon
  WITH CHECK (owner_id = public.app_current_user_id());

CREATE POLICY projects_update_own ON public.projects
  FOR UPDATE TO anon
  USING (public.is_project_owner(id))
  WITH CHECK (public.is_project_owner(id));

CREATE POLICY projects_delete_own ON public.projects
  FOR DELETE TO anon
  USING (public.is_project_owner(id));

-- ----------------------------------------------------------------------------
-- 7. project_participants — members (and public-project viewers) read roles;
--    INSERT: self-join on a public project, or owner/manager adding members;
--    UPDATE (role changes): owner/manager; DELETE: own row (leave) or
--    owner/manager (removal).
-- ----------------------------------------------------------------------------
CREATE POLICY participants_select_viewer ON public.project_participants
  FOR SELECT TO anon
  USING (
    user_id = public.app_current_user_id()
    OR public.can_view_project(project_id)
  );

CREATE POLICY participants_insert_join_or_manager ON public.project_participants
  FOR INSERT TO anon
  WITH CHECK (
    (
      user_id = public.app_current_user_id()
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_id AND p.is_public
      )
    )
    OR public.is_project_manager(project_id)
  );

CREATE POLICY participants_update_manager ON public.project_participants
  FOR UPDATE TO anon
  USING (public.is_project_manager(project_id))
  WITH CHECK (public.is_project_manager(project_id));

CREATE POLICY participants_delete_self_or_manager ON public.project_participants
  FOR DELETE TO anon
  USING (
    user_id = public.app_current_user_id()
    OR public.is_project_manager(project_id)
  );

-- ----------------------------------------------------------------------------
-- 8. tasks — read: project visibility; write: project members
--    (owner/manager UI gate stays client-side for now — matching today's
--    behaviour; tightening writes to managers is a follow-up hardening.)
-- ----------------------------------------------------------------------------
CREATE POLICY tasks_select_viewer ON public.tasks
  FOR SELECT TO anon
  USING (public.can_view_project(project_id));

CREATE POLICY tasks_insert_member ON public.tasks
  FOR INSERT TO anon
  WITH CHECK (public.is_project_member(project_id));

CREATE POLICY tasks_update_member ON public.tasks
  FOR UPDATE TO anon
  USING (public.is_project_member(project_id))
  WITH CHECK (public.is_project_member(project_id));

CREATE POLICY tasks_delete_member ON public.tasks
  FOR DELETE TO anon
  USING (public.is_project_member(project_id));

-- ----------------------------------------------------------------------------
-- 9. task_statuses — read: own rows + project visibility (member info, rings);
--    INSERT: own row, or owner/manager creating rows for members (add-member
--    and join flows); UPDATE: strictly own (completions are personal);
--    DELETE: own, or owner/manager clearing a removed member's rows.
-- ----------------------------------------------------------------------------
CREATE POLICY statuses_select_viewer ON public.task_statuses
  FOR SELECT TO anon
  USING (
    user_id = public.app_current_user_id()
    OR public.can_view_project(
         (SELECT t.project_id FROM public.tasks t WHERE t.id = task_id)
       )
  );

CREATE POLICY statuses_insert_own_or_manager ON public.task_statuses
  FOR INSERT TO anon
  WITH CHECK (
    user_id = public.app_current_user_id()
    OR public.is_project_manager(
         (SELECT t.project_id FROM public.tasks t WHERE t.id = task_id)
       )
  );

CREATE POLICY statuses_update_own ON public.task_statuses
  FOR UPDATE TO anon
  USING (user_id = public.app_current_user_id())
  WITH CHECK (user_id = public.app_current_user_id());

CREATE POLICY statuses_delete_own_or_manager ON public.task_statuses
  FOR DELETE TO anon
  USING (
    user_id = public.app_current_user_id()
    OR public.is_project_manager(
         (SELECT t.project_id FROM public.tasks t WHERE t.id = task_id)
       )
  );

-- ----------------------------------------------------------------------------
-- 10. completion_logs — strictly own rows (the XP ledger)
-- ----------------------------------------------------------------------------
CREATE POLICY completion_logs_select_own ON public.completion_logs
  FOR SELECT TO anon
  USING (user_id = public.app_current_user_id());

CREATE POLICY completion_logs_insert_own ON public.completion_logs
  FOR INSERT TO anon
  WITH CHECK (user_id = public.app_current_user_id());

CREATE POLICY completion_logs_update_own ON public.completion_logs
  FOR UPDATE TO anon
  USING (user_id = public.app_current_user_id())
  WITH CHECK (user_id = public.app_current_user_id());

CREATE POLICY completion_logs_delete_own ON public.completion_logs
  FOR DELETE TO anon
  USING (user_id = public.app_current_user_id());

-- ----------------------------------------------------------------------------
-- 11. notifications — own rows for read/update/delete; INSERT by any
--     signed-in caller (client-driven notifications on behalf of others —
--     friend requests, project-joined, task events).
-- ----------------------------------------------------------------------------
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO anon
  USING (user_id = public.app_current_user_id());

CREATE POLICY notifications_insert_signed_in ON public.notifications
  FOR INSERT TO anon
  WITH CHECK (public.app_current_user_id() IS NOT NULL);

CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO anon
  USING (user_id = public.app_current_user_id())
  WITH CHECK (user_id = public.app_current_user_id());

CREATE POLICY notifications_delete_own ON public.notifications
  FOR DELETE TO anon
  USING (user_id = public.app_current_user_id());

-- ----------------------------------------------------------------------------
-- 12. task_recurrence — follows the parent task's project visibility/membership
-- ----------------------------------------------------------------------------
CREATE POLICY recurrence_select_viewer ON public.task_recurrence
  FOR SELECT TO anon
  USING (
    public.can_view_project(
      (SELECT t.project_id FROM public.tasks t WHERE t.id = task_id)
    )
  );

CREATE POLICY recurrence_insert_member ON public.task_recurrence
  FOR INSERT TO anon
  WITH CHECK (
    public.is_project_member(
      (SELECT t.project_id FROM public.tasks t WHERE t.id = task_id)
    )
  );

CREATE POLICY recurrence_update_member ON public.task_recurrence
  FOR UPDATE TO anon
  USING (
    public.is_project_member(
      (SELECT t.project_id FROM public.tasks t WHERE t.id = task_id)
    )
  )
  WITH CHECK (
    public.is_project_member(
      (SELECT t.project_id FROM public.tasks t WHERE t.id = task_id)
    )
  );

CREATE POLICY recurrence_delete_member ON public.task_recurrence
  FOR DELETE TO anon
  USING (
    public.is_project_member(
      (SELECT t.project_id FROM public.tasks t WHERE t.id = task_id)
    )
  );

-- ----------------------------------------------------------------------------
-- 13. friends — see/accept own edges (either direction); insert own outgoing;
--     delete either own edge (unfriend deletes both directions).
-- ----------------------------------------------------------------------------
CREATE POLICY friends_select_own_edge ON public.friends
  FOR SELECT TO anon
  USING (
    user_id = public.app_current_user_id()
    OR friend_id = public.app_current_user_id()
  );

CREATE POLICY friends_insert_own_edge ON public.friends
  FOR INSERT TO anon
  WITH CHECK (user_id = public.app_current_user_id());

CREATE POLICY friends_update_either ON public.friends
  FOR UPDATE TO anon
  USING (
    user_id = public.app_current_user_id()
    OR friend_id = public.app_current_user_id()
  )
  WITH CHECK (
    user_id = public.app_current_user_id()
    OR friend_id = public.app_current_user_id()
  );

CREATE POLICY friends_delete_either ON public.friends
  FOR DELETE TO anon
  USING (
    user_id = public.app_current_user_id()
    OR friend_id = public.app_current_user_id()
  );

-- ----------------------------------------------------------------------------
-- 14. ai_usage_logs — own rows (client reads + legacy increment path); the
--     atomic consume_ai_usage() RPC (003) is SECURITY DEFINER, bypasses RLS.
-- ----------------------------------------------------------------------------
CREATE POLICY ai_usage_select_own ON public.ai_usage_logs
  FOR SELECT TO anon
  USING (user_id = public.app_current_user_id());

CREATE POLICY ai_usage_insert_own ON public.ai_usage_logs
  FOR INSERT TO anon
  WITH CHECK (user_id = public.app_current_user_id());

CREATE POLICY ai_usage_update_own ON public.ai_usage_logs
  FOR UPDATE TO anon
  USING (user_id = public.app_current_user_id())
  WITH CHECK (user_id = public.app_current_user_id());

CREATE POLICY ai_usage_delete_own ON public.ai_usage_logs
  FOR DELETE TO anon
  USING (user_id = public.app_current_user_id());

-- ----------------------------------------------------------------------------
-- 15. Sequence usage (Supabase's default privileges grant anon/authenticated
--     USAGE on sequences; 001's explicit grants do not — INSERTs with serial
--     defaults would fail on "permission denied for sequence" even when the
--     row policy allows them. Harmless: policy checks still gate every row.)
-- ----------------------------------------------------------------------------
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ============================================================================
-- 15b. FK CASCADES FOR TASK DELETION (run 15, rehearsal finding)
--   All four child FKs on tasks (001) have NO ON DELETE action, and the
--   app's delete flow removes child rows first. Rehearsal proof (disposable
--   PG15, exact schema): Postgres filters DELETE targets through the table's
--   SELECT policies — a manager-scoped DELETE policy on completion_logs/
--   notifications can NEVER reach rows hidden by their own-only SELECT
--   policies (the DELETE admits, affects 0 foreign rows, and the task delete
--   then dies on the FK). Client-side cleanup of other users' rows is
--   therefore impossible under scoped RLS; the cascade is the only mechanism
--   that preserves the product flow (owner/manager deletes a task, ALL
--   participants' statuses/logs/notifications for it go with it).
--   Client counterpart in the same PR: deletes key on task_id with explicit
--   error checks; cascade-covered rows are removed by the task DELETE itself.
--   Rollback drops the cascading constraints and recreates 001's originals.
-- ----------------------------------------------------------------------------
ALTER TABLE public.task_statuses
  DROP CONSTRAINT task_statuses_task_id_fkey,
  ADD CONSTRAINT task_statuses_task_id_fkey
    FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

ALTER TABLE public.completion_logs
  DROP CONSTRAINT completion_logs_task_id_fkey,
  ADD CONSTRAINT completion_logs_task_id_fkey
    FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

ALTER TABLE public.notifications
  DROP CONSTRAINT notifications_task_id_fkey,
  ADD CONSTRAINT notifications_task_id_fkey
    FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

ALTER TABLE public.task_recurrence
  DROP CONSTRAINT task_recurrence_task_id_fkey,
  ADD CONSTRAINT task_recurrence_task_id_fkey
    FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- 16. TRUNCATE is a table privilege, NOT covered by RLS policies
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','user_stats','projects','project_participants','tasks',
    'task_statuses','completion_logs','notifications','task_recurrence',
    'magic_links','sessions','friends','ai_usage_logs'
  ] LOOP
    EXECUTE format('REVOKE TRUNCATE ON public.%I FROM anon', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
