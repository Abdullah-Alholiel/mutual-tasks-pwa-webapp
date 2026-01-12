// ============================================================================
// Database Client - Supabase Production Implementation (CLIENT-SIDE)
// ============================================================================
// 
// This module provides a production-ready database access layer using Supabase.
// All data operations go through Supabase to the remote database.
//
// NOTE: This is for CLIENT-SIDE (browser) use only.
// For server-side operations (migrations, seed scripts), use database/supabaseClient.ts
//
// Features:
// - Single set of types (camelCase, Date objects, number IDs)
// - Automatic transformation between DB and frontend formats
// - Modular repository pattern for maintainability
// - Tree-shakeable and optimized
// - Matches Supabase query patterns exactly
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

// Import repositories
import { UsersRepository } from './users';
import { ProjectsRepository } from '../features/projects/api/projects';
import { TasksRepository } from '../features/tasks/api/tasks';
import { TaskStatusRepository } from '../features/tasks/api/taskStatus';
import { CompletionLogsRepository } from './completionLogs';
import { NotificationsRepository } from '../features/notifications/api/notifications';
import { MagicLinksRepository } from './magicLinks';
import { SessionsRepository } from './sessions';
import { FriendsRepository } from '@/features/friends/api/friends';
import { AIUsageRepository } from './aiUsage';

// ============================================================================
// Database Client Interface
// ============================================================================

export interface DatabaseClient {
  // Users
  users: UsersRepository;
  // Projects
  projects: ProjectsRepository;
  // Tasks
  tasks: TasksRepository;
  // Task Status
  taskStatus: TaskStatusRepository;
  // Completion Logs
  completionLogs: CompletionLogsRepository;
  // Notifications
  notifications: NotificationsRepository;
  // Magic Links
  magicLinks: MagicLinksRepository;
  // Sessions
  sessions: SessionsRepository;
  // Friends
  friends: FriendsRepository;
  // AI Usage Tracking
  aiUsage: AIUsageRepository;
}

// ============================================================================
// Supabase Database Client Implementation
// ============================================================================

export class SupabaseDatabaseClient implements DatabaseClient {
  public readonly users: UsersRepository;
  public readonly projects: ProjectsRepository;
  public readonly tasks: TasksRepository;
  public readonly taskStatus: TaskStatusRepository;
  public readonly completionLogs: CompletionLogsRepository;
  public readonly notifications: NotificationsRepository;
  public readonly magicLinks: MagicLinksRepository;
  public readonly sessions: SessionsRepository;
  public readonly friends: FriendsRepository;
  public readonly aiUsage: AIUsageRepository;

  constructor(private supabase: SupabaseClient) {
    // Initialize repositories
    this.taskStatus = new TaskStatusRepository(supabase);
    this.completionLogs = new CompletionLogsRepository(supabase);
    this.users = new UsersRepository(supabase);
    this.projects = new ProjectsRepository(supabase);
    this.tasks = new TasksRepository(supabase, this.taskStatus);
    this.notifications = new NotificationsRepository(supabase);
    this.magicLinks = new MagicLinksRepository(supabase);
    this.sessions = new SessionsRepository(supabase);
    this.friends = new FriendsRepository(supabase, this.notifications);
    this.aiUsage = new AIUsageRepository(supabase);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let dbClient: DatabaseClient | null = null;

/**
 * Get or create the database client instance
 * Requires Supabase configuration in environment variables
 * 
 * @throws Error if Supabase is not configured
 * 
 * Note: For better error handling, initialize the database at app startup
 * using initializeDatabase() instead of relying on lazy initialization.
 */
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env';

export function getDatabaseClient(): DatabaseClient {
  if (dbClient) return dbClient;

  console.log('[DatabaseClient] Initializing Supabase connection...');

  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  console.log('[DatabaseClient] Supabase URL:', supabaseUrl);
  console.log('[DatabaseClient] Supabase Key:', supabaseAnonKey ? `${supabaseAnonKey.slice(0, 30)}...` : 'NOT SET');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase configuration missing. Please set:\n' +
      '  - Vite: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY\n' +
      '  - Next.js: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY\n\n' +
      'Alternatively, initialize the database at app startup:\n' +
      'import { createClient } from "@supabase/supabase-js";\n' +
      'import { initializeDatabase } from "@/db";\n' +
      'const supabase = createClient(url, key);\n' +
      'initializeDatabase(supabase);'
    );
  }

  // Create Supabase client
  // This requires @supabase/supabase-js to be installed
  try {
    console.log('[DatabaseClient] Creating Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    dbClient = new SupabaseDatabaseClient(supabase);
    console.log('[DatabaseClient] ✅ Database client initialized successfully');
    return dbClient;
  } catch (error) {
    console.error('[DatabaseClient] ❌ Failed to initialize:', error);
    throw new Error(
      `Failed to initialize Supabase client: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
      'Make sure @supabase/supabase-js is installed: npm install @supabase/supabase-js\n\n' +
      'For better control, initialize at app startup using initializeDatabase()'
    );
  }
}

// ============================================================================
// Export the client instance
// ============================================================================
// 
// Note: Initialize Supabase client at app startup for better error handling
// Example in main.tsx or App.tsx:
// 
// import { createClient } from '@supabase/supabase-js';
// import { initializeDatabase } from '@/db';
// 
// const supabase = createClient(
//   import.meta.env.NEXT_PUBLIC_SUPABASE_URL,
//   import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
// );
// initializeDatabase(supabase);
// ============================================================================

/**
 * Initialize the database client with a Supabase instance
 * Call this at app startup for better error handling
 */
export function initializeDatabase(supabase: SupabaseClient): DatabaseClient {
  dbClient = new SupabaseDatabaseClient(supabase);
  return dbClient;
}

// Lazy initialization - use getDatabaseClient() directly instead of exporting db
// This prevents initialization errors if environment variables aren't loaded yet
// Use: import { getDatabaseClient } from '@/db'; const db = getDatabaseClient();
// Or use individual repositories directly

// ============================================================================
// Export repositories for direct access if needed
// ============================================================================

export { UsersRepository } from './users';
export { ProjectsRepository } from '../features/projects/api/projects';
export { TasksRepository } from '../features/tasks/api/tasks';
export { TaskStatusRepository } from '../features/tasks/api/taskStatus';
export { CompletionLogsRepository } from './completionLogs';
export { NotificationsRepository } from '../features/notifications/api/notifications';
export { MagicLinksRepository } from './magicLinks';
export { SessionsRepository } from './sessions';
export { AIUsageRepository } from './aiUsage';

// ============================================================================
// Export transformers for advanced usage
// ============================================================================

export * from './transformers';

