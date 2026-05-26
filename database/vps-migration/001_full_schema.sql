-- ============================================================
-- VPS Deploy: Full Supabase Schema Migration
-- For self-hosted Supabase on Coolify VPS
-- ============================================================
-- Run this AFTER the base Supabase stack is initialized.
-- Connect as: psql -U supabase_admin -d postgres
-- ============================================================

-- ============================================================
-- 1. ENUM TYPES
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_role') THEN
    CREATE TYPE project_role AS ENUM ('owner', 'manager', 'participant');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_type') THEN
    CREATE TYPE task_type AS ENUM ('one_off', 'habit');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE task_status AS ENUM ('active', 'upcoming', 'completed', 'archived', 'recovered');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recurrence_pattern') THEN
    CREATE TYPE recurrence_pattern AS ENUM ('Daily', 'weekly', 'custom');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ring_color') THEN
    CREATE TYPE ring_color AS ENUM ('green', 'yellow', 'red', 'none');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE notification_type AS ENUM (
      'task_created', 'task_completed', 'task_recovered', 'task_deleted',
      'task_overdue', 'role_changed', 'project_joined', 'streak_reminder',
      'friend_request', 'friend_accepted', 'project_updated', 'project_created',
      'project_deleted', 'task_updated'
    );
  END IF;
END $$;

-- ============================================================
-- 2. TABLES
-- ============================================================

-- Users
CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  name text NOT NULL,
  handle text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  avatar text NOT NULL,
  timezone text NOT NULL,
  notification_preferences jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- User stats
CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id integer PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  total_completed_tasks integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  totalscore integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Projects
CREATE TABLE IF NOT EXISTS public.projects (
  id SERIAL PRIMARY KEY,
  name text NOT NULL,
  description text,
  icon text,
  color text,
  owner_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_public boolean NOT NULL DEFAULT false,
  total_tasks integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Project participants
CREATE TABLE IF NOT EXISTS public.project_participants (
  project_id integer NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role project_role NOT NULL DEFAULT 'participant',
  added_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  PRIMARY KEY (project_id, user_id)
);

-- Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id SERIAL PRIMARY KEY,
  project_id integer NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  creator_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type task_type NOT NULL,
  recurrence_pattern recurrence_pattern,
  recurrence_index integer,
  recurrence_total integer,
  show_recurrence_index boolean DEFAULT false,
  due_date timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Task statuses (includes completed_at from migration 001)
CREATE TABLE IF NOT EXISTS public.task_statuses (
  id SERIAL PRIMARY KEY,
  task_id integer NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status task_status NOT NULL DEFAULT 'active',
  archived_at timestamptz,
  recovered_at timestamptz,
  ring_color ring_color,
  completed_at timestamptz,
  UNIQUE(task_id, user_id)
);

-- Completion logs
CREATE TABLE IF NOT EXISTS public.completion_logs (
  id SERIAL PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id integer NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  difficulty_rating smallint CHECK (difficulty_rating IS NULL OR (difficulty_rating >= 1 AND difficulty_rating <= 5)),
  penalty_applied boolean NOT NULL DEFAULT false,
  xp_earned integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id SERIAL PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  message text NOT NULL,
  task_id integer REFERENCES public.tasks(id) ON DELETE SET NULL,
  project_id integer REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_read boolean NOT NULL DEFAULT false,
  email_sent boolean NOT NULL DEFAULT false
);

-- Task recurrence
CREATE TABLE IF NOT EXISTS public.task_recurrence (
  id SERIAL PRIMARY KEY,
  task_id integer NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  recurrence_pattern recurrence_pattern NOT NULL,
  recurrence_interval integer NOT NULL,
  next_occurrence timestamptz NOT NULL,
  end_of_recurrence timestamptz,
  UNIQUE(task_id)
);

-- Magic links (for email-based auth)
CREATE TABLE IF NOT EXISTS public.magic_links (
  id SERIAL PRIMARY KEY,
  token text NOT NULL UNIQUE,
  user_id integer REFERENCES public.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  is_signup boolean NOT NULL DEFAULT false,
  signup_name text,
  signup_handle text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Sessions
CREATE TABLE IF NOT EXISTS public.sessions (
  id SERIAL PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz NOT NULL DEFAULT now()
);

-- Friends (MISSING from original migrations - added for VPS)
CREATE TABLE IF NOT EXISTS public.friends (
  id SERIAL PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  friend_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

-- AI usage logs (MISSING from original migrations - added for VPS)
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id SERIAL PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  usage_type text NOT NULL CHECK (usage_type IN ('project_generation', 'description_generation')),
  usage_date text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, usage_type, usage_date)
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_project_participants_role ON public.project_participants(project_id, role);
CREATE INDEX IF NOT EXISTS idx_project_participants_user ON public.project_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_creator ON public.tasks(creator_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_task_statuses_user_status ON public.task_statuses(user_id, status);
CREATE INDEX IF NOT EXISTS idx_task_statuses_task ON public.task_statuses(task_id);
CREATE INDEX IF NOT EXISTS idx_task_statuses_user ON public.task_statuses(user_id);
CREATE INDEX IF NOT EXISTS idx_task_statuses_completed_at ON public.task_statuses(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_completion_logs_user ON public.completion_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_completion_logs_task ON public.completion_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_completion_logs_created ON public.completion_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON public.notifications(user_id, is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_task_recurrence_task ON public.task_recurrence(task_id);
CREATE INDEX IF NOT EXISTS idx_task_recurrence_next_occurrence ON public.task_recurrence(next_occurrence);
CREATE INDEX IF NOT EXISTS idx_magic_links_token ON public.magic_links(token);
CREATE INDEX IF NOT EXISTS idx_magic_links_email ON public.magic_links(email);
CREATE INDEX IF NOT EXISTS idx_magic_links_expires ON public.magic_links(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON public.sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_friends_user ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend ON public.friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_date ON public.ai_usage_logs(user_id, usage_type, usage_date);

-- ============================================================
-- 4. FUNCTIONS AND TRIGGERS
-- ============================================================

-- Trigger: auto-update project task count
CREATE OR REPLACE FUNCTION public.update_project_task_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.projects SET total_tasks = total_tasks + 1 WHERE id = NEW.project_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.projects SET total_tasks = GREATEST(total_tasks - 1, 0) WHERE id = OLD.project_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS task_count_trigger ON public.tasks;
CREATE TRIGGER task_count_trigger
  AFTER INSERT OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_project_task_count();

-- Function: create task with statuses for all participants
CREATE OR REPLACE FUNCTION public.create_task_with_statuses(
  p_project_id integer,
  p_creator_id integer,
  p_title text,
  p_description text,
  p_type task_type,
  p_recurrence_pattern recurrence_pattern,
  p_due_date timestamptz
)
RETURNS integer AS $$
DECLARE
  v_task_id integer;
  v_participant record;
BEGIN
  INSERT INTO public.tasks (project_id, creator_id, title, description, type, recurrence_pattern, due_date)
  VALUES (p_project_id, p_creator_id, p_title, p_description, p_type, p_recurrence_pattern, p_due_date)
  RETURNING id INTO v_task_id;

  FOR v_participant IN
    SELECT user_id FROM public.project_participants
    WHERE project_id = p_project_id
      AND (removed_at IS NULL OR removed_at > now())
  LOOP
    INSERT INTO public.task_statuses (task_id, user_id, status)
    VALUES (v_task_id, v_participant.user_id, 'active')
    ON CONFLICT (task_id, user_id) DO NOTHING;
  END LOOP;

  RETURN v_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: delete task completely
CREATE OR REPLACE FUNCTION public.delete_task_completely(p_task_id integer)
RETURNS void AS $$
BEGIN
  DELETE FROM public.tasks WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. REALTIME PUBLICATION
-- ============================================================

-- Add tables to realtime publication for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_statuses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friends;

-- ============================================================
-- 6. RLS (Row Level Security) - Enable but allow all for now
--   (Self-hosted single-tenant; tighten for multi-tenant later)
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.completion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_recurrence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.magic_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Permissive policies for anon and authenticated roles
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('CREATE POLICY "Allow all for anon on %I" ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "Allow all for authenticated on %I" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "Allow all for service_role on %I" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;

-- ============================================================
-- DONE. Verify with:
--   \dt public.*
--   \df public.*
-- ============================================================
