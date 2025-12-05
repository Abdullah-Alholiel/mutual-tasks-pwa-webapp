import 'dotenv/config';
import { Client } from 'pg';
import {
  NOTIFICATION_TYPES,
  PROJECT_ROLES,
  RECURRENCE_PATTERNS,
  TASK_STATUSES,
  TASK_TYPES,
  TIMING_STATUSES,
  RING_COLORS
} from '../src/types';

// Disable SSL certificate validation for local development
// This is safe for Supabase connections as they use valid certificates
// but some local environments have certificate chain issues
if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// Get connection string from environment
const connectionString =
  process.env.SUPABASE_DB_URL ??
  process.env.DATABASE_URL ??
  '';

// Get Supabase URL for project reference extraction
const supabaseUrl =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  '';

// Helper to parse connection string and extract components
// Handles passwords with special characters like @ by finding the LAST @ before the hostname
const parseConnectionString = (connStr: string) => {
  try {
    // For connection strings with passwords containing @, we need to find the LAST @
    // that separates credentials from hostname
    // Format: postgresql://username:password@hostname:port/database
    // If password has @, we need to find the @ that's followed by a valid hostname pattern
    
    // Try to find the @ that's followed by a hostname (contains .supabase)
    const supabaseMatch = connStr.match(/^postgresql?:\/\/(.+?)@([^@]*\.(?:supabase\.com|supabase\.co))/);
    if (supabaseMatch) {
      const [, credentials, hostAndPath] = supabaseMatch;
      const [username, ...passwordParts] = credentials.split(':');
      const password = passwordParts.join(':'); // Rejoin in case password had :
      
      // Parse hostname:port/database
      const [hostPort, ...dbParts] = hostAndPath.split('/');
      const [hostname, port] = hostPort.includes(':') 
        ? hostPort.split(':')
        : [hostPort, '5432'];
      const database = dbParts.join('/') || 'postgres';
      
      return {
        username: username || 'postgres',
        password: decodeURIComponent(password), // Decode in case it was encoded
        hostname,
        port,
        database,
        projectRef: '',
        region: 'us-east-1'
      };
    }
    
    // Fallback to standard URL parsing (for properly encoded passwords)
    const url = new URL(connStr);
    return {
      username: url.username || 'postgres',
      password: url.password || '',
      hostname: url.hostname,
      port: url.port || '5432',
      database: url.pathname.slice(1) || 'postgres',
      projectRef: '',
      region: 'us-east-1'
    };
  } catch {
    return null;
  }
};

// Helper to extract project reference from various formats
const extractProjectRef = (hostname: string): string | null => {
  // Format 1: db.[PROJECT_REF].supabase.co
  if (hostname.includes('db.') && hostname.includes('.supabase.co')) {
    const parts = hostname.split('.');
    return parts[1] || null;
  }
  // Format 2: postgres.[PROJECT_REF] (pooler)
  if (hostname.startsWith('postgres.') && hostname.includes('.pooler.supabase.com')) {
    const parts = hostname.split('.');
    return parts[1] || null;
  }
  // Format 3: [PROJECT_REF].supabase.co (from SUPABASE_URL)
  if (hostname.includes('.supabase.co') && !hostname.startsWith('db.')) {
    return hostname.split('.')[0] || null;
  }
  return null;
};

// Helper to detect region from hostname
const extractRegion = (hostname: string): string => {
  // aws-0-[REGION].pooler.supabase.com
  if (hostname.includes('pooler.supabase.com')) {
    const match = hostname.match(/aws-0-([^.]+)\.pooler/);
    if (match && match[1]) {
      return match[1];
    }
  }
  return 'us-east-1'; // default
};

// Build connection strings to try (in order of preference)
const buildConnectionStrings = (): string[] => {
  const strings: string[] = [];
  
  // If we have a connection string, use it as-is first (PREFERRED)
  if (connectionString) {
    // Check if it's already a valid pooler or direct connection string
    const isPooler = connectionString.includes('pooler.supabase.com');
    const isDirect = connectionString.includes('db.') && connectionString.includes('.supabase.co');
    const hasValidFormat = connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://');
    
    if (hasValidFormat && (isPooler || isDirect)) {
      // Use as-is - it's already in the correct format
      // Just ensure sslmode is set
      let connStr = connectionString;
      if (!connStr.includes('sslmode=')) {
        connStr += (connStr.includes('?') ? '&' : '?') + 'sslmode=require';
      }
      strings.push(connStr);
      console.info('Using provided connection string as-is');
      return strings; // Return early - use the provided string
    }
    
    // If we can't use it as-is, try to parse and reconstruct
    const parsed = parseConnectionString(connectionString);
    if (parsed) {
      const password = parsed.password || 
        process.env.SUPABASE_DB_PASSWORD ||
        process.env.SUPABASE_DB_PASS ||
        process.env.POSTGRES_PASSWORD ||
        '';
      
      const projectRef = extractProjectRef(parsed.hostname) || 
        (supabaseUrl ? new URL(supabaseUrl).hostname.split('.')[0] : null);
      
      const region = extractRegion(parsed.hostname);
      
      if (projectRef && password) {
        // Try 1: Pooler Transaction Mode (port 6543) - BEST for migrations
        strings.push(
          `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:6543/postgres?sslmode=require`
        );
        
        // Try 2: Pooler Session Mode (port 5432)
        strings.push(
          `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:5432/postgres?sslmode=require`
        );
        
        // Try 3: Direct Connection (port 5432)
        strings.push(
          `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres?sslmode=require`
        );
      } else if (parsed.password) {
        // Use original if it has a password (even if parsing was partial)
        let connStr = connectionString;
        if (!connStr.includes('sslmode=')) {
          connStr += (connStr.includes('?') ? '&' : '?') + 'sslmode=require';
        }
        strings.push(connStr);
      }
    } else {
      // Use original if we can't parse it - might work anyway
      let connStr = connectionString;
      if (!connStr.includes('sslmode=')) {
        connStr += (connStr.includes('?') ? '&' : '?') + 'sslmode=require';
      }
      strings.push(connStr);
    }
  }
  
  // Fallback: construct from SUPABASE_URL + password
  if (strings.length === 0 && supabaseUrl) {
    try {
      const url = new URL(supabaseUrl);
      const projectRef = url.hostname.split('.')[0];
      const password =
        process.env.SUPABASE_DB_PASSWORD ??
        process.env.SUPABASE_DB_PASS ??
        process.env.POSTGRES_PASSWORD;
      
      if (projectRef && password) {
        strings.push(
          `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require`
        );
        strings.push(
          `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require`
        );
        strings.push(
          `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres?sslmode=require`
        );
      }
    } catch (e) {
      // Ignore
    }
  }
  
  return strings;
};

const connectionStrings = buildConnectionStrings();

if (connectionStrings.length === 0) {
  throw new Error(
    'Missing database connection. Please set one of:\n' +
    '  1. SUPABASE_DB_URL (or DATABASE_URL) - PostgreSQL connection string\n' +
    '  2. SUPABASE_URL + SUPABASE_DB_PASSWORD - To construct connection string\n\n' +
    'Get connection string from: Supabase Dashboard → Database → Connection string → URI'
  );
}

type EnumValues = ReadonlyArray<string>;

const buildEnumStatement = (name: string, values: EnumValues) => `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${name}') THEN
    CREATE TYPE ${name} AS ENUM (${values.map(value => `'${value}'`).join(', ')});
  END IF;
END
$$;
`;

const ENUM_STATEMENTS = [
  buildEnumStatement('project_role', PROJECT_ROLES),
  buildEnumStatement('task_type', TASK_TYPES),
  buildEnumStatement('task_status', TASK_STATUSES),
  buildEnumStatement('recurrence_pattern', RECURRENCE_PATTERNS),
  buildEnumStatement('timing_status', TIMING_STATUSES),
  buildEnumStatement('ring_color', RING_COLORS),
  buildEnumStatement('notification_type', NOTIFICATION_TYPES)
];

const TABLE_STATEMENTS = [
  `
  CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    handle text NOT NULL UNIQUE,
    email text NOT NULL UNIQUE,
    avatar text NOT NULL,
    timezone text NOT NULL,
    notification_preferences jsonb,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS public.user_stats (
    user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    total_completed_tasks integer NOT NULL DEFAULT 0,
    current_streak integer NOT NULL DEFAULT 0,
    longest_streak integer NOT NULL DEFAULT 0,
    totalscore integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS public.projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    icon text,
    color text,
    owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    is_public boolean NOT NULL DEFAULT false,
    total_tasks integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS public.project_participants (
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role project_role NOT NULL DEFAULT 'participant',
    added_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    removed_at timestamptz,
    PRIMARY KEY (project_id, user_id)
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    creator_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    type task_type NOT NULL,
    recurrence_pattern recurrence_pattern,
    original_due_date timestamptz NOT NULL,
    status task_status NOT NULL DEFAULT 'initiated',
    initiated_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS public.task_status (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status task_status_user_status NOT NULL DEFAULT 'initiated',
    effective_due_date timestamptz NOT NULL,
    initiated_at timestamptz,
    accepted_at timestamptz,
    declined_at timestamptz,
    archived_at timestamptz,
    recovered_at timestamptz,
    timing_status timing_status,
    ring_color ring_color,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(task_id, user_id)
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS public.completion_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    completed_at timestamptz NOT NULL,
    difficulty_rating smallint CHECK (difficulty_rating BETWEEN 1 AND 5),
    timing_status timing_status NOT NULL,
    recovered_completion boolean NOT NULL DEFAULT false,
    penalty_applied boolean NOT NULL DEFAULT false,
    xp_earned integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    message text NOT NULL,
    task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
    project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    is_read boolean NOT NULL DEFAULT false,
    email_sent boolean NOT NULL DEFAULT false
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS public.task_recurrence (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    recurrence_pattern recurrence_pattern NOT NULL,
    recurrence_interval integer NOT NULL,
    next_occurrence timestamptz NOT NULL,
    end_of_recurrence timestamptz,
    UNIQUE(task_id)
  );
  `
];

const INDEX_STATEMENTS = [
  'CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects(owner_id);',
  'CREATE INDEX IF NOT EXISTS idx_project_participants_role ON public.project_participants(project_id, role);',
  'CREATE INDEX IF NOT EXISTS idx_project_participants_user ON public.project_participants(user_id);',
  'CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id);',
  'CREATE INDEX IF NOT EXISTS idx_tasks_creator ON public.tasks(creator_id);',
  'CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);',
  'CREATE INDEX IF NOT EXISTS idx_task_status_user_status ON public.task_status(user_id, status);',
  'CREATE INDEX IF NOT EXISTS idx_task_status_effective_due_date ON public.task_status(user_id, effective_due_date);',
  'CREATE INDEX IF NOT EXISTS idx_task_status_task ON public.task_status(task_id);',
  'CREATE INDEX IF NOT EXISTS idx_completion_logs_user_completed ON public.completion_logs(user_id, completed_at);',
  'CREATE INDEX IF NOT EXISTS idx_completion_logs_task ON public.completion_logs(task_id);',
  'CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON public.notifications(user_id, is_read, created_at);',
  'CREATE INDEX IF NOT EXISTS idx_task_recurrence_task ON public.task_recurrence(task_id);',
  'CREATE INDEX IF NOT EXISTS idx_task_recurrence_next_occurrence ON public.task_recurrence(next_occurrence);'
];

const MIGRATION_STATEMENTS = [
  'CREATE EXTENSION IF NOT EXISTS "pgcrypto";',
  ...ENUM_STATEMENTS,
  ...TABLE_STATEMENTS,
  ...INDEX_STATEMENTS
];

const tryConnection = async (connString: string, attempt: number, total: number): Promise<Client> => {
  // Ensure SSL mode is set
  let finalConnString = connString;
  if (!finalConnString.includes('sslmode=')) {
    finalConnString += (finalConnString.includes('?') ? '&' : '?') + 'sslmode=require';
  }
  
  const client = new Client({
    connectionString: finalConnString,
    ssl: {
      rejectUnauthorized: false,
      require: true
    },
    connectionTimeoutMillis: 10000
  });

  try {
    if (total > 1) {
      const connType = finalConnString.includes('pooler') 
        ? (finalConnString.includes(':6543') ? 'Pooler (Transaction)' : 'Pooler (Session)')
        : 'Direct';
      console.info(`Attempt ${attempt}/${total}: Trying ${connType} connection...`);
    } else {
      console.info('Connecting to Supabase Postgres...');
    }
    
    await client.connect();
    
    // Test the connection with a simple query
    await client.query('SELECT 1');
    
    if (total > 1) {
      const connType = finalConnString.includes('pooler') 
        ? (finalConnString.includes(':6543') ? 'Pooler (Transaction)' : 'Pooler (Session)')
        : 'Direct';
      console.info(`✓ Connected successfully using ${connType} mode\n`);
    } else {
      console.info('Connected successfully. Applying schema statements...\n');
    }
    
    return client;
  } catch (error: any) {
    await client.end().catch(() => {});
    
    // If this isn't the last attempt, return null to try next
    if (attempt < total) {
      if (error?.code === 'ENOTFOUND' || error?.code === 'ECONNREFUSED' || 
          error?.code === 'XX000' || error?.message?.includes('Tenant')) {
        return null; // Try next connection string
      }
    }
    
    throw error;
  }
};

const run = async () => {
  let client: Client | null = null;
  let lastError: any = null;
  
  // Try each connection string in order
  for (let i = 0; i < connectionStrings.length; i++) {
    try {
      client = await tryConnection(connectionStrings[i], i + 1, connectionStrings.length);
      if (client) {
        break; // Success!
      }
    } catch (error: any) {
      lastError = error;
      // Continue to next connection string
    }
  }
  
  if (!client) {
    console.error('\n❌ Failed to connect with all connection methods.\n');
    if (lastError?.code === 'ENOTFOUND' || lastError?.message?.includes('getaddrinfo')) {
      console.error('DNS resolution failed. Please check:');
      console.error('  1. Your network connection');
      console.error('  2. The connection string hostname is correct\n');
    } else if (lastError?.code === 'ECONNREFUSED') {
      console.error('Connection refused. Please check:');
      console.error('  1. Your Supabase project is active');
      console.error('  2. Your IP is not blocked by Supabase firewall\n');
    } else if (lastError?.code === 'XX000' || lastError?.message?.includes('Tenant')) {
      console.error('Authentication failed. Please check:');
      console.error('  1. The database password in your connection string is correct');
      console.error('  2. Get a fresh connection string from:');
      console.error('     Supabase Dashboard → Database → Connection string → URI\n');
    }
    throw lastError || new Error('Failed to establish database connection');
  }

  try {
    // Run migrations
    for (const statement of MIGRATION_STATEMENTS) {
      const trimmed = statement.trim().split('\n')[0]?.trim().slice(0, 60) ?? 'statement';
      console.info(`Running: ${trimmed}...`);
      try {
        await client.query(statement);
      } catch (error: any) {
        // If it's a "already exists" error, that's okay for idempotent operations
        if (error?.message?.includes('already exists') || error?.code === '42P07' || error?.code === '42710') {
          console.info(`  ✓ (already exists, skipping)`);
          continue;
        }
        throw error;
      }
    }

    console.info('\nDatabase schema synced successfully ✅');
  } finally {
    await client.end();
  }
};

run().catch((error) => {
  console.error('Database migration failed:', error);
  process.exitCode = 1;
});
