// ============================================================================
// useTasks Hook - React Query Hook for Tasks
// ============================================================================
// 
// This hook provides a standardized way to fetch and manage tasks
// using React Query for caching and state management.
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDatabaseClient } from '@/db';
import { useAuth } from './useAuth';
import type { Task, TaskStatusEntity, CompletionLog, DifficultyRating } from '@/types';
import { handleError } from '@/lib/errorUtils';
import { toast } from 'sonner';
import { getTodayTasks, getProjectTasks, getUserTasks } from '@/lib/taskFilterUtils';

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
    staleTime: 1000 * 60 * 2, // 2 minutes
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
    staleTime: 1000 * 60 * 2,
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
    staleTime: 1000 * 60, // 1 minute (today's tasks change frequently)
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
    staleTime: 1000 * 60 * 2,
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
