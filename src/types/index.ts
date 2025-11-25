// ============================================================================
// Database Entity Types (matches ERD for future backend integration)
// ============================================================================

export type TaskStatus = 'draft' | 'initiated' | 'pending_acceptance' | 'accepted' | 'completed';
export type TaskType = 'one_off' | 'recurring';
export type RecurrencePattern = 'daily' | 'weekly' | 'custom';
export type DifficultyRating = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

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
  stats: UserStats;
}

export interface UserStats {
  totalCompletedTasks: number; // Renamed from totalCompleted for clarity
  currentStreak: number;
  longestStreak: number;
  score: number; // Can be derived from completions and difficulty
}

/**
 * Project Entity
 * Collaborative projects with participants
 */
export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string; // User who created the project
  participantIds: string[]; // Array of user IDs (normalized for DB)
  totalTasksPlanned: number; // Set by creator when project is created
  createdAt: Date;
  updatedAt: Date;
  color?: string; // UI preference, not in core ERD but useful for frontend
  
  // Computed/derived fields (not stored in DB, calculated on the fly)
  participants?: User[]; // Populated from participantIds for frontend convenience
  completedTasks?: number; // Derived from tasks
  progress?: number; // Derived: completedTasks / totalTasksPlanned
}

/**
 * Task Entity
 * Individual tasks within a project
 */
export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  creatorId: string; // User who created the task
  assigneeId: string; // Friend assigned to the task
  type: TaskType;
  recurrencePattern?: RecurrencePattern; // For recurring tasks
  status: TaskStatus;
  initiatedAt?: Date; // When task was initiated (moved from draft)
  acceptedAt?: Date; // When assignee accepted
  completedAt?: Date; // When both users completed
  dueDate?: Date;
  initiatedByUserId: string; // Who initiated (usually creatorId)
  isMirrorCompletionVisible: boolean; // Both users see each other's completion status
  
  // Completion tracking (normalized to CompletionLog in DB, but kept here for convenience)
  completions: {
    [userId: string]: {
      completed: boolean;
      completedAt?: Date;
      difficultyRating?: DifficultyRating;
    };
  };
  
  // Legacy fields for backward compatibility during migration
  createdAt?: Date; // Maps to initiatedAt
  difficultyRating?: DifficultyRating; // Should be in CompletionLog, kept for convenience
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
  difficultyRating?: DifficultyRating; // 1-10 scale
}

/**
 * Notification Entity
 * User notifications (email-ready)
 */
export interface Notification {
  id: string;
  userId: string;
  type: 'task_initiated' | 'task_accepted' | 'task_completed' | 'streak_reminder';
  message: string;
  taskId?: string;
  projectId?: string;
  createdAt: Date;
  isRead: boolean; // Renamed from 'read' for clarity
}

// ============================================================================
// Helper Types for Forms and UI
// ============================================================================

export type TaskStatusDisplay = 'pending' | 'accepted' | 'completed'; // Simplified for UI
