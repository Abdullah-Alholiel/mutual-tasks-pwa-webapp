// ============================================================================
// useTasks Hook - React Query Hook for Tasks
// ============================================================================
// 
// This hook provides a standardized way to fetch and manage tasks
// using React Query for caching and state management.
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDatabaseClient } from '@/db';
import { useAuth } from '../../auth/useAuth';
import type { Task, TaskStatusEntity, CompletionLog, DifficultyRating } from '@/types';
import { handleError } from '@/lib/errorUtils';
import { toast } from 'sonner';
import { getTodayTasks, getProjectTasks, getUserTasks } from '../../../lib/tasks/taskFilterUtils';

/**
 * Hook to fetch all tasks with optional filters
 */
export const useTasks = (filters?: { projectId?: string | number; userId?: string | number }) => {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      const db = getDatabaseClient();
      const dbFilters: { projectId?: number; userId?: number } = {};

      if (filters?.projectId) {
        dbFilters.projectId = typeof filters.projectId === 'string' ? parseInt(filters.projectId) : filters.projectId;
      }

      if (filters?.userId) {
        dbFilters.userId = typeof filters.userId === 'string' ? parseInt(filters.userId) : filters.userId;
      }

      return await db.tasks.getAll(dbFilters);
    },
    staleTime: 1000 * 30, // 30 seconds - tasks change frequently
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when user returns to the tab
  });
};

/**
 * Hook to fetch a single task by ID
 */
export const useTask = (taskId: string | number | undefined) => {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => {
      if (!taskId) return null;

      const db = getDatabaseClient();
      const id = typeof taskId === 'string' ? parseInt(taskId) : taskId;
      return await db.tasks.getById(id);
    },
    enabled: !!taskId,
    staleTime: 1000 * 30, // 30 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};

/**
 * Hook to fetch today's tasks
 */
export const useTodayTasks = () => {
  const { user, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['tasks', 'today', user?.id],
    queryFn: async () => {
      if (!user || !isAuthenticated) return [];

      const db = getDatabaseClient();
      const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      const allTasks = await db.tasks.getAll({ userId });
      return getTodayTasks(allTasks, String(userId));
    },
    enabled: !!user && isAuthenticated,
    staleTime: 1000 * 30, // 30 seconds - tasks change frequently
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when user returns to the tab
  });
};

/**
 * Hook to fetch all user's tasks (for finding recovered tasks which may have past due dates)
 */
export const useUserTasks = () => {
  const { user, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['tasks', 'user', user?.id],
    queryFn: async () => {
      if (!user || !isAuthenticated) return [];

      const db = getDatabaseClient();
      const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      return await db.tasks.getAll({ userId });
    },
    enabled: !!user && isAuthenticated,
    staleTime: 1000 * 30, // 30 seconds - tasks change frequently
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when user returns to the tab
  });
};

/**
 * Hook to fetch tasks for a specific project
 */
export const useProjectTasks = (projectId: string | number | undefined) => {
  return useQuery({
    queryKey: ['tasks', 'project', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const db = getDatabaseClient();
      const id = typeof projectId === 'string' ? parseInt(projectId) : projectId;
      const allTasks = await db.tasks.getAll({ projectId: id });
      return getProjectTasks(allTasks, String(projectId));
    },
    enabled: !!projectId,
    staleTime: 1000 * 30, // 30 seconds - tasks change frequently
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when user returns to the tab
  });
};

/**
 * Hook to create a new task
 */
export const useCreateTask = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!user) {
        throw new Error('User must be authenticated to create a task');
      }

      const db = getDatabaseClient();
      return await db.tasks.create(data);
    },
    onSuccess: (newTask) => {
      // Invalidate and refetch tasks
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project', newTask.projectId] });
      const toastTitle = 'Task initiated! 🚀';
      toast.success(toastTitle, {
        description: 'Your friend has been notified.'
      });
      return newTask;
    },
    onError: (error) => {
      handleError(error, 'useCreateTask');
    },
  });
};

/**
 * Input type for creating a task with statuses
 */
export interface CreateTaskWithStatusesInput {
  task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;
  participantUserIds: number[];
  dueDate: Date;
}

/**
 * Hook to create a task with statuses for all participants - atomic operation
 * This ensures tasks are properly persisted to the database
 */
export const useCreateTaskWithStatuses = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateTaskWithStatusesInput) => {
      if (!user) {
        throw new Error('User must be authenticated to create a task');
      }

      const db = getDatabaseClient();
      
      // 1. Create the task in the database
      const createdTask = await db.tasks.create(input.task);
      
      // 2. Create task statuses for all participants
      // Only use fields that exist in the database: taskId, userId, status, archivedAt, recoveredAt, ringColor
      const taskStatuses: Omit<TaskStatusEntity, 'id'>[] = input.participantUserIds.map(userId => ({
        taskId: createdTask.id,
        userId: userId,
        status: 'active' as const,
        ringColor: undefined, // Default: no ring color for active tasks
      }));
      
      // Create all statuses in the database
      const createdStatuses = await db.taskStatus.createMany(taskStatuses);
      
      return {
        task: createdTask,
        taskStatuses: createdStatuses,
      };
    },
    onSuccess: (result) => {
      // Invalidate all relevant queries for proper refetching
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'project', result.task.projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', result.task.projectId] });
      queryClient.invalidateQueries({ queryKey: ['taskStatuses'] });
      return result;
    },
    onError: (error) => {
      handleError(error, 'useCreateTaskWithStatuses');
    },
  });
};

/**
 * Hook to create multiple tasks with statuses (for habit tasks)
 * Creates all tasks atomically in the database
 */
export const useCreateMultipleTasksWithStatuses = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (inputs: CreateTaskWithStatusesInput[]) => {
      if (!user) {
        throw new Error('User must be authenticated to create tasks');
      }

      if (inputs.length === 0) {
        throw new Error('No tasks to create');
      }

      const db = getDatabaseClient();
      const results: { task: Task; taskStatuses: TaskStatusEntity[] }[] = [];

      // Create each task with its statuses
      for (const input of inputs) {
        // Create the task
        const createdTask = await db.tasks.create(input.task);
        
        // Create task statuses for all participants
        // Only use fields that exist in the database: taskId, userId, status, archivedAt, recoveredAt, ringColor
        const taskStatuses: Omit<TaskStatusEntity, 'id'>[] = input.participantUserIds.map(userId => ({
          taskId: createdTask.id,
          userId: userId,
          status: 'active' as const,
          ringColor: undefined, // Default: no ring color for active tasks
        }));
        
        const createdStatuses = await db.taskStatus.createMany(taskStatuses);
        
        results.push({
          task: createdTask,
          taskStatuses: createdStatuses,
        });
      }

      return results;
    },
    onSuccess: (results) => {
      // Get unique project IDs
      const projectIds = [...new Set(results.map(r => r.task.projectId))];
      
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskStatuses'] });
      
      projectIds.forEach(projectId => {
        queryClient.invalidateQueries({ queryKey: ['tasks', 'project', projectId] });
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      });
      
      return results;
    },
    onError: (error) => {
      handleError(error, 'useCreateMultipleTasksWithStatuses');
    },
  });
};

/**
 * Hook to update a task
 */
export const useUpdateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string | number; data: Partial<Task> }) => {
      const db = getDatabaseClient();
      const taskId = typeof id === 'string' ? parseInt(id) : id;
      return await db.tasks.update(taskId, data);
    },
    onSuccess: (updatedTask) => {
      // Invalidate and refetch tasks
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', updatedTask.id] });
      queryClient.invalidateQueries({ queryKey: ['project', updatedTask.projectId] });
    },
    onError: (error) => {
      handleError(error, 'useUpdateTask');
    },
  });
};

/**
 * Hook to delete a task
 */
export const useDeleteTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string | number) => {
      const db = getDatabaseClient();
      const taskId = typeof id === 'string' ? parseInt(id) : id;
      await db.tasks.delete(taskId);
    },
    onSuccess: () => {
      // Invalidate and refetch tasks
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task deleted! 🗑️');
    },
    onError: (error) => {
      handleError(error, 'useDeleteTask');
    },
  });
};

/**
 * Hook to update task status
 */
export const useUpdateTaskStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string | number; data: Partial<TaskStatusEntity> }) => {
      const db = getDatabaseClient();
      const statusId = typeof id === 'string' ? parseInt(id) : id;
      return await db.taskStatus.update(statusId, data);
    },
    onSuccess: (updatedStatus) => {
      // Invalidate and refetch tasks
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', updatedStatus.taskId] });
    },
    onError: (error) => {
      handleError(error, 'useUpdateTaskStatus');
    },
  });
};

/**
 * Hook to create a completion log
 */
export const useCreateCompletionLog = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: Omit<CompletionLog, 'id' | 'createdAt'>) => {
      if (!user) {
        throw new Error('User must be authenticated to complete a task');
      }

      const db = getDatabaseClient();
      return await db.completionLogs.create(data);
    },
    onSuccess: (newLog) => {
      // Invalidate and refetch tasks
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', newLog.taskId] });
      queryClient.invalidateQueries({ queryKey: ['user', 'current', 'stats'] });
    },
    onError: (error) => {
      handleError(error, 'useCreateCompletionLog');
    },
  });
};

/**
 * Hook to fetch all task statuses for the current user
 */
export const useTaskStatuses = () => {
  const { user, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['taskStatuses', user?.id],
    queryFn: async () => {
      if (!user || !isAuthenticated) return [];

      const db = getDatabaseClient();
      const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      return await db.taskStatus.getByUserId(userId);
    },
    enabled: !!user && isAuthenticated,
    staleTime: 1000 * 30, // 30 seconds - task statuses change frequently
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when user returns to the tab
  });
};

/**
 * Hook to fetch all completion logs for the current user
 */
export const useCompletionLogs = () => {
  const { user, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['completionLogs', user?.id],
    queryFn: async () => {
      if (!user || !isAuthenticated) return [];

      const db = getDatabaseClient();
      const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      return await db.completionLogs.getAll({ userId });
    },
    enabled: !!user && isAuthenticated,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};

/**
 * Hook to fetch completion logs for specific task IDs
 */
export const useProjectCompletionLogs = (taskIds: number[]) => {
  return useQuery({
    queryKey: ['completionLogs', 'tasks', taskIds],
    queryFn: async () => {
      if (taskIds.length === 0) return [];

      const db = getDatabaseClient();
      // Fetch completion logs for all tasks in the project
      const allLogs: CompletionLog[] = [];
      
      // Batch fetch - get logs for each task
      const logPromises = taskIds.map(taskId => 
        db.completionLogs.getAll({ taskId })
      );
      
      const results = await Promise.all(logPromises);
      results.forEach(logs => allLogs.push(...logs));
      
      return allLogs;
    },
    enabled: taskIds.length > 0,
    staleTime: 1000 * 30, // 30 seconds - completion logs change when tasks are completed
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};
