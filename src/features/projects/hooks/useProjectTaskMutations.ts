// ============================================================================
// useProjectTaskMutations - Task CRUD Operations for Project Detail
// ============================================================================

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Task, TaskStatusEntity, CompletionLog, DifficultyRating, TaskStatus, User, RingColor } from '@/types';
import { normalizeToStartOfDay } from '@/lib/tasks/taskUtils';
import { validateProjectForTaskCreation, getParticipatingUserIds } from '@/lib/tasks/taskCreationUtils';
import { handleError } from '@/lib/errorUtils';
import { notifyTaskCreated, notifyTaskCompleted, notifyTaskUpdated, notifyTaskDeleted } from '@/lib/notifications/taskNotifications';
import { recoverTask } from '@/lib/tasks/taskRecoveryUtils';
import { getDatabaseClient } from '@/db';
import {
  useCreateTaskWithStatuses,
  useCreateMultipleTasksWithStatuses,
  useUpdateTask,
  type CreateTaskWithStatusesInput
} from '../../tasks/hooks/useTasks';
import type { TaskCreationData, ProjectWithParticipants, ProjectTaskState, HabitSeries } from './types';
import { notifyTaskRecovered } from '@/lib/tasks/taskEmailNotifications';
import { validateTaskCreation } from '@/lib/tasks/taskValidation';
import { ValidationError } from '@/lib/errors';
import { deleteTaskAtomic } from '@/lib/tasks/atomicTaskOperations';
import { TASK_CONFIG, PERFORMANCE_CONFIG } from '@/config/appConfig';
import { generateOccurrenceDates, getMaxOccurrences, type CustomRecurrence } from '@/lib/tasks/recurringTaskUtils';
import { normalizeId, compareIds } from '@/lib/idUtils';

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
    return taskStatuses.find(ts => compareIds(ts.taskId, taskId) && compareIds(ts.userId, userId));
  }, [taskStatuses]);

  /**
   * Recover an archived task
   */
  const handleRecover = useCallback(async (taskId: number) => {
    if (!user) return;

    const userId = normalizeId(user.id);
    const projectId = projectWithParticipants?.id;
    const result = recoverTask(taskId, userId, tasks, taskStatuses);

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
                if (compareIds(ts.userId, userId)) {
                  return result.updatedTaskStatus!;
                }
                return ts;
              });
              // If the user's task status wasn't in the array, add it
              const hasUserStatus = updatedTaskStatuses.some(ts => compareIds(ts.userId, userId));
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
          const existingIndex = prev.findIndex(ts => compareIds(ts.taskId, taskId) && compareIds(ts.userId, userId));

          if (existingIndex >= 0) {
            return prev.map((ts, index) =>
              index === existingIndex ? result.updatedTaskStatus! : ts
            );
          } else {
            return [...prev, result.updatedTaskStatus!];
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

      toast.success('Task recovered!', {
        description: 'Complete it to earn XP'
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

    const userId = normalizeId(user.id);
    let myTaskStatus: TaskStatusEntity | undefined | null = getTaskStatusForUser(taskId, userId);

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
    // - Recovered tasks: ALWAYS give fixed RECOVERED_XP
    // - Late tasks (not recovered): give half of base XP
    // - On-time tasks: give full base XP
    const baseXP = TASK_CONFIG.BASE_XP;
    let xpEarned: number;
    let penaltyApplied: boolean;

    if (isRecovered) {
      // Recovered tasks always give fixed XP
      xpEarned = TASK_CONFIG.RECOVERED_XP;
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

      // DATA CONSISTENCY VALIDATION: Only run in development to avoid production DB overhead
      if (process.env.NODE_ENV === 'development') {
        try {
          const [verifyLog, verifyStatus] = await Promise.all([
            db.completionLogs.getByTaskAndUser(taskId, userId),
            db.taskStatus.getByTaskAndUser(taskId, userId)
          ]);

          if (!verifyLog) {
            console.error('[handleComplete] DATA INCONSISTENCY: Completion log was created but not found in DB after creation', {
              taskId,
              userId,
              newCompletionLog
            });
          } else if (verifyLog.id !== newCompletionLog.id) {
            console.error('[handleComplete] DATA INCONSISTENCY: Completion log ID mismatch', {
              taskId,
              userId,
              expectedId: newCompletionLog.id,
              foundId: verifyLog.id
            });
          }

          if (!verifyStatus) {
            console.error('[handleComplete] DATA INCONSISTENCY: Task status not found after update', {
              taskId,
              userId,
              expectedStatus: 'completed',
              expectedRingColor: completionRingColor
            });
          } else if (verifyStatus.status !== 'completed') {
            console.error('[handleComplete] DATA INCONSISTENCY: Task status not marked as completed', {
              taskId,
              userId,
              expectedStatus: 'completed',
              actualStatus: verifyStatus.status
            });
          } else if (verifyStatus.ringColor !== completionRingColor) {
            console.error('[handleComplete] DATA INCONSISTENCY: Task ring color mismatch', {
              taskId,
              userId,
              expectedRingColor: completionRingColor,
              actualRingColor: verifyStatus.ringColor
            });
          }
        } catch (verifyError) {
          console.error('[handleComplete] Error during data consistency validation:', verifyError);
        }
      }

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
      queryClient.invalidateQueries({ queryKey: ['completionLogs', 'tasks'] });

      // 4. Update local completion logs
      setLocalCompletionLogs(prev => [...prev, newCompletionLog]);

      // 5. Update local task statuses
      setLocalTaskStatuses(prev => {
        return prev.map(ts => {
          if (compareIds(ts.taskId, taskId) && compareIds(ts.userId, userId)) {
            return {
              ...ts,
              status: 'completed' as TaskStatus,
              ringColor: completionRingColor,
            };
          }
          return ts;
        });
      });

      // 6. Update local tasks with updated embedded taskStatus
      setLocalTasks(prevTasks =>
        prevTasks.map(t => {
          if (t.id === taskId) {
            const updatedTaskStatuses = (t.taskStatus || []).map(ts => {
              if (compareIds(ts.userId, userId)) {
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

      // 7. Handle side effects (toasts and notifications)
      const updatedStatuses = taskStatuses.map(ts => {
        if (compareIds(ts.taskId, taskId) && compareIds(ts.userId, userId)) {
          return {
            ...ts,
            status: 'completed' as TaskStatus,
            ringColor: completionRingColor,
          };
        }
        return ts;
      });

      const allStatuses = updatedStatuses.filter(ts => compareIds(ts.taskId, taskId));

      const allCompleted = allStatuses.every(ts => {
        return compareIds(ts.userId, userId) || ts.status === 'completed';
      });

      if (allCompleted) {
        toast.success('Amazing work! 🚀', {
          description: 'Task completed by everyone!'
        });
      } else {
        toast.success('Task done! ✅', {
          description: penaltyApplied
            ? 'Waiting for your partners to complete... (Late/Recovered)'
            : 'Waiting for your partners to complete...'
        });
      }

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
  }, [user, tasks, taskStatuses, getTaskStatusForUser, setLocalTasks, setLocalTaskStatuses, setLocalCompletionLogs, queryClient, projectWithParticipants]);

  /**
   * Create a new task (one-off or habit)
   */
  const handleCreateTask = useCallback(async (taskData: TaskCreationData) => {
    if (!projectWithParticipants || !user) return;

    const userId = normalizeId(user.id);
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
      // Validate task data before creation
      try {
        validateTaskCreation(taskData);
      } catch (validationError) {
        if (validationError instanceof ValidationError) {
          toast.error('Validation Error', {
            description: validationError.message
          });
          return;
        }
        throw validationError;
      }

      if (taskData.type === 'habit' && taskData.dueDate && taskData.recurrencePattern) {
        // Handle habit tasks (multiple recurring tasks)
        const startDate = normalizeToStartOfDay(taskData.dueDate);

        // Calculate end date based on recurrence pattern
        let endDate: Date | undefined;
        if (taskData.recurrencePattern === 'custom' && taskData.customRecurrence) {
          if (taskData.customRecurrence.endType === 'date' && taskData.customRecurrence.endDate) {
            endDate = new Date(taskData.customRecurrence.endDate);
            endDate.setHours(23, 59, 59, 999);
          }
        }
        if (!endDate) {
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + TASK_CONFIG.DEFAULT_RECURRING_DURATION_DAYS);
          endDate.setHours(23, 59, 59, 999);
        }

        // Get max occurrences from config
        const maxOccurrences = getMaxOccurrences(
          taskData.recurrencePattern,
          taskData.customRecurrence?.occurrenceCount
        );

        // Build custom recurrence config for utility
        const customRecurrence: CustomRecurrence | undefined = taskData.customRecurrence ? {
          frequency: taskData.customRecurrence.frequency as 'days' | 'weeks' | 'months',
          interval: taskData.customRecurrence.interval,
          endType: taskData.customRecurrence.endType,
          occurrenceCount: taskData.customRecurrence.occurrenceCount,
        } : undefined;

        // Use utility to generate all occurrence dates
        const occurrenceDates = generateOccurrenceDates(
          startDate,
          taskData.recurrencePattern,
          1, // Default interval
          maxOccurrences,
          endDate,
          customRecurrence
        );

        // Build array of tasks from generated dates
        const tasksToCreate: CreateTaskWithStatusesInput[] = occurrenceDates.map((dueDate, index) => ({
          task: {
            projectId: taskData.projectId,
            creatorId: userId,
            type: taskData.type,
            recurrencePattern: taskData.recurrencePattern,
            title: taskData.title,
            description: taskData.description,
            dueDate: normalizeToStartOfDay(dueDate),
            recurrenceIndex: index + 1,
            recurrenceTotal: taskData.customRecurrence?.endType === 'count' ? maxOccurrences : undefined,
            showRecurrenceIndex: taskData.showRecurrenceIndex,
          },
          participantUserIds,
          dueDate: normalizeToStartOfDay(dueDate),
        }));

        // Create all habit tasks in the database
        const results = await createMultipleTasksMutation.mutateAsync(tasksToCreate);

        toast.success(`${results.length} habit tasks created!`, {
          description: 'Collaborate with your friends to complete these tasks'
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

        toast.success('Task created!', {
          description: 'Collaborate with your friends to complete this task'
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

      // Capture task data BEFORE deletion
      const task = tasks.find(t => t.id === taskId);
      const taskTitle = task?.title || 'Unknown Task';
      const projectId = task?.projectId || projectWithParticipants?.id;

      // Delete the task
      await db.tasks.delete(taskId);

      setLocalTasks(prev => prev.filter(t => t.id !== taskId));
      setLocalTaskStatuses(prev => prev.filter(ts => !compareIds(ts.taskId, taskId)));
      setLocalCompletionLogs(prev => prev.filter(cl => !compareIds(cl.taskId, taskId)));

      // Invalidate React Query cache for data freshness
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskStatuses'] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', 'project', projectId] });
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      }

      toast.success('Task deleted.', {
        description: 'The task has been removed from the project'
      });

      // Send deletion notification to participants
      if (projectId && user) {
        const deleterId = normalizeId(user.id);
        try {
          await notifyTaskDeleted(projectId, deleterId, taskTitle);
          console.log('[TaskDelete] ✅ Notifications sent successfully');
        } catch (err) {
          console.error('[TaskDelete] ❌ Notification failed:', err);
          toast.error('Failed to notify participants', {
            description: 'Task was deleted but participants may not be notified'
          });
        }
      }
    } catch (error) {
      handleError(error, 'handleDeleteTask');
    }
  }, [user, tasks, setLocalTasks, setLocalTaskStatuses, setLocalCompletionLogs, projectWithParticipants, queryClient]);

  /**
   * Delete a habit task series
   */
  const handleDeleteTaskSeries = useCallback(async (series: HabitSeries) => {
    try {
      const db = getDatabaseClient();
      const taskIds = series.tasks.map((t: Task) => t.id);
      const seriesTitle = series.title;
      const projectId = projectWithParticipants?.id;

      // Delete all tasks in the series
      await Promise.all(taskIds.map((id: number) => db.tasks.delete(id)));

      // Update local state by filtering out all tasks in the series
      const taskIdSet = new Set(taskIds);
      setLocalTasks(prev => prev.filter(t => !taskIdSet.has(t.id)));
      setLocalTaskStatuses(prev => prev.filter(ts => !taskIdSet.has(normalizeId(ts.taskId))));
      setLocalCompletionLogs(prev => prev.filter(cl => !taskIdSet.has(normalizeId(cl.taskId))));

      // Invalidate React Query cache
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskStatuses'] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', 'project', projectId] });
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      }

      toast.success('Series deleted.', {
        description: `All occurrences of "${seriesTitle}" have been removed.`
      });

      // Send deletion notification for the series
      if (projectId && user) {
        const deleterId = normalizeId(user.id);
        try {
          await notifyTaskDeleted(projectId, deleterId, `${seriesTitle} (series)`);
          console.log('[TaskDelete] ✅ Series notifications sent successfully');
        } catch (err) {
          console.error('[TaskDelete] ❌ Series notification failed:', err);
          toast.error('Failed to notify participants', {
            description: 'Series was deleted but participants may not be notified'
          });
        }
      }
    } catch (error) {
      handleError(error, 'handleDeleteTaskSeries');
      toast.error('Failed to delete series');
    }
  }, [user, setLocalTasks, setLocalTaskStatuses, setLocalCompletionLogs, projectWithParticipants, queryClient]);

  /**
   * Update an existing task
   * Supports converting one_off tasks to habits by generating additional occurrences
   */
  const handleUpdateTask = useCallback(async (taskId: number, taskData: TaskCreationData) => {
    try {
      const db = getDatabaseClient();
      const existingTask = tasks.find(t => t.id === taskId);

      if (!existingTask) {
        toast.error('Task not found');
        return;
      }

      // Check if converting from one_off to habit
      const recurrencePattern = taskData.recurrencePattern;
      const isConvertingToHabit = existingTask.type === 'one_off' && taskData.type === 'habit' && !!recurrencePattern;

      if (isConvertingToHabit && recurrencePattern && projectWithParticipants && user) {
        const userId = normalizeId(user.id);
        const participantUserIds = getParticipatingUserIds(projectWithParticipants, userId);

        // Update the original task to be a habit
        const updatedTask = await updateTaskMutation.mutateAsync({
          id: taskId,
          data: {
            title: taskData.title,
            description: taskData.description,
            type: taskData.type,
            recurrencePattern: recurrencePattern,
            dueDate: taskData.dueDate,
            showRecurrenceIndex: taskData.showRecurrenceIndex,
            recurrenceIndex: existingTask.recurrenceIndex && existingTask.recurrenceIndex > 0
              ? existingTask.recurrenceIndex
              : 1, // Preserve existing or start at 1
          }
        });

        // Generate additional occurrences using utility function
        const startDate = normalizeToStartOfDay(taskData.dueDate ?? new Date());

        // Calculate end date based on recurrence pattern
        let endDate: Date | undefined;
        if (taskData.recurrencePattern === 'custom' && taskData.customRecurrence) {
          if (taskData.customRecurrence.endType === 'date' && taskData.customRecurrence.endDate) {
            endDate = new Date(taskData.customRecurrence.endDate);
            endDate.setHours(23, 59, 59, 999);
          }
        }
        if (!endDate) {
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + TASK_CONFIG.DEFAULT_RECURRING_DURATION_DAYS);
          endDate.setHours(23, 59, 59, 999);
        }

        // Get max occurrences from config
        const maxOccurrences = getMaxOccurrences(
          recurrencePattern,
          taskData.customRecurrence?.occurrenceCount
        );

        // Build custom recurrence config for utility
        const customRecurrence: CustomRecurrence | undefined = taskData.customRecurrence ? {
          frequency: taskData.customRecurrence.frequency as 'days' | 'weeks' | 'months',
          interval: taskData.customRecurrence.interval,
          endType: taskData.customRecurrence.endType,
          occurrenceCount: taskData.customRecurrence.occurrenceCount,
        } : undefined;

        // Use utility to generate all occurrence dates
        const occurrenceDates = generateOccurrenceDates(
          startDate,
          recurrencePattern,
          1, // Default interval
          maxOccurrences,
          endDate,
          customRecurrence
        );

        // Build array of tasks to create (skip first occurrence - already updated)
        const tasksToCreate: CreateTaskWithStatusesInput[] = occurrenceDates
          .slice(1) // Skip first occurrence
          .map((dDate, index) => ({
            task: {
              projectId: Number(taskData.projectId),
              creatorId: userId,
              type: taskData.type,
              recurrencePattern: recurrencePattern,
              title: taskData.title,
              description: taskData.description,
              dueDate: normalizeToStartOfDay(dDate),
              recurrenceIndex: index + 2, // Start from 2 since first occurrence is already updated
              recurrenceTotal: taskData.customRecurrence?.endType === 'count' ? maxOccurrences : undefined,
              showRecurrenceIndex: taskData.showRecurrenceIndex,
            },
            participantUserIds,
            dueDate: normalizeToStartOfDay(dDate),
          }));

        // Create additional recurring tasks with rollback on failure
        let createdTaskIds: number[] = [];
        if (tasksToCreate.length > 0) {
          try {
            const results = await createMultipleTasksMutation.mutateAsync(tasksToCreate);
            createdTaskIds = results.map(r => r.task.id);
          } catch (conversionError) {
            // ROLLBACK: Delete any tasks that were created
            console.error('[handleUpdateTask] Conversion failed, rolling back...');
            if (createdTaskIds.length > 0) {
              await Promise.all(createdTaskIds.map(id => deleteTaskAtomic(id).catch(() => { })));
              console.log(`[handleUpdateTask] Rolled back ${createdTaskIds.length} tasks`);
            }

            // Restore original task type and settings
            await updateTaskMutation.mutateAsync({
              id: taskId,
              data: {
                type: existingTask.type,
                recurrencePattern: existingTask.recurrencePattern,
                recurrenceIndex: existingTask.recurrenceIndex,
                recurrenceTotal: existingTask.recurrenceTotal,
              }
            }).catch(() => {
              console.error('[handleUpdateTask] Failed to restore original task');
            });

            throw conversionError;
          }
        }

        // Update local state with the modified task
        setLocalTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));

        toast.success('Task converted to recurring!', {
          description: `${tasksToCreate.length} additional occurrences created`
        });

        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['tasks', 'project', taskData.projectId] });
      } else {
        // Normal update (no conversion)
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
      }

      // Send update notification
      if (user) {
        notifyTaskUpdated(taskId, taskData.projectId, normalizeId(user.id)).catch(err => {
          console.error('Failed to send task update notification:', err);
        });
      }

      onTaskFormClose();
    } catch (error) {
      handleError(error, 'handleUpdateTask');
      toast.error('Failed to update task');
    }
  }, [updateTaskMutation, createMultipleTasksMutation, setLocalTasks, onTaskFormClose, user, projectWithParticipants, tasks, queryClient]);

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

