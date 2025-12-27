// ============================================================================
// useProjectTaskMutations - Task CRUD Operations for Project Detail
// ============================================================================

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { Task, TaskStatusEntity, CompletionLog, DifficultyRating, TaskStatus, User } from '@/types';
import { normalizeToStartOfDay, calculateRingColor, calculateTaskStatusUserStatus } from '@/lib/tasks/taskUtils';
import { recoverTask } from '@/lib/tasks/taskRecoveryUtils';
import { validateProjectForTaskCreation } from '@/lib/tasks/taskCreationUtils';
import { handleError } from '@/lib/errorUtils';
import { notifyTaskCreated } from '@/lib/tasks/taskEmailNotifications';
import { getDatabaseClient } from '@/db';
import { 
  useCreateTaskWithStatuses,
  useCreateMultipleTasksWithStatuses,
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
  
  // Mutations for creating tasks in the database
  const createTaskMutation = useCreateTaskWithStatuses();
  const createMultipleTasksMutation = useCreateMultipleTasksWithStatuses();

  /**
   * Get task status for a specific user
   */
  const getTaskStatusForUser = useCallback((taskId: number, userId: number): TaskStatusEntity | undefined => {
    return taskStatuses.find(ts => ts.taskId === taskId && ts.userId === userId);
  }, [taskStatuses]);

  /**
   * Recover an archived task
   */
  const handleRecover = useCallback((taskId: number) => {
    if (!user) return;

    const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    const result = recoverTask(String(taskId), String(userId), tasks, taskStatuses);

    if (!result || !result.success) {
      handleError('Task not found or cannot be recovered', 'handleRecover');
      return;
    }

    // Update task state
    if (result.updatedTask) {
      setLocalTasks(prev =>
        prev.map(t => t.id === taskId ? result.updatedTask! : t)
      );
    }

    // Update task status state
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

    toast.success('Task recovered! 💪', {
      description: 'Complete it to earn half XP'
    });
  }, [user, tasks, taskStatuses, setLocalTasks, setLocalTaskStatuses]);

  /**
   * Complete a task with optional difficulty rating
   */
  const handleComplete = useCallback((taskId: number, difficultyRating?: number) => {
    if (!user) return;

    const now = new Date();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    const myTaskStatus = getTaskStatusForUser(taskId, userId);
    if (!myTaskStatus) return;

    const isRecovered = myTaskStatus.recoveredAt !== undefined;
    const taskDueDate = task.dueDate;
    const isBeforeDueDate = now <= taskDueDate;
    const penaltyApplied = isRecovered && !isBeforeDueDate;

    const baseXP = (difficultyRating || 3) * 100;
    const xpEarned = penaltyApplied ? Math.floor(baseXP / 2) : baseXP;

    const newCompletionLog: CompletionLog = {
      id: Date.now(),
      userId: userId,
      taskId: taskId,
      difficultyRating: difficultyRating as DifficultyRating | undefined,
      penaltyApplied,
      xpEarned,
      createdAt: now
    };

    const ringColor = calculateRingColor(newCompletionLog, myTaskStatus, task);

    setLocalCompletionLogs(prev => [...prev, newCompletionLog]);

    setLocalTaskStatuses(prev => {
      const updated = prev.map(ts => {
        const tsTaskId = typeof ts.taskId === 'string' ? parseInt(ts.taskId) : ts.taskId;
        const tsUserId = typeof ts.userId === 'string' ? parseInt(ts.userId) : ts.userId;
        if (tsTaskId === taskId && tsUserId === userId) {
          return {
            ...ts,
            status: 'completed' as TaskStatus,
            ringColor,
            updatedAt: now
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

      setLocalTasks(prevTasks =>
        prevTasks.map(t => {
          if (t.id === taskId) {
            return {
              ...t,
              completedAt: allCompleted ? now : undefined,
              updatedAt: now
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
  }, [user, tasks, getTaskStatusForUser, setLocalTasks, setLocalTaskStatuses, setLocalCompletionLogs]);

  /**
   * Create a new task (one-off or habit)
   */
  const handleCreateTask = useCallback(async (taskData: TaskCreationData) => {
    if (!projectWithParticipants || !user) return;

    const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    const defaultDueDate = normalizeToStartOfDay(taskData.dueDate ?? new Date());

    // Get all participant user IDs
    const participantUserIds = projectWithParticipants?.participantRoles
      ?.filter(pr => !pr.removedAt)
      ?.map(pr => typeof pr.userId === 'string' ? parseInt(pr.userId) : pr.userId) || [];

    // Validate project for task creation
    const allParticipants = participantUserIds.map(id => ({ id } as User));
    const validation = validateProjectForTaskCreation(projectWithParticipants, allParticipants, 2);
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
            endDate.setDate(endDate.getDate() + 28);
          } else if (taskData.recurrencePattern === 'weekly') {
            endDate.setDate(endDate.getDate() + 28);
          }
          endDate.setHours(23, 59, 59, 999);
        }

        // Build array of tasks to create
        const tasksToCreate: CreateTaskWithStatusesInput[] = [];
        let currentDate = new Date(startDate);
        let occurrenceCount = 0;
        const maxOccurrences = taskData.customRecurrence?.occurrenceCount ||
          (taskData.recurrencePattern === 'Daily' ? 28 : taskData.recurrencePattern === 'weekly' ? 4 : 999);

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

      toast.success('Task deleted', {
        description: 'The task has been removed from the project'
      });
    } catch (error) {
      handleError(error, 'handleDeleteTask');
    }
  }, [setLocalTasks, setLocalTaskStatuses, setLocalCompletionLogs]);

  return {
    handleRecover,
    handleComplete,
    handleCreateTask,
    handleDeleteTask,
    isCreatingTask: createTaskMutation.isPending || createMultipleTasksMutation.isPending,
  };
};

