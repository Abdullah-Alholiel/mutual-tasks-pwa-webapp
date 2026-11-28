-- 005_premium_interest.sql — G3 (D-081): interest table for the Premium
-- upgrade screen. The screen records interest with one POST /api/premium-interest
-- (session-authed, service-role insert). NO payment code — manual-billing era.
--
-- OWNER GATE: applying this to the production DB is owner-approved
-- (prod DB migration = always-escalate). The factory NEVER applies it.
-- The app degrades gracefully until it exists: the interest endpoint returns a
-- generic 500 and logs; all G3 caps work without this table (ai_usage_logs only).

BEGIN;

CREATE TABLE IF NOT EXISTS public.premium_interest (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    email text,                -- copied from users.email at write time (audit aid)
    message text,              -- optional note from the user (≤ 500 chars, app-enforced)
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_premium_interest_user ON public.premium_interest (user_id);
CREATE INDEX IF NOT EXISTS idx_premium_interest_created ON public.premium_interest (created_at);

-- RLS ON, ZERO policies: anon/authenticated get nothing through PostgREST
-- (same posture as owner-only tables). The ONLY writer is service_role
-- (netlify function), which bypasses RLS.
ALTER TABLE public.premium_interest ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

COMMIT;
