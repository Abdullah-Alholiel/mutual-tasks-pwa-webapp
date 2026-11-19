-- ============================================================================
-- 004_rollback_rls.sql — restore the run-4 (001_full_schema.sql) Allow-all state
-- ============================================================================
-- Use ONLY if 004_rls_scoped_policies.sql must be undone (owner instruction or
-- rehearsal failure). This recreates exactly what the run-4 audit documented:
-- Allow-all FOR ALL policies for anon/authenticated/service_role on all 13
-- tables (USING(true) WITH CHECK(true)) — i.e. the KNOWN-INSECURE state.
-- It also re-grants anon full DML + TRUNCATE to match that state bit-for-bit.
--
-- Idempotent: safe to run multiple times. Drops EVERY policy on the 13 tables
-- (scoped ones included) before recreating Allow-all, so 004 can be re-applied
-- afterwards without "policy already exists" failures.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  t text;
  pol_name text;
BEGIN
  -- 1. Drop EVERY existing policy on the 13 tables (scoped or Allow-all)
  FOREACH t IN ARRAY ARRAY[
    'users','user_stats','projects','project_participants','tasks',
    'task_statuses','completion_logs','notifications','task_recurrence',
    'magic_links','sessions','friends','ai_usage_logs'
  ] LOOP
    FOR pol_name IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol_name, t);
    END LOOP;
  END LOOP;

  -- 2. Undo 004's privilege changes so the state matches 001 bit-for-bit:
  --    re-grant the sessions/magic_links DML 004 revoked (001-era parity).
  EXECUTE 'GRANT INSERT, UPDATE, DELETE ON public.sessions TO anon';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.magic_links TO anon';

  -- 2b. Undo the D-053 (run 17) column/privilege lockdowns, restoring the
  --     pre-004 state verbatim: anon full-table UPDATE on users (001 granted
  --     full DML on all tables) and anon INSERT/UPDATE/DELETE on ai_usage_logs
  --     (run-15-era 004 kept the 001 grants — its own-row policies relied on
  --     them). GRANTs are additive/idempotent, so this exactly reproduces the
  --     insecure state this rollback exists to reproduce.
  EXECUTE 'GRANT UPDATE ON public.users TO anon';
  EXECUTE 'GRANT INSERT, UPDATE, DELETE ON public.ai_usage_logs TO anon';

  -- 2c. Undo 004's FK cascades (run 15): recreate 001's constraint
  --     definitions with NO ON DELETE action.
  EXECUTE 'ALTER TABLE public.task_statuses DROP CONSTRAINT task_statuses_task_id_fkey';
  EXECUTE 'ALTER TABLE public.task_statuses ADD CONSTRAINT task_statuses_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id)';
  EXECUTE 'ALTER TABLE public.completion_logs DROP CONSTRAINT completion_logs_task_id_fkey';
  EXECUTE 'ALTER TABLE public.completion_logs ADD CONSTRAINT completion_logs_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id)';
  EXECUTE 'ALTER TABLE public.notifications DROP CONSTRAINT notifications_task_id_fkey';
  EXECUTE 'ALTER TABLE public.notifications ADD CONSTRAINT notifications_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id)';
  EXECUTE 'ALTER TABLE public.task_recurrence DROP CONSTRAINT task_recurrence_task_id_fkey';
  EXECUTE 'ALTER TABLE public.task_recurrence ADD CONSTRAINT task_recurrence_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id)';

  -- 3. Recreate the Allow-all policies (001-era state, insecure by design)
  FOREACH t IN ARRAY ARRAY[
    'users','user_stats','projects','project_participants','tasks',
    'task_statuses','completion_logs','notifications','task_recurrence',
    'magic_links','sessions','friends','ai_usage_logs'
  ] LOOP
    pol_name := 'Allow all for anon on ' || t;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true)', pol_name, t);

    pol_name := 'Allow all for authenticated on ' || t;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', pol_name, t);

    pol_name := 'Allow all for service_role on ' || t;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', pol_name, t);
  END LOOP;

  -- 4. Restore the anon TRUNCATE grants of the Allow-all era (insecure by
  --    design; this file exists to reproduce 001's state exactly).
  FOREACH t IN ARRAY ARRAY[
    'users','user_stats','projects','project_participants','tasks',
    'task_statuses','completion_logs','notifications','task_recurrence',
    'magic_links','sessions','friends','ai_usage_logs'
  ] LOOP
    EXECUTE format('GRANT TRUNCATE ON public.%I TO anon', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
