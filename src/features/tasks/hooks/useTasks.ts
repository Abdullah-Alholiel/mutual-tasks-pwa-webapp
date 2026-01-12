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
// Import atomic operations at top level to avoid dynamic require issues
import { createTaskAtomic, type AtomicTaskInput } from '@/lib/tasks/atomicTaskOperations';

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
      const toastTitle = 'Task created! 🚀';
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

      console.log('[useCreateTaskWithStatuses] Using atomic creation for:', input.task.title);

      // Helper to map type to atomic input format
      const atomicInput: AtomicTaskInput = {
        projectId: Number(input.task.projectId),
        creatorId: Number(input.task.creatorId),
        title: input.task.title,
        description: input.task.description,
        type: (input.task.type || 'one_off') as 'one_off' | 'habit',
        recurrencePattern: input.task.recurrencePattern,
        dueDate: input.dueDate,
        recurrenceIndex: input.task.recurrenceIndex,
        recurrenceTotal: input.task.recurrenceTotal,
        showRecurrenceIndex: input.task.showRecurrenceIndex,
        participantUserIds: input.participantUserIds,
      };

      try {
        const result = await createTaskAtomic(atomicInput);

        // Reconstruct expected return format for UI
        return {
          task: result.task,
          // Create optimisitic status objects for immediate UI update
          taskStatuses: input.participantUserIds.map(uid => ({
            id: -1, // Temporary ID for optimistic UI
            taskId: result.task.id,
            userId: uid,
            status: 'active' as const,
          }) as TaskStatusEntity),
        };
      } catch (error) {
        console.error('[useCreateTaskWithStatuses] Atomic creation failed:', error);
        throw error;
      }
    },
    onSuccess: (result) => {
      // CRITICAL: Remove stale cache and force fresh DB fetch
      queryClient.removeQueries({ queryKey: ['tasks'] });
      queryClient.refetchQueries({ queryKey: ['tasks'] });
      queryClient.refetchQueries({ queryKey: ['project', result.task.projectId] });
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

      const results: { task: Task; taskStatuses: TaskStatusEntity[] }[] = [];

      console.log(`[useCreateMultipleTasksWithStatuses] Creating ${inputs.length} tasks atomically`);

      // Create each task with its statuses atomically
      for (const input of inputs) {
        // Helper to map type to atomic input format
        const atomicInput: AtomicTaskInput = {
          projectId: Number(input.task.projectId),
          creatorId: Number(input.task.creatorId),
          title: input.task.title,
          description: input.task.description,
          type: (input.task.type || 'one_off') as 'one_off' | 'habit',
          recurrencePattern: input.task.recurrencePattern,
          dueDate: input.dueDate,
          recurrenceIndex: input.task.recurrenceIndex,
          recurrenceTotal: input.task.recurrenceTotal,
          showRecurrenceIndex: input.task.showRecurrenceIndex,
          participantUserIds: input.participantUserIds,
        };

        try {
          const result = await createTaskAtomic(atomicInput);

          results.push({
            task: result.task,
            taskStatuses: input.participantUserIds.map(uid => ({
              id: -1, // Temporary ID
              taskId: result.task.id,
              userId: uid,
              status: 'active' as const,
            }) as TaskStatusEntity),
          });
        } catch (error) {
          console.error(`[useCreateMultipleTasksWithStatuses] Failed to create one task in batch: ${input.task.title}`, error);
          // Fail all if any fail in a habit series to prevent partial state
          throw error;
        }
      }

      return results;
    },
    onSuccess: (results) => {
      // Get unique project IDs
      const projectIds = [...new Set(results.map(r => r.task.projectId))];

      // CRITICAL: Remove stale cache and force fresh DB fetch
      queryClient.removeQueries({ queryKey: ['tasks'] });
      queryClient.refetchQueries({ queryKey: ['tasks'] });

      projectIds.forEach(projectId => {
        queryClient.refetchQueries({ queryKey: ['project', projectId] });
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
 * Uses efficient single-query batch fetching to avoid N+1 waterfall
 */
export const useProjectCompletionLogs = (taskIds: number[]) => {
  return useQuery({
    queryKey: ['completionLogs', 'tasks', taskIds],
    queryFn: async () => {
      // If no tasks, return empty immediately
      if (taskIds.length === 0) return [];

      const db = getDatabaseClient();

      // OPTIMIZATION: Fetch ALL logs for these tasks in ONE query
      // Replaces previous N+1 loop: taskIds.map(id => db.getAll({ taskId: id }))
      return await db.completionLogs.getAllForTasks(taskIds);
    },
    enabled: taskIds.length > 0,
    staleTime: 1000 * 30, // 30 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};
