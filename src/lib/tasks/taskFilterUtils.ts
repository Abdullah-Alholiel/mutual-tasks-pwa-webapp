// ============================================================================
// Task Filter Utilities - Centralized Task Filtering Logic
// ============================================================================
// 
// This file provides standardized utilities for filtering tasks
// that should be used consistently across all components.
// Supports both string and number IDs for compatibility.
// ============================================================================

import type { Task, TaskStatusEntity, CompletionLog, Project, User } from '@/types';
import { calculateTaskStatusUserStatus, normalizeToStartOfDay } from '../tasks/taskUtils';
import { normalizeId } from '@/lib/idUtils';

/**
 * Get tasks for today (based on dueDate)
 * 
 * @param tasks - Array of tasks
 * @param userId - Optional user ID to filter by participation
 * @returns Tasks due today
 */
export const getTodayTasks = (
  tasks: Task[],
  userId?: string | number
): Task[] => {
  const today = normalizeToStartOfDay(new Date());

  return tasks.filter(task => {
    const dueDate = normalizeToStartOfDay(new Date(task.dueDate));
    const isToday = dueDate.getTime() === today.getTime();

    if (!isToday) return false;

    // If userId provided, filter to tasks visible to that user
    if (userId !== undefined) {
      const userIdNum = normalizeId(userId);
      const creatorId = normalizeId(task.creatorId);
      const isCreator = creatorId === userIdNum;
      const hasStatus = task.taskStatus?.some(ts => {
        const tsUserId = normalizeId(ts.userId);
        return tsUserId === userIdNum;
      });
      return isCreator || hasStatus;
    }

    return true;
  });
};

/**
 * Get tasks for a specific project
 * 
 * @param tasks - Array of tasks
 * @param projectId - Project ID to filter by
 * @returns Tasks in the project
 */
export const getProjectTasks = (tasks: Task[], projectId: string | number): Task[] => {
  const projectIdNum = normalizeId(projectId);
  return tasks.filter(task => {
    const taskProjectId = normalizeId(task.projectId);
    return taskProjectId === projectIdNum;
  });
};

/**
 * Get tasks for a specific user
 * 
 * @param tasks - Array of tasks
 * @param userId - User ID to filter by
 * @returns Tasks where user is creator or has task status
 */
export const getUserTasks = (tasks: Task[], userId: string | number): Task[] => {
  const userIdNum = normalizeId(userId);
  return tasks.filter(task => {
    const creatorId = normalizeId(task.creatorId);
    const isCreator = creatorId === userIdNum;
    const hasStatus = task.taskStatus?.some(ts => {
      const tsUserId = normalizeId(ts.userId);
      return tsUserId === userIdNum;
    });
    return isCreator || hasStatus;
  });
};

/**
 * Check if a user is a participant in a task's project
 * Helper function to determine task visibility
 */
function isUserInTaskProject(
  task: Task,
  userId: string | number,
  projects: Project[]
): boolean {
  const userIdNum = normalizeId(userId);
  const taskProjectId = normalizeId(task.projectId);

  const project = projects.find(p => {
    const pId = normalizeId(p.id);
    return pId === taskProjectId;
  });

  if (!project) return false;

  // User is owner
  const ownerId = normalizeId(project.ownerId);
  if (ownerId === userIdNum) return true;

  // User is in participants array
  if (project.participants?.some(p => {
    const participantId = typeof p === 'object' && 'id' in p ? normalizeId(p.id) : normalizeId(p);
    return participantId === userIdNum;
  })) return true;

  // User is in participantRoles
  if (project.participantRoles?.some(pr => {
    const prUserId = normalizeId(pr.userId);
    return prUserId === userIdNum && !pr.removedAt;
  })) return true;

  return false;
}

/**
 * Get tasks that need user action (active tasks due today, not completed, not recovered)
 * This is for the "Needs Your Action" section in today's view
 * 
 * @param tasks - Array of tasks
 * @param taskStatuses - Array of task statuses
 * @param completionLogs - Array of completion logs
 * @param userId - User ID to filter by
 * @param projects - Array of projects (optional, for checking project membership)
 * @returns Tasks needing action (active, due today, not completed, not recovered)
 */
export const getNeedsActionTasks = (
  tasks: Task[],
  taskStatuses: TaskStatusEntity[],
  completionLogs: CompletionLog[],
  userId: string | number,
  projects?: Project[]
): Task[] => {
  const today = normalizeToStartOfDay(new Date());
  const userIdNum = normalizeId(userId);

  return tasks.filter(task => {
    const taskId = normalizeId(task.id);
    const myStatus = taskStatuses.find(ts => {
      const tsTaskId = normalizeId(ts.taskId);
      const tsUserId = normalizeId(ts.userId);
      return tsTaskId === taskId && tsUserId === userIdNum;
    });
    const myCompletion = completionLogs.find(cl => {
      const clTaskId = normalizeId(cl.taskId);
      const clUserId = normalizeId(cl.userId);
      return clTaskId === taskId && clUserId === userIdNum;
    });

    const userStatus = calculateTaskStatusUserStatus(myStatus, myCompletion, task);
    if (userStatus !== 'active') return false;

    // Use task dueDate (effectiveDueDate not in TaskStatusEntity type)
    const dueDate = normalizeToStartOfDay(new Date(task.dueDate));
    const isDueToday = dueDate.getTime() === today.getTime();
    if (!isDueToday) return false;

    if (!myStatus) {
      if (projects) {
        return isUserInTaskProject(task, userId, projects);
      }
      const creatorId = normalizeId(task.creatorId);
      return creatorId === userIdNum;
    }

    return true;
  });
};

/**
 * Get active tasks for a user (not completed, not archived, includes recovered)
 * Active tasks are those that are currently active regardless of due date
 * 
 * @param tasks - Array of tasks
 * @param taskStatuses - Array of task statuses
 * @param completionLogs - Array of completion logs
 * @param userId - User ID to filter by
 * @param projects - Array of projects (optional, for checking project membership)
 * @returns Active tasks
 */
export const getActiveTasks = (
  tasks: Task[],
  taskStatuses: TaskStatusEntity[],
  completionLogs: CompletionLog[],
  userId: string | number,
  projects?: Project[]
): Task[] => {
  const userIdNum = normalizeId(userId);

  return tasks.filter(task => {
    const taskId = normalizeId(task.id);
    const myStatus = taskStatuses.find(ts => {
      const tsTaskId = normalizeId(ts.taskId);
      const tsUserId = normalizeId(ts.userId);
      return tsTaskId === taskId && tsUserId === userIdNum;
    });
    const myCompletion = completionLogs.some(cl => {
      const clTaskId = normalizeId(cl.taskId);
      const clUserId = normalizeId(cl.userId);
      return clTaskId === taskId && clUserId === userIdNum;
    });

    if (myCompletion) return false;

    if (!myStatus) {
      const creatorId = normalizeId(task.creatorId);
      const isCreator = creatorId === userIdNum;
      if (projects) {
        return isUserInTaskProject(task, userId, projects) && !myCompletion;
      }
      return isCreator && !myCompletion;
    }

    const userStatus = calculateTaskStatusUserStatus(myStatus, undefined, task);
    return (userStatus === 'active' || userStatus === 'recovered');
  });
};

/**
 * Get active tasks for today (due today, not completed, not archived)
 * For project detail view, this should also include recovered tasks (regardless of due date)
 * 
 * @param tasks - Array of tasks
 * @param taskStatuses - Array of task statuses
 * @param completionLogs - Array of completion logs
 * @param userId - User ID to filter by
 * @param projects - Array of projects (optional, for checking project membership)
 * @param includeRecovered - If true, include recovered tasks even if not due today (for project detail view)
 * @returns Active tasks due today (or recovered tasks if includeRecovered is true)
 */
export const getActiveTasksForToday = (
  tasks: Task[],
  taskStatuses: TaskStatusEntity[],
  completionLogs: CompletionLog[],
  userId: string | number,
  projects?: Project[],
  includeRecovered: boolean = false
): Task[] => {
  const today = normalizeToStartOfDay(new Date());
  const userIdNum = normalizeId(userId);

  return tasks.filter(task => {
    const taskId = normalizeId(task.id);
    const myStatus = taskStatuses.find(ts => {
      const tsTaskId = normalizeId(ts.taskId);
      const tsUserId = normalizeId(ts.userId);
      return tsTaskId === taskId && tsUserId === userIdNum;
    });
    const myCompletion = completionLogs.find(cl => {
      const clTaskId = normalizeId(cl.taskId);
      const clUserId = normalizeId(cl.userId);
      return clTaskId === taskId && clUserId === userIdNum;
    });

    if (myCompletion) return false;

    const userStatus = calculateTaskStatusUserStatus(myStatus, myCompletion, task);
    const isRecovered = myStatus?.recoveredAt !== undefined && myStatus?.recoveredAt !== null || userStatus === 'recovered';

    if (includeRecovered && isRecovered) {
      return userStatus === 'recovered';
    }

    // Use task dueDate (effectiveDueDate not in TaskStatusEntity type)
    const dueDate = normalizeToStartOfDay(new Date(task.dueDate));
    const isDueToday = dueDate.getTime() === today.getTime();
    if (!isDueToday) return false;

    if (!myStatus) {
      const creatorId = normalizeId(task.creatorId);
      const isCreator = creatorId === userIdNum;
      if (projects) {
        return isUserInTaskProject(task, userId, projects) && !myCompletion;
      }
      return isCreator && !myCompletion;
    }

    return userStatus === 'active';
  });
};

/**
 * Get completed tasks for a user
 * 
 * @param tasks - Array of tasks
 * @param completionLogs - Array of completion logs
 * @param userId - User ID to filter by
 * @returns Completed tasks
 */
export const getCompletedTasks = (
  tasks: Task[],
  completionLogs: CompletionLog[],
  userId: string | number
): Task[] => {
  const userIdNum = normalizeId(userId);

  return tasks.filter(task => {
    const taskId = normalizeId(task.id);
    const myCompletion = completionLogs.find(cl => {
      const clTaskId = normalizeId(cl.taskId);
      const clUserId = normalizeId(cl.userId);
      return clTaskId === taskId && clUserId === userIdNum;
    });
    return !!myCompletion;
  });
};

/**
 * Get completed tasks for today (for "Completed for the Day" section)
 * 
 * @param tasks - Array of tasks
 * @param taskStatuses - Array of task statuses
 * @param completionLogs - Array of completion logs
 * @param userId - User ID to filter by
 * @returns Completed tasks with today's date
 */
export const getCompletedTasksForToday = (
  tasks: Task[],
  taskStatuses: TaskStatusEntity[],
  completionLogs: CompletionLog[],
  userId: string | number
): Task[] => {
  const today = normalizeToStartOfDay(new Date());
  const userIdNum = normalizeId(userId);

  return tasks.filter(task => {
    const taskId = normalizeId(task.id);
    const myCompletion = completionLogs.find(cl => {
      const clTaskId = normalizeId(cl.taskId);
      const clUserId = normalizeId(cl.userId);
      return clTaskId === taskId && clUserId === userIdNum;
    });
    if (!myCompletion) return false;

    // Check if completion was on today's date (use createdAt as completion date)
    const completionDate = normalizeToStartOfDay(new Date(myCompletion.createdAt));
    const isCompletedToday = completionDate.getTime() === today.getTime();

    return isCompletedToday;
  });
};

/**
 * Get recovered tasks (for "Another Chance?" section)
 * Shows all tasks with task status user status of "recovered" regardless of date
 * 
 * @param tasks - Array of tasks
 * @param taskStatuses - Array of task statuses
 * @param completionLogs - Array of completion logs
 * @param userId - User ID to filter by
 * @param projects - Array of projects (optional, for checking project membership)
 * @returns Recovered tasks (regardless of date)
 */
export const getRecoveredTasks = (
  tasks: Task[],
  taskStatuses: TaskStatusEntity[],
  completionLogs: CompletionLog[],
  userId: string | number,
  projects?: Project[]
): Task[] => {
  const userIdNum = normalizeId(userId);

  return tasks.filter(task => {
    const taskId = normalizeId(task.id);
    const myStatus = taskStatuses.find(ts => {
      const tsTaskId = normalizeId(ts.taskId);
      const tsUserId = normalizeId(ts.userId);
      return tsTaskId === taskId && tsUserId === userIdNum;
    });
    const myCompletion = completionLogs.find(cl => {
      const clTaskId = normalizeId(cl.taskId);
      const clUserId = normalizeId(cl.userId);
      return clTaskId === taskId && clUserId === userIdNum;
    });

    // Exclude completed tasks - they should not appear in recovered section
    if (myCompletion) return false;

    const userStatus = calculateTaskStatusUserStatus(myStatus, myCompletion, task);
    if (userStatus !== 'recovered') return false;

    // If user has no status, check if they're in the project
    if (!myStatus) {
      if (projects) {
        return isUserInTaskProject(task, userId, projects);
      }
      const creatorId = normalizeId(task.creatorId);
      return creatorId === userIdNum;
    }

    return true;
  });
};

/**
 * Get upcoming tasks (due in the future, not completed, not archived)
 * 
 * @param tasks - Array of tasks
 * @param taskStatuses - Array of task statuses
 * @param completionLogs - Array of completion logs
 * @param userId - User ID to filter by
 * @param projects - Array of projects (optional, for checking project membership)
 * @returns Upcoming tasks
 */
export const getUpcomingTasks = (
  tasks: Task[],
  taskStatuses: TaskStatusEntity[],
  completionLogs: CompletionLog[],
  userId: string | number,
  projects?: Project[]
): Task[] => {
  const today = normalizeToStartOfDay(new Date());
  const userIdNum = normalizeId(userId);

  return tasks.filter(task => {
    const taskId = normalizeId(task.id);
    const myStatus = taskStatuses.find(ts => {
      const tsTaskId = normalizeId(ts.taskId);
      const tsUserId = normalizeId(ts.userId);
      return tsTaskId === taskId && tsUserId === userIdNum;
    });
    const myCompletion = completionLogs.some(cl => {
      const clTaskId = normalizeId(cl.taskId);
      const clUserId = normalizeId(cl.userId);
      return clTaskId === taskId && clUserId === userIdNum;
    });

    const dueDate = normalizeToStartOfDay(new Date(task.dueDate));
    const isDueFuture = dueDate.getTime() > today.getTime();

    if (!isDueFuture) return false;
    if (myCompletion) return false;

    // If user has no status, check if they're in the project
    if (!myStatus) {
      if (projects) {
        return isUserInTaskProject(task, userId, projects);
      }
      const creatorId = normalizeId(task.creatorId);
      return creatorId === userIdNum;
    }

    const userStatus = calculateTaskStatusUserStatus(myStatus, undefined, task);
    return userStatus === 'upcoming';
  });
};

/**
 * Get archived tasks that can be recovered
 * 
 * @param tasks - Array of tasks
 * @param taskStatuses - Array of task statuses
 * @param completionLogs - Array of completion logs
 * @param userId - User ID to filter by
 * @returns Archived tasks that can be recovered
 */
export const getArchivedTasks = (
  tasks: Task[],
  taskStatuses: TaskStatusEntity[],
  completionLogs: CompletionLog[],
  userId: string | number
): Task[] => {
  const userIdNum = normalizeId(userId);
  const today = normalizeToStartOfDay(new Date());

  return tasks.filter(task => {
    const taskId = normalizeId(task.id);
    const myStatus = taskStatuses.find(ts => {
      const tsTaskId = normalizeId(ts.taskId);
      const tsUserId = normalizeId(ts.userId);
      return tsTaskId === taskId && tsUserId === userIdNum;
    });
    const myCompletion = completionLogs.some(cl => {
      const clTaskId = normalizeId(cl.taskId);
      const clUserId = normalizeId(cl.userId);
      return clTaskId === taskId && clUserId === userIdNum;
    });

    // If user has no status but is creator, check if user's task status would be archived
    if (!myStatus) {
      const creatorId = normalizeId(task.creatorId);
      const isCreator = creatorId === userIdNum;
      if (!isCreator || myCompletion) return false;

      // Check if task is past due (would be archived)
      const dueDate = normalizeToStartOfDay(new Date(task.dueDate));
      const isPastDue = dueDate.getTime() < today.getTime();

      return isPastDue;
    }

    // Only show if archived, not recovered, and not completed
    const isArchived = myStatus.status === 'archived' ||
      (myStatus.archivedAt !== undefined && myStatus.archivedAt !== null);

    return isArchived && !myStatus.recoveredAt && !myCompletion;
  });
};

/**
 * Get all tasks visible to a user in a project
 * A task is visible if:
 * - User is the creator, OR
 * - User has a task status for this task
 * 
 * Note: In a project context, all tasks should be visible to all project participants.
 * This function is used to filter tasks that the user can see/interact with.
 * 
 * @param tasks - Array of tasks
 * @param userId - User ID to filter by
 * @returns Tasks visible to the user
 */
export const getVisibleTasks = (
  tasks: Task[],
  userId: string | number
): Task[] => {
  const userIdNum = normalizeId(userId);

  return tasks.filter(task => {
    const creatorId = normalizeId(task.creatorId);
    const isCreator = creatorId === userIdNum;
    const hasStatus = task.taskStatus?.some(ts => {
      const tsUserId = normalizeId(ts.userId);
      return tsUserId === userIdNum;
    });
    // Task is visible if user created it OR has a task status for it
    // If task has no statuses yet, it's still visible to the creator
    return isCreator || hasStatus || (task.taskStatus?.length === 0 && isCreator);
  });
};

/**
 * Update tasks with their task statuses
 * 
 * @param tasks - Array of tasks
 * @param taskStatuses - Array of task statuses
 * @returns Tasks with populated taskStatus (matching the Task type field name)
 */
export const updateTasksWithStatuses = (
  tasks: Task[],
  taskStatuses: TaskStatusEntity[]
): Task[] => {
  return tasks.map(task => {
    const taskId = normalizeId(task.id);

    // Create a map of existing statuses by userId for easy merging
    const statusMap = new Map<string | number, TaskStatusEntity>();

    // initialize with existing embedded statuses
    if (task.taskStatus) {
      task.taskStatus.forEach(ts => {
        const tsUserId = normalizeId(ts.userId);
        statusMap.set(tsUserId, ts);
      });
    }

    // Find new/updated statuses for this task from the provided list
    const newStatusesForTask = taskStatuses.filter(ts => {
      const tsTaskId = normalizeId(ts.taskId);
      return tsTaskId === taskId;
    });

    // Merge new statuses into the map (overwriting existing ones)
    newStatusesForTask.forEach(ts => {
      const tsUserId = normalizeId(ts.userId);
      statusMap.set(tsUserId, ts);
    });

    // Convert map back to array
    const mergedStatuses = Array.from(statusMap.values());

    return {
      ...task,
      taskStatus: mergedStatuses
    };
  });
};

/**
 * Get project-wide task buckets (project-level view, not user-specific)
 * Organizes all tasks in a project into categories for the "All" tab
 * 
 * @param tasks - Array of tasks (should already be filtered to a specific project)
 * @returns Object with task buckets: active, upcoming, completed, archived
 */
export const getProjectTaskBuckets = (
  tasks: Task[]
): {
  active: Task[];
  upcoming: Task[];
  completed: Task[];
  archived: Task[];
} => {
  const today = normalizeToStartOfDay(new Date());

  const active: Task[] = [];
  const upcoming: Task[] = [];
  const completed: Task[] = [];
  const archived: Task[] = [];

  tasks.forEach(task => {
    const dueDate = normalizeToStartOfDay(new Date(task.dueDate));
    if (dueDate.getTime() <= today.getTime()) {
      active.push(task);
    } else {
      upcoming.push(task);
    }
  });

  return {
    active,
    upcoming,
    completed,
    archived
  };
};
