-- 003_consume_ai_usage_rpc.sql — atomic AI usage consumption (P1-7 / F4)
-- Pairs with code in netlify/functions/shared/utils.ts (same release; the code
-- falls back to the legacy read-then-write path until this RPC exists).
-- OWNER GATE: applying this to the production DB is owner-approved
-- (prod DB migration = always-escalate). Safe to apply before or after the
-- code deploy; the code auto-detects the RPC and switches to the atomic path.
--
-- Requires the ai_usage_logs unique constraint (ai_usage_logs_user_type_date_unique
-- on (user_id, usage_type, usage_date)) — present since 001_full_schema.sql.

BEGIN;

CREATE OR REPLACE FUNCTION public.consume_ai_usage(
    p_user_id integer,
    p_usage_type ai_usage_type
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    INSERT INTO public.ai_usage_logs AS a (user_id, usage_type, usage_date, count)
    VALUES (p_user_id, p_usage_type, (CURRENT_DATE AT TIME ZONE 'UTC')::date, 1)
    ON CONFLICT (user_id, usage_type, usage_date)
    DO UPDATE SET count = a.count + 1, updated_at = now()
    RETURNING a.count INTO v_count;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_usage(integer, ai_usage_type) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_ai_usage(integer, ai_usage_type) FROM anon;
REVOKE ALL ON FUNCTION public.consume_ai_usage(integer, ai_usage_type) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.consume_ai_usage(integer, ai_usage_type) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
