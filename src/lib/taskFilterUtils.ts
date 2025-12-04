// ============================================================================
// Task Filter Utilities - Centralized Task Filtering Logic
// ============================================================================
// 
// This file provides standardized utilities for filtering tasks
// that should be used consistently across all components.
// ============================================================================

import type { Task, TaskStatusEntity, CompletionLog, Project, User } from '@/types';

/**
 * Get tasks for today (based on dueDate)
 * 
 * @param tasks - Array of tasks
 * @param userId - Optional user ID to filter by participation
 * @returns Tasks due today
 */
export const getTodayTasks = (
  tasks: Task[],
  userId?: string
): Task[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return tasks.filter(task => {
    const dueDate = new Date(task.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const isToday = dueDate.getTime() === today.getTime();
    
    if (!isToday) return false;
    
    // If userId provided, filter to tasks visible to that user
    if (userId) {
      const isCreator = task.creatorId === userId;
      const hasStatus = task.taskStatuses?.some(ts => ts.userId === userId);
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
export const getProjectTasks = (tasks: Task[], projectId: string): Task[] => {
  return tasks.filter(task => task.projectId === projectId);
};

/**
 * Get tasks for a specific user
 * 
 * @param tasks - Array of tasks
 * @param userId - User ID to filter by
 * @returns Tasks where user is creator or has task status
 */
export const getUserTasks = (tasks: Task[], userId: string): Task[] => {
  return tasks.filter(
    task => task.creatorId === userId || task.taskStatuses?.some(ts => ts.userId === userId)
  );
};

/**
 * Get tasks that need user action (active, not completed, due today or past)
 * 
 * @param tasks - Array of tasks
 * @param taskStatuses - Array of task statuses
 * @param completionLogs - Array of completion logs
 * @param userId - User ID to filter by
 * @param projects - Array of projects (optional, for checking project membership)
 * @returns Tasks needing action
 */
export const getNeedsActionTasks = (
  tasks: Task[],
  taskStatuses: TaskStatusEntity[],
  completionLogs: CompletionLog[],
  userId: string,
  projects?: Project[]
): Task[] => {
  return tasks.filter(task => {
    const myStatus = taskStatuses.find(ts => ts.taskId === task.id && ts.userId === userId);
    const myCompletion = completionLogs.some(cl => cl.taskId === task.id && cl.userId === userId);
    
    const dueDate = new Date(task.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    const isDueTodayOrPast = dueDate.getTime() <= today.getTime();
    
    // Task must be active and due today or past
    const isTaskActive = task.status === 'active' || task.status === 'upcoming';
    if (!isTaskActive || task.status === 'completed') return false;
    if (!isDueTodayOrPast) return false;
    if (myCompletion) return false;
    
    // If user has no status, check if they're in the project
    if (!myStatus) {
      if (projects) {
        const isInProject = isUserInTaskProject(task, userId, projects);
        return isInProject;
      }
      // Fallback: show if creator
      return task.creatorId === userId;
    }
    
    // Active tasks that are not completed
    // EXCLUDE recovered tasks - they should go to Active section, not Needs Action
    return myStatus.status === 'active' && 
           !myStatus.archivedAt && // Exclude tasks that are still archived
           !myStatus.recoveredAt; // Exclude recovered tasks (they go to Active section)
  });
};

/**
 * Check if a user is a participant in a task's project
 * Helper function to determine task visibility
 */
const isUserInTaskProject = (
  task: Task,
  userId: string,
  projects: Project[]
): boolean => {
  const project = projects.find(p => p.id === task.projectId);
  if (!project) return false;
  
  // User is owner
  if (project.ownerId === userId) return true;
  
  // User is in participants array
  if (project.participants?.some(p => {
    const participantId = typeof p === 'object' && 'id' in p ? p.id : p;
    return participantId === userId;
  })) return true;
  
  // User is in participantRoles
  if (project.participantRoles?.some(pr => pr.userId === userId && !pr.removedAt)) return true;
  
  return false;
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
  userId: string,
  projects?: Project[]
): Task[] => {
  return tasks.filter(task => {
    const myStatus = taskStatuses.find(ts => ts.taskId === task.id && ts.userId === userId);
    const myCompletion = completionLogs.some(cl => cl.taskId === task.id && cl.userId === userId);
    
    // Task must be active or upcoming
    const isTaskActive = task.status === 'active' || task.status === 'upcoming';
    if (!isTaskActive) return false;
    
    // User must not have completed it
    if (myCompletion || task.status === 'completed') return false;
    
    // If user has no task status, check if they're in the project
    if (!myStatus) {
      const isCreator = task.creatorId === userId;
      // If projects array provided, check project membership
      if (projects) {
        const isInProject = isUserInTaskProject(task, userId, projects);
        return isInProject && isTaskActive && !myCompletion;
      }
      // Fallback: show if creator
      return isCreator && isTaskActive && !myCompletion;
    }
    
    // User has a status - check if it's active or recovered
    const isUserActive = (myStatus.status === 'active' || myStatus.recoveredAt) && 
                         !myStatus.archivedAt;
    
    return isUserActive && isTaskActive;
  });
};

/**
 * Get active tasks for today (due today, not completed, not archived)
 * 
 * @param tasks - Array of tasks
 * @param taskStatuses - Array of task statuses
 * @param completionLogs - Array of completion logs
 * @param userId - User ID to filter by
 * @param projects - Array of projects (optional, for checking project membership)
 * @returns Active tasks due today
 */
export const getActiveTasksForToday = (
  tasks: Task[],
  taskStatuses: TaskStatusEntity[],
  completionLogs: CompletionLog[],
  userId: string,
  projects?: Project[]
): Task[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return tasks.filter(task => {
    const myStatus = taskStatuses.find(ts => ts.taskId === task.id && ts.userId === userId);
    const myCompletion = completionLogs.some(cl => cl.taskId === task.id && cl.userId === userId);
    
    // Check if task is due today - use effectiveDueDate from status if available, otherwise use task dueDate
    const taskDueDate = myStatus?.effectiveDueDate || task.dueDate;
    const dueDate = new Date(taskDueDate);
    dueDate.setHours(0, 0, 0, 0);
    const isDueToday = dueDate.getTime() === today.getTime();
    
    // Task must be active or upcoming
    const isTaskActive = task.status === 'active' || task.status === 'upcoming';
    if (!isTaskActive || task.status === 'completed') return false;
    if (!isDueToday) return false;
    if (myCompletion) return false;
    
    // If user has no task status, check if they're in the project
    if (!myStatus) {
      const isCreator = task.creatorId === userId;
      // If projects array provided, check project membership
      if (projects) {
        const isInProject = isUserInTaskProject(task, userId, projects);
        return isInProject && isTaskActive && !myCompletion;
      }
      // Fallback: show if creator
      return isCreator && isTaskActive && !myCompletion;
    }
    
    // User has a status - check if it's active or recovered
    const isUserActive = (myStatus.status === 'active' || myStatus.recoveredAt) && 
                         !myStatus.archivedAt;
    
    return isUserActive && isTaskActive;
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
  userId: string
): Task[] => {
  return tasks.filter(task => {
    const myCompletion = completionLogs.some(cl => cl.taskId === task.id && cl.userId === userId);
    // Task is completed if user has a completion log OR task status is completed
    // Also show if user is creator and task is completed
    return myCompletion || (task.status === 'completed' && task.creatorId === userId);
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
  userId: string,
  projects?: Project[]
): Task[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return tasks.filter(task => {
    const myStatus = taskStatuses.find(ts => ts.taskId === task.id && ts.userId === userId);
    const myCompletion = completionLogs.some(cl => cl.taskId === task.id && cl.userId === userId);
    
    const dueDate = new Date(task.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const isDueFuture = dueDate.getTime() > today.getTime();
    
    // Task must be active and due in future
    const isTaskActive = task.status === 'active' || task.status === 'upcoming';
    if (!isTaskActive || task.status === 'completed') return false;
    if (!isDueFuture) return false;
    if (myCompletion) return false;
    
    // If user has no status, check if they're in the project
    if (!myStatus) {
      if (projects) {
        const isInProject = isUserInTaskProject(task, userId, projects);
        return isInProject;
      }
      // Fallback: show if creator
      return task.creatorId === userId;
    }
    
    // Upcoming tasks are active tasks due in the future
    const isUserActive = (myStatus.status === 'active' || myStatus.recoveredAt) && 
                         !myStatus.archivedAt;
    
    return isUserActive;
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
  userId: string
): Task[] => {
  return tasks.filter(task => {
    const myStatus = taskStatuses.find(ts => ts.taskId === task.id && ts.userId === userId);
    const myCompletion = completionLogs.some(cl => cl.taskId === task.id && cl.userId === userId);
    
    // If user has no status but is creator, check if task is archived
    if (!myStatus) {
      const isCreator = task.creatorId === userId;
      return isCreator && task.status === 'archived' && !myCompletion;
    }
    
    // Only show if archived, not recovered, and not completed
    return (myStatus.status === 'archived' || task.status === 'archived') && 
           !myStatus.recoveredAt && 
           !myCompletion;
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
  userId: string
): Task[] => {
  return tasks.filter(task => {
    const isCreator = task.creatorId === userId;
    const hasStatus = task.taskStatuses?.some(ts => ts.userId === userId);
    // Task is visible if user created it OR has a task status for it
    // If task has no statuses yet, it's still visible to the creator
    return isCreator || hasStatus || (task.taskStatuses?.length === 0 && isCreator);
  });
};

/**
 * Update tasks with their task statuses
 * 
 * @param tasks - Array of tasks
 * @param taskStatuses - Array of task statuses
 * @returns Tasks with populated taskStatuses
 */
export const updateTasksWithStatuses = (
  tasks: Task[],
  taskStatuses: TaskStatusEntity[]
): Task[] => {
  return tasks.map(task => ({
    ...task,
    taskStatuses: taskStatuses.filter(ts => ts.taskId === task.id)
  }));
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const active: Task[] = [];
  const upcoming: Task[] = [];
  const completed: Task[] = [];
  const archived: Task[] = [];
  
  tasks.forEach(task => {
    // Check task status
    if (task.status === 'completed') {
      completed.push(task);
      return;
    }
    
    if (task.status === 'archived') {
      archived.push(task);
      return;
    }
    
    // For active/upcoming tasks, check due date
    if (task.status === 'active' || task.status === 'upcoming') {
      const dueDate = new Date(task.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const isDueTodayOrPast = dueDate.getTime() <= today.getTime();
      const isDueFuture = dueDate.getTime() > today.getTime();
      
      if (isDueTodayOrPast) {
        active.push(task);
      } else if (isDueFuture) {
        upcoming.push(task);
      } else {
        // Default to active if date comparison fails
        active.push(task);
      }
    }
  });
  
  return {
    active,
    upcoming,
    completed,
    archived
  };
};
