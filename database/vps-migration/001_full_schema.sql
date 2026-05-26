-- ============================================================
-- VPS Deploy: Full Supabase Schema Migration
-- Source of truth: Remote Supabase schema (2026-05-26 dump)
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

-- ai_usage_type enum (remote uses USER-DEFINED for usage_type)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_usage_type') THEN
    CREATE TYPE ai_usage_type AS ENUM ('project_generation', 'description_generation');
  END IF;
END $$;

-- ============================================================
-- 2. TABLES (exact match to remote schema)
-- ============================================================

-- Users
CREATE TABLE IF NOT EXISTS public.users (
  id integer NOT NULL DEFAULT nextval('users_id_seq'::regclass),
  name text NOT NULL,
  handle text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  avatar text NOT NULL,
  timezone text NOT NULL,
  notification_preferences jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- Create the sequence explicitly (SERIAL-style)
CREATE SEQUENCE IF NOT EXISTS public.users_id_seq OWNED BY public.users.id;
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

-- User stats
CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id integer NOT NULL,
  total_completed_tasks integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  totalscore integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_stats_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- Projects
CREATE TABLE IF NOT EXISTS public.projects (
  id integer NOT NULL DEFAULT nextval('projects_id_seq'::regclass),
  name text NOT NULL,
  description text,
  icon text,
  color text,
  owner_id integer NOT NULL,
  is_public boolean NOT NULL DEFAULT false,
  total_tasks integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id)
);

CREATE SEQUENCE IF NOT EXISTS public.projects_id_seq OWNED BY public.projects.id;
ALTER TABLE public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass);

-- Project participants
CREATE TABLE IF NOT EXISTS public.project_participants (
  project_id integer NOT NULL,
  user_id integer NOT NULL,
  role project_role NOT NULL DEFAULT 'participant'::project_role,
  added_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  removed_at timestamptz,
  CONSTRAINT project_participants_pkey PRIMARY KEY (project_id, user_id),
  CONSTRAINT project_participants_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT project_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id integer NOT NULL DEFAULT nextval('tasks_id_seq'::regclass),
  project_id integer NOT NULL,
  creator_id integer NOT NULL,
  title text NOT NULL,
  description text,
  type task_type NOT NULL,
  recurrence_pattern recurrence_pattern,
  due_date timestamptz NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  recurrence_index integer,
  show_recurrence_index boolean DEFAULT false,
  recurrence_total integer,
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT tasks_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id)
);

CREATE SEQUENCE IF NOT EXISTS public.tasks_id_seq OWNED BY public.tasks.id;
ALTER TABLE public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);

-- Task statuses (no UNIQUE on task_id+user_id in remote)
CREATE TABLE IF NOT EXISTS public.task_statuses (
  id integer NOT NULL DEFAULT nextval('task_statuses_id_seq'::regclass),
  task_id integer NOT NULL,
  user_id integer NOT NULL,
  status task_status NOT NULL DEFAULT 'active'::task_status,
  archived_at timestamptz,
  recovered_at timestamptz,
  ring_color ring_color,
  completed_at timestamptz,
  CONSTRAINT task_statuses_pkey PRIMARY KEY (id),
  CONSTRAINT task_statuses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT task_statuses_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id)
);

CREATE SEQUENCE IF NOT EXISTS public.task_statuses_id_seq OWNED BY public.task_statuses.id;
ALTER TABLE public.task_statuses ALTER COLUMN id SET DEFAULT nextval('public.task_statuses_id_seq'::regclass);

-- Completion logs
CREATE TABLE IF NOT EXISTS public.completion_logs (
  id integer NOT NULL DEFAULT nextval('completion_logs_id_seq'::regclass),
  user_id integer NOT NULL,
  task_id integer NOT NULL,
  difficulty_rating smallint CHECK (difficulty_rating IS NULL OR (difficulty_rating >= 1 AND difficulty_rating <= 5)),
  penalty_applied boolean NOT NULL DEFAULT false,
  xp_earned integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT completion_logs_pkey PRIMARY KEY (id),
  CONSTRAINT completion_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT completion_logs_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id)
);

CREATE SEQUENCE IF NOT EXISTS public.completion_logs_id_seq OWNED BY public.completion_logs.id;
ALTER TABLE public.completion_logs ALTER COLUMN id SET DEFAULT nextval('public.completion_logs_id_seq'::regclass);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id integer NOT NULL DEFAULT nextval('notifications_id_seq'::regclass),
  user_id integer NOT NULL,
  type notification_type NOT NULL,
  message text NOT NULL,
  task_id integer,
  project_id integer,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  is_read boolean NOT NULL DEFAULT false,
  email_sent boolean NOT NULL DEFAULT false,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT notifications_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id),
  CONSTRAINT notifications_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);

CREATE SEQUENCE IF NOT EXISTS public.notifications_id_seq OWNED BY public.notifications.id;
ALTER TABLE public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);

-- Task recurrence
CREATE TABLE IF NOT EXISTS public.task_recurrence (
  id integer NOT NULL DEFAULT nextval('task_recurrence_id_seq'::regclass),
  task_id integer NOT NULL,
  recurrence_pattern recurrence_pattern NOT NULL,
  recurrence_interval integer NOT NULL,
  next_occurrence timestamptz NOT NULL,
  end_of_recurrence timestamptz,
  CONSTRAINT task_recurrence_pkey PRIMARY KEY (id),
  CONSTRAINT task_recurrence_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id)
);

CREATE SEQUENCE IF NOT EXISTS public.task_recurrence_id_seq OWNED BY public.task_recurrence.id;
ALTER TABLE public.task_recurrence ALTER COLUMN id SET DEFAULT nextval('public.task_recurrence_id_seq'::regclass);

-- NOTE: remote has task_id UNIQUE constraint on task_recurrence
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_recurrence_task_id_key'
  ) THEN
    ALTER TABLE public.task_recurrence ADD CONSTRAINT task_recurrence_task_id_key UNIQUE (task_id);
  END IF;
END $$;

-- Magic links
CREATE TABLE IF NOT EXISTS public.magic_links (
  id integer NOT NULL DEFAULT nextval('magic_links_id_seq'::regclass),
  token text NOT NULL UNIQUE,
  user_id integer,
  email text NOT NULL,
  is_signup boolean NOT NULL DEFAULT false,
  signup_name text,
  signup_handle text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT magic_links_pkey PRIMARY KEY (id),
  CONSTRAINT magic_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

CREATE SEQUENCE IF NOT EXISTS public.magic_links_id_seq OWNED BY public.magic_links.id;
ALTER TABLE public.magic_links ALTER COLUMN id SET DEFAULT nextval('public.magic_links_id_seq'::regclass);

-- Sessions
CREATE TABLE IF NOT EXISTS public.sessions (
  id integer NOT NULL DEFAULT nextval('sessions_id_seq'::regclass),
  user_id integer NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  last_accessed_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

CREATE SEQUENCE IF NOT EXISTS public.sessions_id_seq OWNED BY public.sessions.id;
ALTER TABLE public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);

-- Friends (bigint identity, default status 'accepted')
CREATE TABLE IF NOT EXISTS public.friends (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id bigint NOT NULL,
  friend_id bigint NOT NULL,
  status text DEFAULT 'accepted'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text])),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT friends_pkey PRIMARY KEY (id),
  CONSTRAINT friends_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT friends_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES public.users(id)
);

-- AI usage logs (usage_type is enum, usage_date is date type, count default 1)
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id integer NOT NULL DEFAULT nextval('ai_usage_logs_id_seq'::regclass),
  user_id integer NOT NULL,
  usage_type ai_usage_type NOT NULL,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  count integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT ai_usage_logs_pkey PRIMARY KEY (id),
  CONSTRAINT ai_usage_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

CREATE SEQUENCE IF NOT EXISTS public.ai_usage_logs_id_seq OWNED BY public.ai_usage_logs.id;
ALTER TABLE public.ai_usage_logs ALTER COLUMN id SET DEFAULT nextval('public.ai_usage_logs_id_seq'::regclass);

-- ============================================================
-- 3. INDEXES (from remote + codebase analysis)
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

-- ============================================================
-- 4. FUNCTIONS AND TRIGGERS
-- ============================================================

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
    VALUES (v_task_id, v_participant.user_id, 'active');
  END LOOP;

  RETURN v_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.delete_task_completely(p_task_id integer)
RETURNS void AS $$
BEGIN
  DELETE FROM public.tasks WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. REALTIME PUBLICATION
-- ============================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'tasks already in realtime publication';
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.task_statuses;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'task_statuses already in realtime publication';
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'projects already in realtime publication';
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.project_participants;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'project_participants already in realtime publication';
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'notifications already in realtime publication';
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.friends;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'friends already in realtime publication';
END $$;

-- ============================================================
-- 6. RLS (Row Level Security)
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

-- Permissive policies for self-hosted single-tenant
DO $$
DECLARE
  t text;
  pol_name text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    pol_name := 'Allow all for anon on ' || t;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = pol_name) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true)', pol_name, t);
    END IF;

    pol_name := 'Allow all for authenticated on ' || t;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = pol_name) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', pol_name, t);
    END IF;

    pol_name := 'Allow all for service_role on ' || t;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = pol_name) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', pol_name, t);
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- DONE. Verify with:
--   SELECT tablename FROM pg_tables WHERE schemaname = 'public';
--   SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace;
-- ============================================================
