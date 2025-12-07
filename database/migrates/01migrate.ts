import 'dotenv/config';
import { Client } from 'pg';
import {
  NOTIFICATION_TYPES,
  PROJECT_ROLES,
  RECURRENCE_PATTERNS,
  TASK_STATUS,
  TASK_TYPES,
  RING_COLORS
} from '../../src/types/index.ts';

// Disable SSL certificate validation for local development
// This is safe for Supabase connections as they use valid certificates
// but some local environments have certificate chain issues
if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// Get connection string from environment
const connectionString =
  process.env.SUPABASE_DB_URL ??
  '';

// Get Supabase URL for project reference extraction
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL
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
  buildEnumStatement('task_status', TASK_STATUS),
  buildEnumStatement('recurrence_pattern', RECURRENCE_PATTERNS),
  buildEnumStatement('ring_color', RING_COLORS),
  buildEnumStatement('notification_type', NOTIFICATION_TYPES)
];

const TABLE_STATEMENTS = [
  `
  CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
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
    user_id integer PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    total_completed_tasks integer NOT NULL DEFAULT 0,
    current_streak integer NOT NULL DEFAULT 0,
    longest_streak integer NOT NULL DEFAULT 0,
    totalscore integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS public.projects (
    id SERIAL PRIMARY KEY,
    name text NOT NULL,
    description text,
    icon text,
    color text,
    owner_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    is_public boolean NOT NULL DEFAULT false,
    total_tasks integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS public.project_participants (
    project_id integer NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role project_role NOT NULL DEFAULT 'participant',
    added_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    removed_at timestamptz,
    PRIMARY KEY (project_id, user_id)
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS public.tasks (
    id SERIAL PRIMARY KEY,
    project_id integer NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    creator_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    type task_type NOT NULL,
    recurrence_pattern recurrence_pattern,
    due_date timestamptz NOT NULL,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS public.task_statuses (
    id SERIAL PRIMARY KEY,
    task_id integer NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status task_status NOT NULL DEFAULT 'active',
    archived_at timestamptz,
    recovered_at timestamptz,
    ring_color ring_color,
    UNIQUE(task_id, user_id)
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS public.completion_logs (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    task_id integer NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    difficulty_rating smallint CHECK (difficulty_rating IS NULL OR (difficulty_rating >= 1 AND difficulty_rating <= 5)),
    penalty_applied boolean NOT NULL DEFAULT false,
    xp_earned integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS public.notifications (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    message text NOT NULL,
    task_id integer REFERENCES public.tasks(id) ON DELETE SET NULL,
    project_id integer REFERENCES public.projects(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    is_read boolean NOT NULL DEFAULT false,
    email_sent boolean NOT NULL DEFAULT false
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS public.task_recurrence (
    id SERIAL PRIMARY KEY,
    task_id integer NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    recurrence_pattern recurrence_pattern NOT NULL,
    recurrence_interval integer NOT NULL,
    next_occurrence timestamptz NOT NULL,
    end_of_recurrence timestamptz,
    UNIQUE(task_id)
  );
  `,
  `
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
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS public.sessions (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    last_accessed_at timestamptz NOT NULL DEFAULT timezone('utc', now())
  );
  `
];

// Index statements with table verification
const INDEX_STATEMENTS = [
  { table: 'projects', statement: 'CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects(owner_id);' },
  { table: 'project_participants', statement: 'CREATE INDEX IF NOT EXISTS idx_project_participants_role ON public.project_participants(project_id, role);' },
  { table: 'project_participants', statement: 'CREATE INDEX IF NOT EXISTS idx_project_participants_user ON public.project_participants(user_id);' },
  { table: 'tasks', statement: 'CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id);' },
  { table: 'tasks', statement: 'CREATE INDEX IF NOT EXISTS idx_tasks_creator ON public.tasks(creator_id);' },
  { table: 'tasks', statement: 'CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);' },
  { table: 'task_statuses', statement: 'CREATE INDEX IF NOT EXISTS idx_task_statuses_user_status ON public.task_statuses(user_id, status);' },
  { table: 'task_statuses', statement: 'CREATE INDEX IF NOT EXISTS idx_task_statuses_task ON public.task_statuses(task_id);' },
  { table: 'task_statuses', statement: 'CREATE INDEX IF NOT EXISTS idx_task_statuses_user ON public.task_statuses(user_id);' },
  { table: 'completion_logs', statement: 'CREATE INDEX IF NOT EXISTS idx_completion_logs_user ON public.completion_logs(user_id);' },
  { table: 'completion_logs', statement: 'CREATE INDEX IF NOT EXISTS idx_completion_logs_task ON public.completion_logs(task_id);' },
  { table: 'completion_logs', statement: 'CREATE INDEX IF NOT EXISTS idx_completion_logs_created ON public.completion_logs(created_at);' },
  { table: 'notifications', statement: 'CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON public.notifications(user_id, is_read, created_at);' },
  { table: 'task_recurrence', statement: 'CREATE INDEX IF NOT EXISTS idx_task_recurrence_task ON public.task_recurrence(task_id);' },
  { table: 'task_recurrence', statement: 'CREATE INDEX IF NOT EXISTS idx_task_recurrence_next_occurrence ON public.task_recurrence(next_occurrence);' },
  { table: 'magic_links', statement: 'CREATE INDEX IF NOT EXISTS idx_magic_links_token ON public.magic_links(token);' },
  { table: 'magic_links', statement: 'CREATE INDEX IF NOT EXISTS idx_magic_links_email ON public.magic_links(email);' },
  { table: 'magic_links', statement: 'CREATE INDEX IF NOT EXISTS idx_magic_links_expires ON public.magic_links(expires_at);' },
  { table: 'sessions', statement: 'CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions(token);' },
  { table: 'sessions', statement: 'CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.sessions(user_id);' },
  { table: 'sessions', statement: 'CREATE INDEX IF NOT EXISTS idx_sessions_expires ON public.sessions(expires_at);' }
];

// Note: Cleanup statements removed - use DROP TABLE manually if needed

// Build migration statements
const MIGRATION_STATEMENTS = [
  ...ENUM_STATEMENTS,
  ...TABLE_STATEMENTS,
  // Indexes will be handled separately with table verification
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
    // Drop old conflicting table if it exists (from previous migration attempts)
    console.info('Checking for old conflicting table...');
    try {
      const oldTableCheck = await client.query(`
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'task_status';
      `);
      if (oldTableCheck.rows.length > 0) {
        console.info('Dropping old conflicting table "task_status" (will recreate as "task_statuses")...');
        await client.query('DROP TABLE IF EXISTS public.task_status CASCADE;');
        console.info('  ✓ Old table dropped');
      }
    } catch (error: any) {
      // Ignore errors - table might not exist
      console.info('  (no old table to drop)');
    }

    // First, verify enum types exist (they're needed for table creation)
    console.info('Verifying enum types...');
    const enumCheck = await client.query(`
      SELECT typname FROM pg_type 
      WHERE typname IN ('project_role', 'task_type', 'task_status', 'recurrence_pattern', 'ring_color', 'notification_type')
      AND typtype = 'e';
    `);
    console.info(`Found ${enumCheck.rows.length} enum types`);
    
    // Check if task_status enum has the correct values - if not, drop and recreate it
    console.info('Checking task_status enum values...');
    const taskStatusEnumCheck = await client.query(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'task_status')
      ORDER BY enumsortorder;
    `);
    
    if (taskStatusEnumCheck.rows.length > 0) {
      const existingValues = taskStatusEnumCheck.rows.map(r => r.enumlabel).sort();
      const expectedValues = [...TASK_STATUS].sort();
      
      console.info(`Current enum values: ${existingValues.join(', ')}`);
      console.info(`Expected enum values: ${expectedValues.join(', ')}`);
      
      // Check if values match (order doesn't matter)
      const valuesMatch = existingValues.length === expectedValues.length &&
        existingValues.every(v => expectedValues.includes(v));
      
      if (!valuesMatch) {
        console.warn(`⚠ task_status enum has incorrect values. Dropping and recreating...`);
        
        // Check if any tables use this enum
        const tablesUsingEnum = await client.query(`
          SELECT DISTINCT table_name 
          FROM information_schema.columns 
          WHERE udt_name = 'task_status' 
          AND table_schema = 'public';
        `);
        
        if (tablesUsingEnum.rows.length > 0) {
          const tableNames = tablesUsingEnum.rows.map(r => r.table_name);
          console.warn(`⚠ Tables using task_status enum: ${tableNames.join(', ')}`);
          console.warn('⚠ Cannot drop enum while tables use it. Please manually fix the enum or drop the tables first.');
          throw new Error(`Cannot fix task_status enum: tables ${tableNames.join(', ')} are using it. Please drop these tables first or manually fix the enum values.`);
        }
        
        // Drop the enum
        console.info('Dropping old task_status enum...');
        await client.query('DROP TYPE IF EXISTS task_status CASCADE;');
        console.info('  ✓ Dropped old enum');
        
        // Recreate with correct values
        console.info('Recreating task_status enum with correct values...');
        await client.query(`
          CREATE TYPE task_status AS ENUM (${TASK_STATUS.map(v => `'${v}'`).join(', ')});
        `);
        console.info(`  ✓ Created enum with values: ${TASK_STATUS.join(', ')}`);
      } else {
        console.info(`✓ task_status enum has all required values`);
      }
    } else {
      console.info('task_status enum not found - will be created during migration');
    }

    // Check which tables already exist to avoid recreating them
    console.info('Checking existing tables...');
    const existingTablesCheck = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('users', 'user_stats', 'projects', 'project_participants', 'tasks', 'task_statuses', 'completion_logs', 'notifications', 'task_recurrence', 'magic_links', 'sessions')
      ORDER BY tablename;
    `);
    const existingTableNames = new Set(existingTablesCheck.rows.map(r => r.tablename));
    console.info(`Existing tables: ${existingTableNames.size > 0 ? Array.from(existingTableNames).join(', ') : 'none'}`);

    // Run migrations - skip tables that already exist
    for (let i = 0; i < MIGRATION_STATEMENTS.length; i++) {
      const statement = MIGRATION_STATEMENTS[i];
      const trimmed = statement.trim().split('\n')[0]?.trim().slice(0, 60) ?? 'statement';
      const statementType = i < ENUM_STATEMENTS.length ? 'ENUM' : 'TABLE';
      
      // Skip table creation if table already exists
      if (statementType === 'TABLE') {
        const tableMatch = statement.match(/CREATE TABLE IF NOT EXISTS public\.(\w+)/);
        if (tableMatch && existingTableNames.has(tableMatch[1])) {
          console.info(`[${statementType}] Skipping: ${trimmed}... (table already exists)`);
          continue;
        }
      }
      
      console.info(`[${statementType}] Running: ${trimmed}...`);
      try {
        const result = await client.query(statement);
        console.info(`  ✓ Success`);
        
        // Update existing tables set if a table was created
        if (statementType === 'TABLE') {
          const tableMatch = statement.match(/CREATE TABLE IF NOT EXISTS public\.(\w+)/);
          if (tableMatch) {
            existingTableNames.add(tableMatch[1]);
          }
        }
      } catch (error: any) {
        // Only skip if it's a genuine "already exists" error for idempotent operations
        // Be very specific about what constitutes "already exists"
        const isAlreadyExists = 
          error?.code === '42P07' || // duplicate_table
          (error?.code === '42710' && error?.message?.toLowerCase().includes('already exists')) || // duplicate_object
          (error?.code === '42723' && error?.message?.toLowerCase().includes('already exists')) || // duplicate_function
          (error?.message?.toLowerCase().includes('already exists') && 
           !error?.message?.toLowerCase().includes('does not exist'));
        
        // Explicitly exclude "does not exist" errors - these are real failures
        const isDoesNotExist = 
          error?.code === '42P01' || // undefined_table
          error?.message?.toLowerCase().includes('does not exist') ||
          (error?.message?.toLowerCase().includes('relation') && error?.message?.toLowerCase().includes('does not exist'));
        
        if (isAlreadyExists && !isDoesNotExist) {
          console.info(`  ✓ (already exists, skipping)`);
          continue;
        }
        
        // For other errors, log details and rethrow
        console.error(`  ✗ Error [${error.code || 'UNKNOWN'}]: ${error.message}`);
        if (error.detail) {
          console.error(`     Detail: ${error.detail}`);
        }
        if (error.hint) {
          console.error(`     Hint: ${error.hint}`);
        }
        if (error.where) {
          console.error(`     Where: ${error.where}`);
        }
        throw error;
      }
    }
    
    // Specifically check and create missing tables
    const missingTables: string[] = [];
    if (!existingTableNames.has('task_statuses')) missingTables.push('task_statuses');
    if (!existingTableNames.has('project_participants')) missingTables.push('project_participants');
    
    if (missingTables.length > 0) {
      console.info(`\n[TABLE] Creating missing tables: ${missingTables.join(', ')}...`);
      
      for (const tableName of missingTables) {
        try {
          let createStatement = '';
          
          if (tableName === 'task_statuses') {
            createStatement = `
              CREATE TABLE IF NOT EXISTS public.task_statuses (
                id SERIAL PRIMARY KEY,
                task_id integer NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
                user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
                status task_status NOT NULL DEFAULT 'active',
                archived_at timestamptz,
                recovered_at timestamptz,
                ring_color ring_color,
                UNIQUE(task_id, user_id)
              );
            `;
          } else if (tableName === 'project_participants') {
            createStatement = `
              CREATE TABLE IF NOT EXISTS public.project_participants (
                project_id integer NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
                user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
                role project_role NOT NULL DEFAULT 'participant',
                added_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
                removed_at timestamptz,
                PRIMARY KEY (project_id, user_id)
              );
            `;
          }
          
          if (createStatement) {
            await client.query(createStatement);
            console.info(`  ✓ ${tableName} table created successfully`);
            existingTableNames.add(tableName);
          }
        } catch (error: any) {
          console.error(`  ✗ Failed to create ${tableName}: ${error.message}`);
          if (error.detail) console.error(`     Detail: ${error.detail}`);
          if (error.hint) console.error(`     Hint: ${error.hint}`);
          throw error;
        }
      }
    }

    // Verify critical tables exist before creating indexes
    console.info('\nVerifying tables exist before creating indexes...');
    const tableCheck = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('users', 'user_stats', 'projects', 'project_participants', 'tasks', 'task_statuses', 'completion_logs', 'notifications', 'task_recurrence', 'magic_links', 'sessions')
      ORDER BY tablename;
    `);
    const existingTables = new Set(tableCheck.rows.map(r => r.tablename));
    console.info(`Existing tables: ${Array.from(existingTables).join(', ')}`);

    // Create indexes only for tables that exist
    console.info('\nCreating indexes...');
    for (const indexDef of INDEX_STATEMENTS) {
      if (!existingTables.has(indexDef.table)) {
        console.warn(`  ⚠ Skipping index for table '${indexDef.table}' (table does not exist)`);
        continue;
      }
      
      const trimmed = indexDef.statement.trim().split('\n')[0]?.trim().slice(0, 60) ?? 'statement';
      console.info(`[INDEX] Running: ${trimmed}...`);
      try {
        await client.query(indexDef.statement);
        console.info(`  ✓ Success`);
      } catch (error: any) {
        const isAlreadyExists = 
          error?.code === '42P07' || // duplicate_table
          error?.code === '42710' || // duplicate_object
          error?.message?.includes('already exists');
        
        if (isAlreadyExists) {
          console.info(`  ✓ (already exists, skipping)`);
          continue;
        }
        
        console.error(`  ✗ Error [${error.code || 'UNKNOWN'}]: ${error.message}`);
        throw error;
      }
    }

    // Final verification
    const finalTableCheck = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('users', 'user_stats', 'projects', 'project_participants', 'tasks', 'task_statuses', 'completion_logs', 'notifications', 'task_recurrence', 'magic_links', 'sessions')
      ORDER BY tablename;
    `);
    const finalTables = finalTableCheck.rows.map(r => r.tablename);
    console.info(`\nFinal tables: ${finalTables.join(', ')}`);
    
    const expectedTables = ['users', 'user_stats', 'projects', 'project_participants', 'tasks', 'task_statuses', 'completion_logs', 'notifications', 'task_recurrence', 'magic_links', 'sessions'];
    const missing = expectedTables.filter(t => !finalTables.includes(t));
    
    if (missing.length > 0) {
      throw new Error(`Critical tables are missing: ${missing.join(', ')}. Please check the migration errors above.`);
    }

    console.info('\n✅ Database schema synced successfully');
  } finally {
    await client.end();
  }
};

run().catch((error) => {
  console.error('Database migration failed:', error);
  process.exitCode = 1;
});
