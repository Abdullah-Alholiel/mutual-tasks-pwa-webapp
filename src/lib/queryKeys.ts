// ============================================================================
// Query Keys - Centralized Query Key Constants for React Query
// ============================================================================
// Ensures consistency across all query operations and cache invalidations
// This prevents cache key mismatches that cause real-time updates to fail
//
// Purpose:
// - Single source of truth for all React Query cache keys
// - Consistent naming across queries, mutations, and invalidations
// - Type-safe query key generation with TypeScript const assertions
// - Prevents bugs from cache key mismatches (the #1 cause of stale data)
//
// Usage Pattern:
// 1. Define keys here with descriptive names
// 2. Use in useQuery: queryKey: NOTIFICATION_KEYS.lists(userId)
// 3. Use in useMutation onSettled: queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all(userId) })
// 4. Use in realtime handlers: queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all(userId) })
//
// Critical: Always use these constants instead of hardcoded strings
// This ensures cache invalidation works correctly with real-time updates
// ============================================================================

// ============================================================================
// Task Query Keys
// ============================================================================
// Keys for all task-related queries
// ============================================================================
export const TASK_KEYS = {
  // Base key for all task-related queries
  // Usage: queryClient.invalidateQueries({ queryKey: TASK_KEYS.all })
  all: ['tasks'] as const,

  // List of all tasks (may be filtered by server)
  // Usage: queryKey: TASK_KEYS.lists()
  lists: () => [...TASK_KEYS.all, 'list'] as const,

  // Single task by ID
  // Usage: queryKey: TASK_KEYS.detail(taskId)
  detail: (id: number | string) => [...TASK_KEYS.all, id] as const,

  // Tasks filtered by project
  // Usage: queryKey: TASK_KEYS.byProject(projectId)
  byProject: (projectId: number | string) => [...TASK_KEYS.all, 'project', projectId] as const,
} as const;

// ============================================================================
// Project Query Keys
// ============================================================================
// Keys for all project-related queries
// ============================================================================
export const PROJECT_KEYS = {
  // Base key for all project-related queries
  all: ['projects'] as const,

  // List of all projects
  lists: () => [...PROJECT_KEYS.all, 'list'] as const,

  // Single project by ID
  detail: (id: number | string) => [...PROJECT_KEYS.all, id] as const,
} as const;

// ============================================================================
// Notification Query Keys
// ============================================================================
// Keys for all notification-related queries
//
// IMPORTANT: These keys include userId to ensure proper cache isolation
// Never use ['notifications'] alone - it won't match user-specific queries
// ============================================================================
export const NOTIFICATION_KEYS = {
  // Base key for a specific user's notifications
  // CRITICAL: Must include userId for proper filtering and invalidation
  // Usage: queryKey: NOTIFICATION_KEYS.all(userId)
  all: (userId: number) => ['notifications', userId] as const,

  // List of notifications for a user
  // Usage: queryKey: NOTIFICATION_KEYS.lists(userId)
  lists: (userId: number) => [...NOTIFICATION_KEYS.all(userId), 'list'] as const,

  // Unread notifications for a user
  // Usage: queryKey: NOTIFICATION_KEYS.unread(userId)
  unread: (userId: number) => [...NOTIFICATION_KEYS.all(userId), 'unread'] as const,
} as const;

// ============================================================================
// User Query Keys
// ============================================================================
// Keys for all user-related queries
// ============================================================================
export const USER_KEYS = {
  // Base key for all user-related queries
  all: ['users'] as const,

  // Current authenticated user
  // Usage: queryKey: USER_KEYS.current()
  current: () => [...USER_KEYS.all, 'current'] as const,

  // Single user by ID
  detail: (id: number | string) => [...USER_KEYS.all, id] as const,
} as const;

// ============================================================================
// Friend Query Keys
// ============================================================================
// Keys for all friend-related queries
// ============================================================================
export const FRIEND_KEYS = {
  // Base key for all friend-related queries
  all: ['friends'] as const,

  // List of friends for a user
  lists: (userId: number) => [...FRIEND_KEYS.all, userId, 'list'] as const,

  // Friend requests for a user
  requests: (userId: number) => [...FRIEND_KEYS.all, userId, 'requests'] as const,
} as const;
