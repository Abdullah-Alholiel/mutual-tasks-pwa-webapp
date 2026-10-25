-- ============================================================
-- Momentum: Premium subscription support (manual billing era)
-- 2026-10-25 — self-hosted Supabase on VPS
-- ============================================================

-- Premium flag on users (manual activation by admin for now)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS premium_since timestamptz;
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS premium_note text; -- free-text: who activated, why (audit trail)

-- Index for admin queries
CREATE INDEX IF NOT EXISTS idx_users_is_premium ON public.users (is_premium) WHERE is_premium;

-- Grant visibility to anon/authenticated (own row) via existing permit-all policies
GRANT SELECT (id, is_premium, premium_since) ON public.users TO anon, authenticated;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
