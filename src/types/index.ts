export type TaskStatus = 'pending' | 'accepted' | 'completed';
export type TaskType = 'one_off' | 'recurring';
export type RecurrencePattern = 'daily' | 'weekly' | 'custom';
export type DifficultyRating = 1 | 2 | 3 | 4 | 5;

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
  totalCompleted: number;
  currentStreak: number;
  longestStreak: number;
  score: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  participants: User[];
  totalTasksPlanned: number;
  completedTasks: number;
  createdAt: Date;
  color?: string;
}

export interface Task {
  id: string;
  projectId: string;
  creatorId: string;
  assigneeId: string;
  type: TaskType;
  recurrencePattern?: RecurrencePattern;
  title: string;
  description?: string;
  status: TaskStatus;
  createdAt: Date;
  acceptedAt?: Date;
  completedAt?: Date;
  dueDate?: Date;
  difficultyRating?: DifficultyRating;
  completions: {
    [userId: string]: {
      completed: boolean;
      completedAt?: Date;
      difficultyRating?: DifficultyRating;
    };
  };
}

export interface CompletionLog {
  id: string;
  userId: string;
  taskId: string;
  completedAt: Date;
  difficultyRating?: DifficultyRating;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'task_initiated' | 'task_accepted' | 'task_completed' | 'streak_reminder';
  message: string;
  taskId?: string;
  projectId?: string;
  read: boolean;
  createdAt: Date;
}
