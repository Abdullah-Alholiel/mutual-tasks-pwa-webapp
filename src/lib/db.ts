// ============================================================================
// Unified Data Access Layer
// ============================================================================
// 
// This module provides a unified interface for data access that works
// seamlessly with both Supabase and mock data. Components use the same
// API regardless of the data source.
//
// Features:
// - Single set of types (camelCase, Date objects)
// - Automatic transformation between DB and frontend formats
// - Tree-shakeable and optimized
// - Matches Supabase query patterns exactly
// - Minimal latency with predictable response patterns
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
  TaskStatus,
  TaskType,
  NotificationType,
} from '@/types';

// Internal types for database rows (snake_case, ISO strings)
// These are only used internally for transformation
type UserRow = {
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

type UserStatsRow = {
  user_id: string;
  total_completed_tasks: number;
  current_streak: number;
  longest_streak: number;
  totalscore: number;
  updated_at: string;
};

type ProjectRow = {
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

type TaskRow = {
  id: string;
  project_id: string;
  creator_id: string;
  title: string;
  description?: string | null;
  type: TaskType;
  recurrence_pattern?: string | null;
  due_date: string;
  status: TaskStatus;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
};

type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  message: string;
  task_id?: string | null;
  project_id?: string | null;
  created_at: string;
  is_read: boolean;
  email_sent: boolean;
};

// ============================================================================
// Transformation Utilities (Internal)
// ============================================================================

function transformUserRow(row: UserRow, stats?: UserStats): User {
  return {
    id: row.id,
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

function transformUserStatsRow(row: UserStatsRow): UserStats {
  return {
    userId: row.user_id,
    totalCompletedTasks: row.total_completed_tasks,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    totalscore: row.totalscore,
    updatedAt: new Date(row.updated_at),
  };
}

function transformProjectRow(row: ProjectRow, participants?: ProjectParticipant[]): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon || undefined,
    color: row.color || undefined,
    ownerId: row.owner_id,
    isPublic: row.is_public,
    totalTasks: row.total_tasks,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    participantRoles: participants,
    participants: participants?.map(p => p.user).filter(Boolean) as User[] | undefined,
  };
}

function transformTaskRow(row: TaskRow, taskStatuses?: TaskStatusEntity[], recurrence?: TaskRecurrence): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    creatorId: row.creator_id,
    title: row.title,
    description: row.description || undefined,
    type: row.type,
    recurrencePattern: (row.recurrence_pattern as any) || undefined,
    dueDate: new Date(row.due_date),
    status: row.status,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    taskStatuses,
    recurrence,
  };
}

function transformNotificationRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    message: row.message,
    taskId: row.task_id || undefined,
    projectId: row.project_id || undefined,
    createdAt: new Date(row.created_at),
    isRead: row.is_read,
    emailSent: row.email_sent,
  };
}

// ============================================================================
// Data Access Interface
// ============================================================================

export interface DatabaseClient {
  // Users
  getUser(id: string): Promise<User | null>;
  getUserStats(userId: string): Promise<UserStats | null>;
  
  // Projects
  getProjects(filters?: { userId?: string; isPublic?: boolean }): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  createProject(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project>;
  updateProject(id: string, data: Partial<Project>): Promise<Project>;
  
  // Tasks
  getTasks(filters?: { projectId?: string; userId?: string; status?: TaskStatus }): Promise<Task[]>;
  getTask(id: string): Promise<Task | null>;
  createTask(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task>;
  updateTask(id: string, data: Partial<Task>): Promise<Task>;
  
  // Notifications
  getNotifications(userId: string, filters?: { isRead?: boolean }): Promise<Notification[]>;
  markNotificationRead(id: string): Promise<void>;
  
  // Task Status
  getTaskStatuses(taskId: string): Promise<TaskStatusEntity[]>;
  updateTaskStatus(id: string, data: Partial<TaskStatusEntity>): Promise<TaskStatusEntity>;
}

// ============================================================================
// Mock Data Client (for development)
// ============================================================================

import { 
  mockUsers, 
  mockProjects, 
  mockTasks, 
  mockNotifications,
  currentUser 
} from './mockData';

class MockDatabaseClient implements DatabaseClient {
  async getUser(id: string): Promise<User | null> {
    return mockUsers.find(u => u.id === id) || null;
  }

  async getUserStats(userId: string): Promise<UserStats | null> {
    const user = await this.getUser(userId);
    return user?.stats || null;
  }

  async getProjects(filters?: { userId?: string; isPublic?: boolean }): Promise<Project[]> {
    let projects = [...mockProjects];
    
    if (filters?.userId) {
      projects = projects.filter(p => 
        p.participants?.some(u => u.id === filters.userId) ||
        p.ownerId === filters.userId
      );
    }
    
    if (filters?.isPublic !== undefined) {
      projects = projects.filter(p => p.isPublic === filters.isPublic);
    }
    
    return projects;
  }

  async getProject(id: string): Promise<Project | null> {
    return mockProjects.find(p => p.id === id) || null;
  }

  async createProject(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const now = new Date();
    const project: Project = {
      ...data,
      id: `p${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    mockProjects.push(project);
    return project;
  }

  async updateProject(id: string, data: Partial<Project>): Promise<Project> {
    const project = await this.getProject(id);
    if (!project) throw new Error('Project not found');
    
    Object.assign(project, data, { updatedAt: new Date() });
    return project;
  }

  async getTasks(filters?: { projectId?: string; userId?: string; status?: TaskStatus }): Promise<Task[]> {
    let tasks = [...mockTasks];
    
    if (filters?.projectId) {
      tasks = tasks.filter(t => t.projectId === filters.projectId);
    }
    
    if (filters?.userId) {
      tasks = tasks.filter(t => 
        t.taskStatuses?.some(ts => ts.userId === filters.userId) ||
        t.creatorId === filters.userId
      );
    }
    
    if (filters?.status) {
      tasks = tasks.filter(t => t.status === filters.status);
    }
    
    return tasks;
  }

  async getTask(id: string): Promise<Task | null> {
    return mockTasks.find(t => t.id === id) || null;
  }

  async createTask(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const now = new Date();
    const task: Task = {
      ...data,
      id: `t${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    mockTasks.push(task);
    return task;
  }

  async updateTask(id: string, data: Partial<Task>): Promise<Task> {
    const task = await this.getTask(id);
    if (!task) throw new Error('Task not found');
    
    Object.assign(task, data, { updatedAt: new Date() });
    return task;
  }

  async getNotifications(userId: string, filters?: { isRead?: boolean }): Promise<Notification[]> {
    let notifications = mockNotifications.filter(n => n.userId === userId);
    
    if (filters?.isRead !== undefined) {
      notifications = notifications.filter(n => n.isRead === filters.isRead);
    }
    
    return notifications;
  }

  async markNotificationRead(id: string): Promise<void> {
    const notification = mockNotifications.find(n => n.id === id);
    if (notification) {
      notification.isRead = true;
    }
  }

  async getTaskStatuses(taskId: string): Promise<TaskStatusEntity[]> {
    const task = await this.getTask(taskId);
    return task?.taskStatuses || [];
  }

  async updateTaskStatus(id: string, data: Partial<TaskStatusEntity>): Promise<TaskStatusEntity> {
    // Find task status in all tasks
    for (const task of mockTasks) {
      const status = task.taskStatuses?.find(ts => ts.id === id);
      if (status) {
        Object.assign(status, data, { updatedAt: new Date() });
        return status;
      }
    }
    throw new Error('Task status not found');
  }
}

// ============================================================================
// Supabase Client (for production)
// ============================================================================

class SupabaseDatabaseClient implements DatabaseClient {
  private supabase: any; // Will be typed properly when Supabase is integrated

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

  async getUser(id: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;

    const stats = await this.getUserStats(id);
    return transformUserRow(data as UserRow, stats || undefined);
  }

  async getUserStats(userId: string): Promise<UserStats | null> {
    const { data, error } = await this.supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    return transformUserStatsRow(data as UserStatsRow);
  }

  async getProjects(filters?: { userId?: string; isPublic?: boolean }): Promise<Project[]> {
    let query = this.supabase.from('projects').select('*');

    if (filters?.isPublic !== undefined) {
      query = query.eq('is_public', filters.isPublic);
    }

    if (filters?.userId) {
      // Join with project_participants
      query = query.or(`owner_id.eq.${filters.userId},project_participants.user_id.eq.${filters.userId}`);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    // Transform and fetch participants
    const projects = await Promise.all(
      data.map(async (row: ProjectRow) => {
        const { data: participants } = await this.supabase
          .from('project_participants')
          .select('*, users(*)')
          .eq('project_id', row.id);
        
        // Transform participants (simplified)
        return transformProjectRow(row);
      })
    );

    return projects;
  }

  async getProject(id: string): Promise<Project | null> {
    const { data, error } = await this.supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;

    const { data: participants } = await this.supabase
      .from('project_participants')
      .select('*, users(*)')
      .eq('project_id', id);

    return transformProjectRow(data as ProjectRow);
  }

  async createProject(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const row: Partial<ProjectRow> = {
      name: data.name,
      description: data.description,
      icon: data.icon || null,
      color: data.color || null,
      owner_id: data.ownerId,
      is_public: data.isPublic,
      total_tasks: data.totalTasks,
    };

    const { data: result, error } = await this.supabase
      .from('projects')
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    return transformProjectRow(result as ProjectRow);
  }

  async updateProject(id: string, data: Partial<Project>): Promise<Project> {
    const row: Partial<ProjectRow> = {};
    if (data.name !== undefined) row.name = data.name;
    if (data.description !== undefined) row.description = data.description;
    if (data.icon !== undefined) row.icon = data.icon || null;
    if (data.color !== undefined) row.color = data.color || null;
    if (data.isPublic !== undefined) row.is_public = data.isPublic;
    if (data.totalTasks !== undefined) row.total_tasks = data.totalTasks;

    const { data: result, error } = await this.supabase
      .from('projects')
      .update(row)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return transformProjectRow(result as ProjectRow);
  }

  async getTasks(filters?: { projectId?: string; userId?: string; status?: TaskStatus }): Promise<Task[]> {
    let query = this.supabase.from('tasks').select('*');

    if (filters?.projectId) {
      query = query.eq('project_id', filters.projectId);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((row: TaskRow) => transformTaskRow(row));
  }

  async getTask(id: string): Promise<Task | null> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;

    // Fetch related data
    const { data: taskStatuses } = await this.supabase
      .from('task_status')
      .select('*')
      .eq('task_id', id);

    return transformTaskRow(data as TaskRow);
  }

  async createTask(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const row: Partial<TaskRow> = {
      project_id: data.projectId,
      creator_id: data.creatorId,
      title: data.title,
      description: data.description || null,
      type: data.type,
      recurrence_pattern: data.recurrencePattern || null,
      due_date: data.dueDate.toISOString(),
      status: data.status,
      completed_at: data.completedAt?.toISOString() || null,
    };

    const { data: result, error } = await this.supabase
      .from('tasks')
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    return transformTaskRow(result as TaskRow);
  }

  async updateTask(id: string, data: Partial<Task>): Promise<Task> {
    const row: Partial<TaskRow> = {};
    if (data.title !== undefined) row.title = data.title;
    if (data.description !== undefined) row.description = data.description || null;
    if (data.status !== undefined) row.status = data.status;
    if (data.dueDate !== undefined) row.due_date = data.dueDate.toISOString();
    if (data.completedAt !== undefined) row.completed_at = data.completedAt?.toISOString() || null;

    const { data: result, error } = await this.supabase
      .from('tasks')
      .update(row)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return transformTaskRow(result as TaskRow);
  }

  async getNotifications(userId: string, filters?: { isRead?: boolean }): Promise<Notification[]> {
    let query = this.supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId);

    if (filters?.isRead !== undefined) {
      query = query.eq('is_read', filters.isRead);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error || !data) return [];

    return data.map((row: NotificationRow) => transformNotificationRow(row));
  }

  async markNotificationRead(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) throw error;
  }

  async getTaskStatuses(taskId: string): Promise<TaskStatusEntity[]> {
    const { data, error } = await this.supabase
      .from('task_status')
      .select('*')
      .eq('task_id', taskId);

    if (error || !data) return [];
    // Transform task statuses (simplified)
    return data.map((row: any) => ({
      id: row.id,
      taskId: row.task_id,
      userId: row.user_id,
      status: row.status,
      effectiveDueDate: new Date(row.effective_due_date),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  async updateTaskStatus(id: string, data: Partial<TaskStatusEntity>): Promise<TaskStatusEntity> {
    const row: any = {};
    if (data.status !== undefined) row.status = data.status;
    if (data.effectiveDueDate !== undefined) row.effective_due_date = data.effectiveDueDate.toISOString();

    const { data: result, error } = await this.supabase
      .from('task_status')
      .update(row)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    // Transform result (simplified)
    return {
      id: result.id,
      taskId: result.task_id,
      userId: result.user_id,
      status: result.status,
      effectiveDueDate: new Date(result.effective_due_date),
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let dbClient: DatabaseClient | null = null;

export function getDatabaseClient(): DatabaseClient {
  if (dbClient) return dbClient;

  // Check if Supabase is available
  const useSupabase = import.meta.env.VITE_USE_SUPABASE === 'true' || 
                      import.meta.env.VITE_SUPABASE_URL;

  if (useSupabase) {
    try {
      // Synchronously try to get Supabase client
      // In a real app, you'd initialize this at app startup
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseAnonKey) {
        // Import Supabase client dynamically
        import('@supabase/supabase-js').then(({ createClient }) => {
          const supabase = createClient(supabaseUrl, supabaseAnonKey);
          dbClient = new SupabaseDatabaseClient(supabase);
        }).catch(() => {
          // Fallback to mock if import fails
          dbClient = new MockDatabaseClient();
        });
      } else {
        dbClient = new MockDatabaseClient();
      }
    } catch (error) {
      console.warn('Supabase not configured, falling back to mock data:', error);
      dbClient = new MockDatabaseClient();
    }
  } else {
    // Default to mock client
    dbClient = new MockDatabaseClient();
  }

  return dbClient;
}

// Export the client instance
// Initialize immediately with mock, will upgrade to Supabase if available
export const db = getDatabaseClient();

