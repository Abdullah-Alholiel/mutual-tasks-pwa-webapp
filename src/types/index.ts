// ============================================================================
// Database Entity Types - Single Source of Truth
// ============================================================================
// 
// This file defines the canonical types used throughout the application.
// All types use camelCase naming and Date objects for optimal frontend DX.
//
// The data access layer (src/lib/db.ts) handles:
// - Transformation between database (snake_case, ISO strings) and these types
// - Works seamlessly with both Supabase and mock data
// - Components never see database-specific formats
// ============================================================================

export type TaskStatus =
  | 'active'
  | 'upcoming'
  | 'completed'
  | 'archived';

export type TaskType = 'one_off' | 'habit';
export type RecurrencePattern = 'daily' | 'weekly' | 'custom';
export type DifficultyRating = 1 | 2 | 3 | 4 | 5;
export type ProjectRole = 'owner' | 'manager' | 'participant';
export type TaskStatusUserStatus = 'active' | 'completed' | 'archived';
export type TimingStatus = 'early' | 'on_time' | 'late';
export type RingColor = 'green' | 'yellow' | 'red' | 'none';

export const TASK_STATUSES: TaskStatus[] = ['active', 'upcoming', 'completed', 'archived'];
export const TASK_TYPES: TaskType[] = ['one_off', 'habit'];
export const RECURRENCE_PATTERNS: RecurrencePattern[] = ['daily', 'weekly', 'custom'];
export const DIFFICULTY_RATINGS: DifficultyRating[] = [1, 2, 3, 4, 5];
export const PROJECT_ROLES: ProjectRole[] = ['owner', 'manager', 'participant'];
export const TASK_STATUS_USER_STATUSES: TaskStatusUserStatus[] = ['active', 'completed', 'archived'];
export const TIMING_STATUSES: TimingStatus[] = ['early', 'on_time', 'late'];
export const RING_COLORS: RingColor[] = ['green', 'yellow', 'red', 'none'];

export type NotificationType =
  | 'task_initiated'
  | 'task_accepted'
  | 'task_declined'
  | 'task_completed'
  | 'task_recovered'
  | 'task_deleted'
  | 'task_overdue'
  | 'role_changed'
  | 'participant_removed'
  | 'project_joined'
  | 'project_left'
  | 'streak_reminder';

export const NOTIFICATION_TYPES: NotificationType[] = [
  'task_initiated',
  'task_accepted',
  'task_declined',
  'task_completed',
  'task_recovered',
  'task_deleted',
  'task_overdue',
  'role_changed',
  'participant_removed',
  'project_joined',
  'project_left',
  'streak_reminder'
];

// ============================================================================
// Core Entity Types
// ============================================================================

/**
 * User Entity
 * Core user information and summary statistics
 */
export interface User {
  id: string;
  name: string;
  handle: string;
  email: string;
  avatar: string;
  timezone: string;
  notificationPreferences?: Record<string, boolean>;
  createdAt: Date;
  updatedAt: Date;
  stats?: UserStats; // Computed/derived field for frontend convenience
}

export interface UserStats {
  userId: string;
  totalCompletedTasks: number;
  currentStreak: number;
  longestStreak: number;
  totalscore: number;
  updatedAt: Date;
}

/**
 * Project Entity
 * Collaborative projects with participants
 */
export interface Project {
  id: string;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  ownerId: string;
  isPublic: boolean;
  totalTasks: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Computed/derived fields (not stored in DB, calculated on the fly)
  participants?: User[];
  participantRoles?: ProjectParticipant[];
  completedTasks?: number;
  progress?: number;
}

export interface ProjectParticipant {
  projectId: string;
  userId: string;
  role: ProjectRole;
  addedAt: Date;
  removedAt?: Date;
  user?: User; // Computed/derived field for frontend convenience
}

/**
 * Task Entity
 * Individual tasks within a project
 */
export interface Task {
  id: string;
  projectId: string;
  creatorId: string;
  title: string;
  description?: string;
  type: TaskType;
  recurrencePattern?: RecurrencePattern;
  originalDueDate: Date;
  status: TaskStatus;
  initiatedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Computed/derived fields (not stored in DB, calculated on the fly)
  taskStatuses?: TaskStatusEntity[];
  recurrence?: TaskRecurrence;
}

/**
 * TaskStatus Entity
 * Per-user task status tracking (replaces TaskAssignment)
 */
export interface TaskStatusEntity {
  id: string;
  taskId: string;
  userId: string;
  status: TaskStatusUserStatus;
  effectiveDueDate: Date;
  initiatedAt?: Date;
  archivedAt?: Date;
  recoveredAt?: Date;
  timingStatus?: TimingStatus;
  ringColor?: RingColor;
  createdAt: Date;
  updatedAt: Date;
  
  // Computed/derived fields
  user?: User;
  task?: Task;
}

/**
 * CompletionLog Entity
 * Records individual task completions for streak calculation
 */
export interface CompletionLog {
  id: string;
  userId: string;
  taskId: string;
  completedAt: Date;
  difficultyRating?: DifficultyRating;
  timingStatus: TimingStatus;
  recoveredCompletion: boolean;
  penaltyApplied: boolean;
  xpEarned: number;
  createdAt: Date;
}

/**
 * Notification Entity
 * User notifications (email-ready)
 */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  taskId?: string;
  projectId?: string;
  createdAt: Date;
  isRead: boolean;
  emailSent: boolean;
}

/**
 * TaskRecurrence Entity
 * Handles recurring tasks (habits)
 */
export interface TaskRecurrence {
  id: string;
  taskId: string;
  recurrencePattern: RecurrencePattern;
  recurrenceInterval: number;
  nextOccurrence: Date;
  endOfRecurrence?: Date;
  
  // Computed/derived fields
  task?: Task;
}

// ============================================================================
// Backward Compatibility Aliases
// ============================================================================

/**
 * @deprecated Use TaskStatusEntity instead
 * Kept for backward compatibility with existing components
 */
export type TaskAssignment = TaskStatusEntity;

/**
 * @deprecated Use TaskStatusUserStatus instead
 * Kept for backward compatibility with existing components
 */
export type AssignmentStatus = TaskStatusUserStatus;

/**
 * @deprecated Use TASK_STATUS_USER_STATUSES instead
 * Kept for backward compatibility with migration scripts
 */
export const ASSIGNMENT_STATUSES = TASK_STATUS_USER_STATUSES;

// ============================================================================
// Helper Types for Forms and UI
// ============================================================================

export type TaskStatusDisplay = 'active' | 'completed' | 'archived';
