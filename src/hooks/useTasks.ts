// ============================================================================
// useTasks Hook - React Query Hook for Tasks
// ============================================================================
// 
// This hook provides a standardized way to fetch and manage tasks
// using React Query for caching and state management.
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/db';
import { currentUser } from '@/lib/mockData';
import type { Task, TaskStatusEntity, CompletionLog, DifficultyRating } from '@/types';
import { handleError } from '@/lib/errorUtils';
import { toast } from 'sonner';
import { getTodayTasks, getProjectTasks, getUserTasks } from '@/lib/taskFilterUtils';

/**
 * Hook to fetch all tasks
 */
export const useTasks = (filters?: { projectId?: string; userId?: string; status?: Task['status'] }) => {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      return await db.getTasks(filters);
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};

/**
 * Hook to fetch a single task by ID
 */
export const useTask = (taskId: string | undefined) => {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => {
      if (!taskId) return null;
      return await db.getTask(taskId);
    },
    enabled: !!taskId,
    staleTime: 1000 * 60 * 2,
  });
};

/**
 * Hook to fetch today's tasks
 */
export const useTodayTasks = () => {
  return useQuery({
    queryKey: ['tasks', 'today', currentUser.id],
    queryFn: async () => {
      const allTasks = await db.getTasks({ userId: currentUser.id });
      return getTodayTasks(allTasks, currentUser.id);
    },
    staleTime: 1000 * 60, // 1 minute (today's tasks change frequently)
  });
};

/**
 * Hook to fetch tasks for a specific project
 */
export const useProjectTasks = (projectId: string | undefined) => {
  return useQuery({
    queryKey: ['tasks', 'project', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const allTasks = await db.getTasks({ projectId });
      return getProjectTasks(allTasks, projectId);
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

  return useMutation({
    mutationFn: async (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
      return await db.createTask(data);
    },
    onSuccess: (newTask) => {
      // Invalidate and refetch tasks
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      const toastTitle = 'Task initiated! 🚀';
      toast.success(toastTitle, {
        description: 'Waiting for your friend to accept'
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
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) => {
      return await db.updateTask(id, data);
    },
    onSuccess: (updatedTask) => {
      // Invalidate and refetch tasks
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', updatedTask.id] });
    },
    onError: (error) => {
      handleError(error, 'useUpdateTask');
    },
  });
};

/**
 * Hook to update task status
 */
export const useUpdateTaskStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TaskStatusEntity> }) => {
      return await db.updateTaskStatus(id, data);
    },
    onSuccess: () => {
      // Invalidate and refetch tasks
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      handleError(error, 'useUpdateTaskStatus');
    },
  });
};

