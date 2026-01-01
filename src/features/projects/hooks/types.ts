// ============================================================================
// Project Hooks - Shared Types
// ============================================================================

import type {
  Task,
  Project,
  TaskStatusEntity,
  CompletionLog,
  ProjectParticipant,
  User,
  ProjectRole,
  DifficultyRating
} from '@/types';

/**
 * Task creation input data
 */
export interface TaskCreationData {
  title: string;
  description: string;
  projectId: number;
  type: 'one_off' | 'habit';
  recurrencePattern?: 'Daily' | 'weekly' | 'custom';
  dueDate?: Date;
  customRecurrence?: {
    frequency: 'days' | 'weeks' | 'months';
    interval: number;
    daysOfWeek: number[];
    endType: 'date' | 'count';
    endDate?: Date;
    occurrenceCount: number;
  };
  showRecurrenceIndex?: boolean;
}

/**
 * Project data with participants
 */
export interface ProjectWithParticipants extends Project {
  participants: User[];
  participantRoles: ProjectParticipant[];
}

/**
 * Task state for the project detail view
 */
export interface ProjectTaskState {
  tasks: Task[];
  taskStatuses: TaskStatusEntity[];
  completionLogs: CompletionLog[];
  setLocalTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  setLocalTaskStatuses: React.Dispatch<React.SetStateAction<TaskStatusEntity[]>>;
  setLocalCompletionLogs: React.Dispatch<React.SetStateAction<CompletionLog[]>>;
}

/**
 * Grouped habit tasks (a series)
 */
export interface HabitSeries {
  title: string;
  description?: string;
  recurrencePattern?: string;
  tasks: Task[];
}

/**
 * Categorized tasks for display
 */
export interface CategorizedTasks {
  activeTasks: Task[];
  upcomingTasks: Task[];
  completedTasks: Task[];
  archivedTasks: Task[];
  habitTasks: HabitSeries[];
  projectTasks: Task[];
  hasAnyAllTabContent: boolean;
}

/**
 * Project permissions
 */
export interface ProjectPermissions {
  isOwner: boolean;
  isManager: boolean;
  canManage: boolean;
  canLeave: boolean;
}

/**
 * Member with user data
 */
export interface ParticipantWithUser extends ProjectParticipant {
  user?: User;
}

