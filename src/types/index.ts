// ============================================================================
// Database Entity Types (matches ERD for future backend integration)
// ============================================================================

export type TaskStatus =
  | 'draft'
  | 'initiated'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired';
export type TaskType = 'one_off' | 'habit';
export type RecurrencePattern = 'daily' | 'weekly' | 'custom';
export type DifficultyRating = 1 | 2 | 3 | 4 | 5;
export type ProjectRole = 'owner' | 'manager' | 'participant';
export type AssignmentStatus = 'invited' | 'active' | 'declined' | 'completed' | 'missed' | 'archived';
export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';
export const TASK_STATUSES: TaskStatus[] = ['draft', 'initiated', 'scheduled', 'in_progress', 'completed', 'cancelled', 'expired'];
export const TASK_TYPES: TaskType[] = ['one_off', 'habit'];
export const RECURRENCE_PATTERNS: RecurrencePattern[] = ['daily', 'weekly', 'custom'];
export const DIFFICULTY_RATINGS: DifficultyRating[] = [1, 2, 3, 4, 5];
export const PROJECT_ROLES: ProjectRole[] = ['owner', 'manager', 'participant'];
export const ASSIGNMENT_STATUSES: AssignmentStatus[] = ['invited', 'active', 'declined', 'completed', 'missed', 'archived'];
export const PROPOSAL_STATUSES: ProposalStatus[] = ['pending', 'accepted', 'rejected', 'cancelled'];

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
  userId: string;
  totalCompletedTasks: number; // Renamed from totalCompleted for clarity
  currentStreak: number;
  longestStreak: number;
  score: number; // Can be derived from completions and difficulty // TBU
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
  isPublic: boolean; // Public or private project
  createdAt: Date;
  updatedAt: Date;
  color?: string; // UI preference, not in core ERD but useful for frontend
  
  // Computed/derived fields (not stored in DB, calculated on the fly)
  participants?: User[]; // Populated from participantIds for frontend convenience
  participantRoles?: ProjectParticipant[]; // Mirrors project_participants table
  completedTasks?: number; // Derived from tasks
  progress?: number; // Derived: completedTasks / totalTasksPlanned
}

export interface ProjectParticipant {
  projectId: string;
  userId: string;
  role: ProjectRole;
  user?: User;
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
  type: TaskType;
  recurrencePattern?: RecurrencePattern; // For habit-style repeating tasks (UI only)
  status: TaskStatus;
  dueDate: Date;
  difficultyRating: DifficultyRating; // Stored at task level (seed for assignments)
  createdAt: Date;
  updatedAt: Date;
  assignments: TaskAssignment[]; // Per-user state, mirrors task_assignments table
  timeProposals?: TaskTimeProposal[]; // Pending or historical time proposals
  initiatedAt?: Date; // When task was initiated (moved from draft)
  acceptedAt?: Date; // When assignee accepted
  completedAt?: Date; // When both users completed
  isMirrorCompletionVisible: boolean; // Both users see each other's completion status
  
  // Completion tracking (normalized to CompletionLog in DB, but kept here for convenience)
  completions: Record<string, CompletionState>;
}

export interface CompletionState {
      completed: boolean;
      completedAt?: Date;
      difficultyRating?: DifficultyRating;
}

export interface TaskAssignment {
  id: string;
  taskId: string;
  userId: string;
  status: AssignmentStatus;
  isRequired: boolean;
  effectiveDueDate: Date;
  archivedAt?: Date;
  recoveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskTimeProposal {
  id: string;
  taskId: string;
  proposerId: string;
  proposedDueDate: Date;
  status: ProposalStatus;
  createdAt: Date;
  respondedAt?: Date;
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
  difficultyRating?: DifficultyRating; // 1-5 scale
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
  isRead: boolean; // Renamed from 'read' for clarity
  emailSent?: boolean; // Track if email notification was sent
}

export type NotificationType =
  | 'task_initiated'
  | 'task_accepted'
  | 'task_declined'
  | 'task_time_proposed'
  | 'task_completed'
  | 'streak_reminder'
  | 'project_joined';
export const NOTIFICATION_TYPES: NotificationType[] = [
  'task_initiated',
  'task_accepted',
  'task_declined',
  'task_time_proposed',
  'task_completed',
  'streak_reminder',
  'project_joined'
];

// ============================================================================
// Helper Types for Forms and UI
// ============================================================================

export type TaskStatusDisplay = 'pending' | 'accepted' | 'completed'; // Simplified for UI
