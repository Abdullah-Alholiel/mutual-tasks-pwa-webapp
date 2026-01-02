// ============================================================================
// useProjectTaskMutations - Task CRUD Operations for Project Detail
// ============================================================================

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Task, TaskStatusEntity, CompletionLog, DifficultyRating, TaskStatus, User, RingColor } from '@/types';
import { normalizeToStartOfDay } from '@/lib/tasks/taskUtils';
import { recoverTask } from '@/lib/tasks/taskRecoveryUtils';
import { validateProjectForTaskCreation, getParticipatingUserIds } from '@/lib/tasks/taskCreationUtils';
import { handleError } from '@/lib/errorUtils';
import { notifyTaskCreated, notifyTaskCompleted, notifyTaskRecovered } from '@/lib/tasks/taskEmailNotifications';
import { getDatabaseClient } from '@/db';
import {
  useCreateTaskWithStatuses,
  useCreateMultipleTasksWithStatuses,
  useUpdateTask,
  type CreateTaskWithStatusesInput
} from '../../tasks/hooks/useTasks';
import type { TaskCreationData, ProjectWithParticipants, ProjectTaskState } from './types';

interface UseProjectTaskMutationsParams {
  user: User | null;
  projectWithParticipants: ProjectWithParticipants | undefined;
  taskState: ProjectTaskState;
  onTaskFormClose: () => void;
}

/**
 * Hook for task mutation operations (create, complete, recover, delete)
 */
export const useProjectTaskMutations = ({
  user,
  projectWithParticipants,
  taskState,
  onTaskFormClose,
}: UseProjectTaskMutationsParams) => {
  const { tasks, taskStatuses, setLocalTasks, setLocalTaskStatuses, setLocalCompletionLogs } = taskState;
  const queryClient = useQueryClient();

  // Mutations for creating/updating tasks in the database
  const createTaskMutation = useCreateTaskWithStatuses();
  const createMultipleTasksMutation = useCreateMultipleTasksWithStatuses();
  const updateTaskMutation = useUpdateTask();

  /**
   * Get task status for a specific user
   */
  const getTaskStatusForUser = useCallback((taskId: number, userId: number): TaskStatusEntity | undefined => {
    return taskStatuses.find(ts => ts.taskId === taskId && ts.userId === userId);
  }, [taskStatuses]);

  /**
   * Recover an archived task
   */
  const handleRecover = useCallback(async (taskId: number) => {
    if (!user) return;

    const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    const projectId = projectWithParticipants?.id;
    const result = recoverTask(String(taskId), String(userId), tasks, taskStatuses);

    if (!result || !result.success) {
      handleError('Task not found or cannot be recovered', 'handleRecover');
      return;
    }

    try {
      const db = getDatabaseClient();

      // Persist task status update to database with ring color
      if (result.updatedTaskStatus) {
        await db.taskStatus.updateByTaskAndUser(taskId, userId, {
          status: 'recovered' as TaskStatus,
          recoveredAt: result.updatedTaskStatus.recoveredAt,
          archivedAt: undefined, // Clear archivedAt
          ringColor: 'yellow', // Yellow ring for recovered tasks
        });
      }

      // Update local task state immediately for instant UI feedback
      // Also update the embedded taskStatus array so TaskCard sees the change
      if (result.updatedTask && result.updatedTaskStatus) {
        setLocalTasks(prev =>
          prev.map(t => {
            if (t.id === taskId) {
              // Update the task and its embedded taskStatus array
              const updatedTaskStatuses = (t.taskStatus || []).map(ts => {
                const tsUserId = typeof ts.userId === 'string' ? parseInt(ts.userId) : ts.userId;
                if (tsUserId === userId) {
                  return result.updatedTaskStatus!;
                }
                return ts;
              });
              // If the user's task status wasn't in the array, add it
              const hasUserStatus = updatedTaskStatuses.some(ts => {
                const tsUserId = typeof ts.userId === 'string' ? parseInt(ts.userId) : ts.userId;
                return tsUserId === userId;
              });
              if (!hasUserStatus && result.updatedTaskStatus) {
                updatedTaskStatuses.push(result.updatedTaskStatus);
              }
              return {
                ...result.updatedTask!,
                taskStatus: updatedTaskStatuses,
              };
            }
            return t;
          })
        );
      }

      // Update local task status state immediately for instant UI feedback
      if (result.updatedTaskStatus) {
        setLocalTaskStatuses(prev => {
          const existingIndex = prev.findIndex(ts => {
            const tsTaskId = typeof ts.taskId === 'string' ? parseInt(ts.taskId) : ts.taskId;
            const tsUserId = typeof ts.userId === 'string' ? parseInt(ts.userId) : ts.userId;
            return tsTaskId === taskId && tsUserId === userId;
          });

          if (existingIndex >= 0) {
            return prev.map((ts, index) =>
              index === existingIndex ? result.updatedTaskStatus! : ts
            );
          } else {
            return [...prev, result.updatedTaskStatus];
          }
        });
      }

      // Invalidate React Query cache to ensure data freshness on refresh, especially for "Today" view
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['taskStatuses'] });

      // Force invalidate project-specific queries
      if (projectId) {
        await queryClient.invalidateQueries({ queryKey: ['tasks', 'project', projectId] });
        await queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      }

      // Specifically invalidate the user's task status to ensure UI updates
      await queryClient.invalidateQueries({ queryKey: ['taskStatuses', userId] });

      toast.success('Task recovered! 💪', {
        description: 'Complete it to earn half XP'
      });

      // Send recovery notification to other participants
      if (projectId) {
        notifyTaskRecovered(taskId, projectId, userId).catch(error => {
          console.error('Failed to send recovery notifications:', error);
        });
      }
    } catch (error) {
      handleError(error, 'handleRecover');
      toast.error('Failed to recover task', {
        description: 'Please try again'
      });
    }
  }, [user, tasks, taskStatuses, setLocalTasks, setLocalTaskStatuses, projectWithParticipants, queryClient]);

  /**
   * Complete a task with optional difficulty rating
   */
  const handleComplete = useCallback(async (taskId: number, difficultyRating?: number) => {
    if (!user) return;

    const now = new Date();
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      toast.error('Task not found');
      return;
    }

    const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    let myTaskStatus = getTaskStatusForUser(taskId, userId);

    const db = getDatabaseClient();

    // If task status doesn't exist, create it first (safety check)
    if (!myTaskStatus) {
      try {
        // Try to fetch from database
        myTaskStatus = await db.taskStatus.getByTaskAndUser(taskId, userId);

        // If still not found, create it
        if (!myTaskStatus) {
          myTaskStatus = await db.taskStatus.create({
            taskId,
            userId,
            status: 'active',
            ringColor: undefined,
          });

          // Add to local state
          setLocalTaskStatuses(prev => [...prev, myTaskStatus!]);
        }
      } catch (error) {
        handleError(error, 'handleComplete - create task status');
        toast.error('Task status not found', {
          description: 'Failed to create task status. Please try again.'
        });
        return;
      }
    }

    const isRecovered = myTaskStatus.recoveredAt !== undefined;
    const taskDueDate = task.dueDate;

    // Normalize dates to start of day for accurate comparison
    // Tasks completed on the due date should get full XP
    const normalizedNow = normalizeToStartOfDay(now);
    const normalizedDueDate = normalizeToStartOfDay(new Date(taskDueDate));
    const isOnOrBeforeDueDate = normalizedNow.getTime() <= normalizedDueDate.getTime();

    // For non-recovered tasks, check if late (completed after due date)
    // Late means completed on a day AFTER the due date (not on the due date itself)
    const isLate = !isRecovered && !isOnOrBeforeDueDate;

    // Calculate XP (baseXP is fixed, not dependent on difficulty):
    // - Recovered tasks: ALWAYS give fixed 100 XP
    // - Late tasks (not recovered): give half of base XP (100 XP)
    // - On-time tasks: give full base XP (200 XP)
    const baseXP = 200; // Fixed base XP, not dependent on difficulty
    let xpEarned: number;
    let penaltyApplied: boolean;

    if (isRecovered) {
      // Recovered tasks always give fixed 100 XP
      xpEarned = 100;
      penaltyApplied = true;
    } else if (isLate) {
      // Late tasks (not recovered) give half XP
      xpEarned = Math.floor(baseXP / 2);
      penaltyApplied = true;
    } else {
      // On-time tasks give full XP
      xpEarned = baseXP;
      penaltyApplied = false;
    }

    // Calculate ring color based on completion timing and recovery status
    // - Yellow: recovered task (completed after recovery)
    // - Green: on-time completion (before or on due date, not recovered)
    // - None: late completion (after due date, not recovered)
    const completionRingColor: RingColor = isRecovered ? 'yellow' : (isOnOrBeforeDueDate ? 'green' : 'none');

    try {
      // 1. Create completion log in database
      const newCompletionLog = await db.completionLogs.create({
        userId: userId,
        taskId: taskId,
        difficultyRating: difficultyRating as DifficultyRating | undefined,
        penaltyApplied,
        xpEarned,
      });

      // 2. Update task status in database
      await db.taskStatus.updateByTaskAndUser(taskId, userId, {
        status: 'completed' as TaskStatus,
        ringColor: completionRingColor,
      });

      // 3. Recalculate and update user stats based on all completion logs
      try {
        await db.users.recalculateStats(userId, user.timezone || 'UTC');
        // Invalidate React Query cache for user stats so profile updates
        queryClient.invalidateQueries({ queryKey: ['user', 'current', 'stats', userId] });
        queryClient.invalidateQueries({ queryKey: ['completionLogs', userId] });
      } catch (statsError) {
        // Log error but don't fail the completion - stats update is secondary
        console.error('Failed to update user stats:', statsError);
      }

      // 3.5 Invalidate task-related queries for data freshness
      const projectId = projectWithParticipants?.id;
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskStatuses'] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', 'project', projectId] });
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      }
      queryClient.invalidateQueries({ queryKey: ['taskStatuses', userId] });

      // 4. Update local completion logs
      setLocalCompletionLogs(prev => [...prev, newCompletionLog]);

      // 5. Update local task statuses
      setLocalTaskStatuses(prev => {
        const updated = prev.map(ts => {
          const tsTaskId = typeof ts.taskId === 'string' ? parseInt(ts.taskId) : ts.taskId;
          const tsUserId = typeof ts.userId === 'string' ? parseInt(ts.userId) : ts.userId;
          if (tsTaskId === taskId && tsUserId === userId) {
            return {
              ...ts,
              status: 'completed' as TaskStatus,
              ringColor: completionRingColor,
            };
          }
          return ts;
        });

        const allStatuses = updated.filter(ts => {
          const tsTaskId = typeof ts.taskId === 'string' ? parseInt(ts.taskId) : ts.taskId;
          return tsTaskId === taskId;
        });
        const allCompleted = allStatuses.every(ts => {
          const tsUserId = typeof ts.userId === 'string' ? parseInt(ts.userId) : ts.userId;
          return tsUserId === userId || ts.status === 'completed';
        });

        // Update local tasks with updated embedded taskStatus
        setLocalTasks(prevTasks =>
          prevTasks.map(t => {
            if (t.id === taskId) {
              // Update the embedded taskStatus array
              const updatedTaskStatuses = (t.taskStatus || []).map(ts => {
                const tsUserId = typeof ts.userId === 'string' ? parseInt(ts.userId) : ts.userId;
                if (tsUserId === userId) {
                  return {
                    ...ts,
                    status: 'completed' as TaskStatus,
                    ringColor: completionRingColor,
                  };
                }
                return ts;
              });
              return {
                ...t,
                updatedAt: now,
                taskStatus: updatedTaskStatuses,
              };
            }
            return t;
          })
        );

        if (allCompleted) {
          toast.success('Amazing work! 🎉', {
            description: 'Task completed by everyone!'
          });
        } else {
          toast.success('Great job! 💪', {
            description: penaltyApplied
              ? 'Waiting for your partner to complete... (Half XP - Recovered)'
              : 'Waiting for your partner to complete...'
          });
        }

        return updated;
      });

      // Send completion notification to other participants
      if (projectId) {
        notifyTaskCompleted(taskId, projectId, userId).catch(error => {
          console.error('Failed to send completion notifications:', error);
        });
      }
    } catch (error) {
      handleError(error, 'handleComplete');
      toast.error('Failed to complete task', {
        description: 'Please try again'
      });
    }
  }, [user, tasks, getTaskStatusForUser, setLocalTasks, setLocalTaskStatuses, setLocalCompletionLogs, queryClient, projectWithParticipants]);

  /**
   * Create a new task (one-off or habit)
   */
  const handleCreateTask = useCallback(async (taskData: TaskCreationData) => {
    if (!projectWithParticipants || !user) return;

    const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    const defaultDueDate = normalizeToStartOfDay(taskData.dueDate ?? new Date());

    // Get all participant user IDs (creator + all active project members)
    const participantUserIds = getParticipatingUserIds(projectWithParticipants, userId);

    // Validate project for task creation
    const allParticipants = participantUserIds.map(id => ({ id } as User));
    const validation = validateProjectForTaskCreation(projectWithParticipants, allParticipants, 1);
    if (!validation.isValid) {
      toast.error('Cannot create task', {
        description: validation.error
      });
      return;
    }

    try {
      if (taskData.type === 'habit' && taskData.dueDate && taskData.recurrencePattern) {
        // Handle habit tasks (multiple recurring tasks)
        const startDate = normalizeToStartOfDay(taskData.dueDate);
        let endDate: Date;

        if (taskData.recurrencePattern === 'custom' && taskData.customRecurrence) {
          if (taskData.customRecurrence.endType === 'date' && taskData.customRecurrence.endDate) {
            endDate = new Date(taskData.customRecurrence.endDate);
            endDate.setHours(23, 59, 59, 999);
          } else {
            endDate = new Date(startDate);
            const maxOccurrences = taskData.customRecurrence.occurrenceCount || 10;
            endDate.setDate(endDate.getDate() + (maxOccurrences * 30));
          }
        } else {
          endDate = new Date(startDate);
          if (taskData.recurrencePattern === 'Daily') {
            endDate.setDate(endDate.getDate() + 30);
          } else if (taskData.recurrencePattern === 'weekly') {
            endDate.setDate(endDate.getDate() + 30);
          }
          endDate.setHours(23, 59, 59, 999);
        }

        // Build array of tasks to create
        const tasksToCreate: CreateTaskWithStatusesInput[] = [];
        let currentDate = new Date(startDate);
        let occurrenceCount = 0;
        const maxOccurrences = taskData.customRecurrence?.occurrenceCount ||
          (taskData.recurrencePattern === 'Daily' ? 30 : taskData.recurrencePattern === 'weekly' ? 5 : 999);

        while (currentDate <= endDate && occurrenceCount < maxOccurrences) {
          const taskDueDate = normalizeToStartOfDay(currentDate);

          tasksToCreate.push({
            task: {
              projectId: taskData.projectId,
              creatorId: userId,
              type: taskData.type,
              recurrencePattern: taskData.recurrencePattern,
              title: taskData.title,
              description: taskData.description,
              dueDate: taskDueDate,
              recurrenceIndex: occurrenceCount + 1,
              recurrenceTotal: taskData.customRecurrence?.endType === 'count' ? maxOccurrences : undefined,
              showRecurrenceIndex: taskData.showRecurrenceIndex,
            },
            participantUserIds,
            dueDate: taskDueDate,
          });

          occurrenceCount++;

          // Advance to next occurrence
          if (taskData.recurrencePattern === 'Daily') {
            currentDate.setDate(currentDate.getDate() + 1);
          } else if (taskData.recurrencePattern === 'weekly') {
            currentDate.setDate(currentDate.getDate() + 7);
          } else if (taskData.recurrencePattern === 'custom' && taskData.customRecurrence) {
            const { frequency, interval } = taskData.customRecurrence;
            if (frequency === 'days') {
              currentDate.setDate(currentDate.getDate() + interval);
            } else if (frequency === 'weeks') {
              currentDate.setDate(currentDate.getDate() + (interval * 7));
            } else if (frequency === 'months') {
              currentDate.setMonth(currentDate.getMonth() + interval);
            }
          }
        }

        // Create all habit tasks in the database
        const results = await createMultipleTasksMutation.mutateAsync(tasksToCreate);

        toast.success(`${results.length} habit tasks created! 🚀`, {
          description: 'Persuade your friends to complete these tasks with you'
        });

        // Send email notification for the first task
        if (results.length > 0) {
          const mainTask = results[0].task;
          notifyTaskCreated(mainTask.id, mainTask.projectId, userId).catch(error => {
            console.error('Failed to send task creation emails:', error);
          });
        }
      } else {
        // Handle single one-off task
        const result = await createTaskMutation.mutateAsync({
          task: {
            projectId: taskData.projectId,
            creatorId: userId,
            type: taskData.type,
            recurrencePattern: taskData.recurrencePattern,
            title: taskData.title,
            description: taskData.description,
            dueDate: defaultDueDate,
            showRecurrenceIndex: taskData.showRecurrenceIndex,
          },
          participantUserIds,
          dueDate: defaultDueDate,
        });

        toast.success('Task created! 🚀', {
          description: 'Persuade your friends to complete this task with you'
        });

        // Send email notification
        notifyTaskCreated(result.task.id, result.task.projectId, userId).catch(error => {
          console.error('Failed to send task creation emails:', error);
        });
      }

      onTaskFormClose();
    } catch (error) {
      handleError(error, 'handleCreateTask');
      toast.error('Failed to create task', {
        description: 'Please try again'
      });
    }
  }, [user, projectWithParticipants, createTaskMutation, createMultipleTasksMutation, onTaskFormClose]);

  /**
   * Delete a task
   */
  const handleDeleteTask = useCallback(async (taskId: number) => {
    try {
      const db = getDatabaseClient();
      await db.tasks.delete(taskId);

      setLocalTasks(prev => prev.filter(t => t.id !== taskId));
      setLocalTaskStatuses(prev => prev.filter(ts => {
        const tsTaskId = typeof ts.taskId === 'string' ? parseInt(ts.taskId) : ts.taskId;
        return tsTaskId !== taskId;
      }));
      setLocalCompletionLogs(prev => prev.filter(cl => {
        const clTaskId = typeof cl.taskId === 'string' ? parseInt(cl.taskId) : cl.taskId;
        return clTaskId !== taskId;
      }));

      // Invalidate React Query cache for data freshness
      const projectId = projectWithParticipants?.id;
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskStatuses'] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', 'project', projectId] });
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      }

      toast.success('Task deleted', {
        description: 'The task has been removed from the project'
      });
    } catch (error) {
      handleError(error, 'handleDeleteTask');
    }
  }, [setLocalTasks, setLocalTaskStatuses, setLocalCompletionLogs, projectWithParticipants, queryClient]);

  /**
   * Delete a habit task series
   */
  const handleDeleteTaskSeries = useCallback(async (series: any) => { // Using any for series to avoid type circularity issues in this callback if any
    try {
      const db = getDatabaseClient();
      const taskIds = series.tasks.map((t: Task) => t.id);

      // Delete all tasks in the series
      await Promise.all(taskIds.map((id: number) => db.tasks.delete(id)));

      // Update local state by filtering out all tasks in the series
      const taskIdSet = new Set(taskIds);
      setLocalTasks(prev => prev.filter(t => !taskIdSet.has(t.id)));
      setLocalTaskStatuses(prev => prev.filter(ts => {
        const tsTaskId = typeof ts.taskId === 'string' ? parseInt(ts.taskId) : ts.taskId;
        return !taskIdSet.has(tsTaskId);
      }));
      setLocalCompletionLogs(prev => prev.filter(cl => {
        const clTaskId = typeof cl.taskId === 'string' ? parseInt(cl.taskId) : cl.taskId;
        return !taskIdSet.has(clTaskId);
      }));

      // Invalidate React Query cache
      const projectId = projectWithParticipants?.id;
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskStatuses'] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', 'project', projectId] });
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      }

      toast.success('Series deleted', {
        description: `All occurrences of "${series.title}" have been removed.`
      });
    } catch (error) {
      handleError(error, 'handleDeleteTaskSeries');
      toast.error('Failed to delete series');
    }
  }, [setLocalTasks, setLocalTaskStatuses, setLocalCompletionLogs, projectWithParticipants, queryClient]);

  /**
   * Update an existing task
   */
  const handleUpdateTask = useCallback(async (taskId: number, taskData: TaskCreationData) => {
    try {
      const updatedTask = await updateTaskMutation.mutateAsync({
        id: taskId,
        data: {
          title: taskData.title,
          description: taskData.description,
          type: taskData.type,
          recurrencePattern: taskData.recurrencePattern,
          dueDate: taskData.dueDate,
          showRecurrenceIndex: taskData.showRecurrenceIndex,
        }
      });

      // Update local state
      setLocalTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));

      toast.success('Task updated! ✨');
      onTaskFormClose();
    } catch (error) {
      handleError(error, 'handleUpdateTask');
      toast.error('Failed to update task');
    }
  }, [updateTaskMutation, setLocalTasks, onTaskFormClose]);

  return {
    handleRecover,
    handleComplete,
    handleCreateTask,
    handleUpdateTask,
    handleDeleteTask,
    handleDeleteTaskSeries,
    isCreatingTask: createTaskMutation.isPending || createMultipleTasksMutation.isPending || updateTaskMutation.isPending,
  };
};

