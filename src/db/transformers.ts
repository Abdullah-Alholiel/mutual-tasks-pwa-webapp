// ============================================================================
// Database Transformers - Convert between DB and Frontend Types
// ============================================================================
// 
// This module handles transformation between database formats (snake_case, 
// string IDs, ISO date strings) and frontend types (camelCase, number IDs, 
// Date objects).
// ============================================================================

import type {
  User,
  UserStats,
  Project,
  ProjectParticipant,
  Task,
  TaskStatusEntity,
  CompletionLog,
  Notification,
  TaskRecurrence,
} from '@/types';

import { normalizeLegacyColors } from '@/lib/projectColorMigration';

// ============================================================================
// Database Row Types (snake_case, string IDs, ISO strings)
// ============================================================================

export type UserRow = {
  id: string;
  name: string;
  handle: string;
  email: string;
  avatar: string;
  timezone: string;
  notification_preferences?: Record<string, boolean> | null;
  created_at: string;
  updated_at: string;
};

export type UserStatsRow = {
  user_id: string;
  total_completed_tasks: number;
  current_streak: number;
  longest_streak: number;
  totalscore: number;
  updated_at: string;
};

export type ProjectRow = {
  id: string;
  name: string;
  description: string;
  icon?: string | null;
  color?: string | null;
  owner_id: string;
  is_public: boolean;
  total_tasks: number;
  created_at: string;
  updated_at: string;
};

export type ProjectParticipantRow = {
  project_id: string;
  user_id: string;
  role: string;
  added_at: string;
  removed_at?: string | null;
  user?: UserRow | null; // From join
};

export type TaskRow = {
  id: string;
  project_id: string;
  creator_id: string;
  title: string;
  description?: string | null;
  type: string;
  recurrence_pattern?: string | null;
  recurrence_index?: number | null;
  recurrence_total?: number | null;
  show_recurrence_index?: boolean;
  due_date: string;
  created_at?: string | null;
  updated_at: string;
};

export type TaskStatusRow = {
  id: string;
  task_id: string;
  user_id: string;
  status: string;
  archived_at?: string | null;
  recovered_at?: string | null;
  ring_color?: string | null;
};

export type TaskRecurrenceRow = {
  id: string;
  task_id: string;
  recurrence_pattern: string;
  recurrence_interval: number;
  next_occurrence: string;
  end_of_recurrence?: string | null;
};

export type CompletionLogRow = {
  id: string;
  user_id: string;
  task_id: string;
  difficulty_rating?: number | null;
  penalty_applied: boolean;
  xp_earned: number;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  message: string;
  task_id?: string | null;
  project_id?: string | null;
  created_at: string;
  is_read: boolean;
  email_sent: boolean;
};

// ============================================================================
// ID Conversion Utilities
// ============================================================================

/**
 * Convert string ID from database to number ID for frontend
 */
export const toNumberId = (id: string | number): number => {
  if (typeof id === 'number') return id;
  const num = Number(id);
  if (isNaN(num)) throw new Error(`Invalid ID: ${id}`);
  return num;
};

/**
 * Convert number ID from frontend to string ID for database
 */
export const toStringId = (id: number | string): string => {
  return String(id);
};

// ============================================================================
// Transformation Functions
// ============================================================================

export function transformUserRow(row: UserRow, stats?: UserStats): User {
  return {
    id: toNumberId(row.id),
    name: row.name,
    handle: row.handle,
    email: row.email,
    avatar: row.avatar,
    timezone: row.timezone,
    notificationPreferences: row.notification_preferences || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    stats,
  };
}

export function transformUserStatsRow(row: UserStatsRow): UserStats {
  return {
    userId: toNumberId(row.user_id),
    totalCompletedTasks: row.total_completed_tasks,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    totalscore: row.totalscore,
    updatedAt: new Date(row.updated_at),
  };
}

export function transformProjectRow(
  row: ProjectRow,
  participants?: ProjectParticipant[]
): Project {
  return {
    id: toNumberId(row.id),
    name: row.name,
    description: row.description,
    icon: row.icon || undefined,
    color: row.color || undefined,
    ownerId: toNumberId(row.owner_id),
    isPublic: row.is_public,
    totalTasks: row.total_tasks,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    participants: participants?.map(p => p.user).filter((u): u is User => u !== undefined),
    participantRoles: participants,
  };
}

export function transformProjectParticipantRow(
  row: ProjectParticipantRow
): ProjectParticipant {
  return {
    projectId: toNumberId(row.project_id),
    userId: toNumberId(row.user_id),
    role: row.role as ProjectParticipant['role'],
    addedAt: new Date(row.added_at),
    removedAt: row.removed_at ? new Date(row.removed_at) : undefined,
    user: row.user ? transformUserRow(row.user) : undefined,
  };
}

export function transformTaskRow(
  row: TaskRow,
  taskStatuses?: TaskStatusEntity[],
  recurrence?: TaskRecurrence
): Task {
  return {
    id: toNumberId(row.id),
    projectId: toNumberId(row.project_id),
    creatorId: toNumberId(row.creator_id),
    title: row.title,
    description: row.description || undefined,
    type: row.type as Task['type'],
    recurrencePattern: (row.recurrence_pattern as Task['recurrencePattern']) || undefined,
    recurrenceIndex: row.recurrence_index || undefined,
    recurrenceTotal: row.recurrence_total || undefined,
    showRecurrenceIndex: row.show_recurrence_index || false,
    dueDate: new Date(row.due_date),
    createdAt: row.created_at ? new Date(row.created_at) : undefined,
    updatedAt: new Date(row.updated_at),
    taskStatus: taskStatuses,
    recurrence,
  };
}

export function transformTaskStatusRow(row: TaskStatusRow): TaskStatusEntity {
  return {
    id: toNumberId(row.id),
    taskId: toNumberId(row.task_id),
    userId: toNumberId(row.user_id),
    status: row.status as TaskStatusEntity['status'],
    archivedAt: row.archived_at ? new Date(row.archived_at) : undefined,
    recoveredAt: row.recovered_at ? new Date(row.recovered_at) : undefined,
    ringColor: (row.ring_color as TaskStatusEntity['ringColor']) || undefined,
  };
}

export function transformTaskRecurrenceRow(row: TaskRecurrenceRow): TaskRecurrence {
  return {
    id: toNumberId(row.id),
    taskId: toNumberId(row.task_id),
    recurrencePattern: row.recurrence_pattern as TaskRecurrence['recurrencePattern'],
    recurrenceInterval: row.recurrence_interval,
    nextOccurrence: new Date(row.next_occurrence),
    endOfRecurrence: row.end_of_recurrence ? new Date(row.end_of_recurrence) : undefined,
  };
}

export function transformCompletionLogRow(row: CompletionLogRow): CompletionLog {
  return {
    id: toNumberId(row.id),
    userId: toNumberId(row.user_id),
    taskId: toNumberId(row.task_id),
    difficultyRating: (row.difficulty_rating as CompletionLog['difficultyRating']) || undefined,
    penaltyApplied: row.penalty_applied,
    xpEarned: row.xp_earned,
    createdAt: new Date(row.created_at),
  };
}

export function transformNotificationRow(row: NotificationRow): Notification {
  return {
    id: toNumberId(row.id),
    userId: toNumberId(row.user_id),
    type: row.type as Notification['type'],
    message: row.message,
    taskId: row.task_id ? toNumberId(row.task_id) : undefined,
    projectId: row.project_id ? toNumberId(row.project_id) : undefined,
    createdAt: new Date(row.created_at),
    isRead: row.is_read,
    emailSent: row.email_sent,
  };
}

// ============================================================================
// Reverse Transformations (Frontend -> Database)
// ============================================================================

export function toUserRow(user: Partial<User>): Partial<UserRow> {
  const row: Partial<UserRow> = {};
  if (user.name !== undefined) row.name = user.name;
  if (user.handle !== undefined) {
    // Enforce lowercase handles in database to prevent case-sensitivity issues
    const h = user.handle.trim().toLowerCase();
    row.handle = h.startsWith('@') ? h.slice(1) : h;
  }
  if (user.email !== undefined) row.email = user.email.toLowerCase();
  if (user.avatar !== undefined) row.avatar = user.avatar;
  if (user.timezone !== undefined) row.timezone = user.timezone;
  if (user.notificationPreferences !== undefined) {
    row.notification_preferences = user.notificationPreferences;
  }
  return row;
}

export function toProjectRow(project: Partial<Project>): Partial<ProjectRow> {
  const row: Partial<ProjectRow> = {};
  if (project.name !== undefined) row.name = project.name;
  if (project.description !== undefined) row.description = project.description;
  if (project.icon !== undefined) row.icon = project.icon || null;
  if (project.color !== undefined) row.color = normalizeLegacyColors(project.color) || null;
  if (project.ownerId !== undefined) row.owner_id = toStringId(project.ownerId);
  if (project.isPublic !== undefined) row.is_public = project.isPublic;
  if (project.totalTasks !== undefined) row.total_tasks = project.totalTasks;
  return row;
}

export function toTaskRow(task: Partial<Task>): Partial<TaskRow> {
  const row: Partial<TaskRow> = {};
  if (task.projectId !== undefined) row.project_id = toStringId(task.projectId);
  if (task.creatorId !== undefined) row.creator_id = toStringId(task.creatorId);
  if (task.title !== undefined) row.title = task.title;
  if (task.description !== undefined) row.description = task.description || null;
  if (task.type !== undefined) row.type = task.type;
  if (task.recurrencePattern !== undefined) {
    row.recurrence_pattern = task.recurrencePattern || null;
  }
  if (task.recurrenceIndex !== undefined) row.recurrence_index = task.recurrenceIndex;
  if (task.recurrenceTotal !== undefined) row.recurrence_total = task.recurrenceTotal;
  if (task.showRecurrenceIndex !== undefined) row.show_recurrence_index = task.showRecurrenceIndex;

  if (task.dueDate !== undefined) row.due_date = task.dueDate.toISOString();
  return row;
}

export function toTaskStatusRow(status: Partial<TaskStatusEntity>): Partial<TaskStatusRow> {
  const row: Partial<TaskStatusRow> = {};
  if (status.taskId !== undefined) row.task_id = toStringId(status.taskId);
  if (status.userId !== undefined) row.user_id = toStringId(status.userId);
  if (status.status !== undefined) row.status = status.status;
  // Always include archivedAt if it's in the status object (even if null) to ensure it's cleared in DB
  if (status.archivedAt !== undefined) {
    row.archived_at = status.archivedAt ? status.archivedAt.toISOString() : null;
  }
  if (status.recoveredAt !== undefined) {
    row.recovered_at = status.recoveredAt ? status.recoveredAt.toISOString() : null;
  }
  if (status.ringColor !== undefined) {
    row.ring_color = status.ringColor || null;
  }
  return row;
}

export function toCompletionLogRow(log: Partial<CompletionLog>): Partial<CompletionLogRow> {
  const row: Partial<CompletionLogRow> = {};
  if (log.userId !== undefined) row.user_id = toStringId(log.userId);
  if (log.taskId !== undefined) row.task_id = toStringId(log.taskId);
  if (log.difficultyRating !== undefined) {
    row.difficulty_rating = log.difficultyRating || null;
  }
  if (log.penaltyApplied !== undefined) row.penalty_applied = log.penaltyApplied;
  if (log.xpEarned !== undefined) row.xp_earned = log.xpEarned;
  return row;
}

export function toNotificationRow(notification: Partial<Notification>): Partial<NotificationRow> {
  const row: Partial<NotificationRow> = {};
  if (notification.userId !== undefined) row.user_id = toStringId(notification.userId);
  if (notification.type !== undefined) row.type = notification.type;
  if (notification.message !== undefined) row.message = notification.message;
  if (notification.taskId !== undefined) {
    row.task_id = notification.taskId ? toStringId(notification.taskId) : null;
  }
  if (notification.projectId !== undefined) {
    row.project_id = notification.projectId ? toStringId(notification.projectId) : null;
  }
  if (notification.isRead !== undefined) row.is_read = notification.isRead;
  if (notification.emailSent !== undefined) row.email_sent = notification.emailSent;
  return row;
}


