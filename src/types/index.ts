// ============================================================================
// Database Entity Types - Single Source of Truth
// ============================================================================
// This file defines the canonical types used throughout the application.
// All types use camelCase naming and Date objects for optimal frontend DX.
//
// The data access layer (src/lib/db.ts) handles:
// - Transformation between database (snake_case, ISO strings) and these types
// - Works seamlessly with both Supabase and mock data
// - Components never see database-specific formats
// ============================================================================

export type TaskStatus = |'active'| 'upcoming'|'completed'|'archived' |'recovered';
export type TaskType = 'one_off' | 'habit';
export type RecurrencePattern = 'Daily' | 'weekly' | 'custom';
export type DifficultyRating = 1 | 2 | 3 | 4 | 5;
export type ProjectRole = 'owner' | 'manager' | 'participant';
export type RingColor = 'green' | 'yellow' | 'red' | 'none';

export const TASK_STATUS: TaskStatus[] = ['active', 'upcoming', 'completed', 'archived', 'recovered'];
export const TASK_TYPES: TaskType[] = ['one_off', 'habit'];
export const RECURRENCE_PATTERNS: RecurrencePattern[] = ['Daily', 'weekly', 'custom'];
export const DIFFICULTY_RATINGS: DifficultyRating[] = [1, 2, 3, 4, 5];
export const PROJECT_ROLES: ProjectRole[] = ['owner', 'manager', 'participant'];
export const RING_COLORS: RingColor[] = ['green', 'yellow', 'red', 'none'];

export type NotificationType =
  | 'task_created'
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
  'task_created',
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

// User Entity - Core user information and summary statistics
export interface User {
  id: number;
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
  userId: number;
  totalCompletedTasks: number;
  currentStreak: number;
  longestStreak: number;
  totalscore: number;
  updatedAt: Date;
}

// Project Entity - Collaborative projects with participants
export interface Project {
  id: number;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  ownerId: number;
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
  projectId: number;
  userId: number;
  role: ProjectRole;
  addedAt: Date;
  removedAt?: Date;
  // user?: User; // Computed/derived field for frontend convenience keyword
}

 // Task Entity - Individual tasks within a project

export interface Task {
  id: number;
  projectId: number;
  creatorId: number;
  title: string;
  description?: string;
  type: TaskType;
  recurrencePattern?: RecurrencePattern;
  dueDate: Date;
  createdAt?: Date;
  updatedAt: Date;
  
  // Computed/derived fields (not stored in DB, calculated on the fly)
  taskStatus?: TaskStatusEntity[];
  recurrence?: TaskRecurrence;
}

// TaskStatus Entity - Per-user task status tracking (replaces TaskAssignment)
export interface TaskStatusEntity {
  id: number;
  taskId: number;
  userId: number;
  status: TaskStatus;
  archivedAt?: Date;
  recoveredAt?: Date;
  ringColor?: RingColor;
  // dueDate?: Date; keyword
  // createdAt?: Date; keyword
  // updatedAt: Date; keyword
  
  // Computed/derived fields
  user?: User;
  task?: Task;
}

// TaskRecurrence Entity - Handles recurring tasks (habits)
 
export interface TaskRecurrence {
  id: number;
  taskId: number;
  recurrencePattern: RecurrencePattern;
  recurrenceInterval: number;
  nextOccurrence: Date;
  endOfRecurrence?: Date;
  
  // Computed/derived fields
  task?: Task;
}

// CompletionLog Entity - Records individual task completions for score and streak calculation 
export interface CompletionLog {
  id: number;
  userId: number;
  taskId: number;
  // completedAt: Date; keyword
  difficultyRating?: DifficultyRating;
  // recoveredCompletion: boolean; keyword
  penaltyApplied: boolean;
  xpEarned: number;
  createdAt: Date;
}

// Notification Entity - User notifications (email-ready)

export interface Notification {
  id: number;
  userId: number;
  type: NotificationType;
  message: string;
  taskId?: number;
  projectId?: number;
  createdAt: Date;
  isRead: boolean;
  emailSent: boolean;
}

export type TaskAssignment = TaskStatusEntity;
export type AssignmentStatus = TaskStatus;
export const ASSIGNMENT_STATUSES = TASK_STATUS;
export type TaskStatusDisplay = 'active' |'completed' |'archived' |'recovered'|'upcoming';
