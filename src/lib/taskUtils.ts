// ============================================================================
// Modular Task Utilities - Single Source of Truth for Task Logic
// ============================================================================
// 
// This file provides standardized, reusable utilities for task-related logic
// that should be used consistently across all components.
// ============================================================================

import type { TaskStatusEntity, CompletionLog, RingColor, TaskStatus, TaskStatusUserStatus, Task } from '@/types';

/**
 * Normalize a date to the start of the day (00:00:00.000)
 * Ensures tasks treat due dates as date-only values.
 */
export const normalizeToStartOfDay = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

/**
 * Calculate ring color value (RingColor type) based on completion log and task status
 * This is the core logic for determining ring color that should be used consistently
 * 
 * Rules (in priority order):
 * 1. If completed: Green (on-time/early), Yellow (recovered), or None (late)
 * 2. If task is archived: Red for all participants
 * 3. If task has expired (past due date): Red for all participants
 * 4. If individual status is archived: Red
 * 5. If recovered but not completed: Yellow
 * 6. Otherwise: None
 * 
 * @param completionLog - The completion log for this user (if completed)
 * @param taskStatus - The user's task status entity
 * @param task - The task entity (for checking overall task status and due date)
 * @returns The ring color value
 */
export const calculateRingColor = (
  completionLog: CompletionLog | undefined,
  taskStatus: TaskStatusEntity | undefined,
  task?: Task
): RingColor => {
  // PRIORITY 1: If completed, determine color based on recovery and timing
  if (completionLog) {
    // Yellow: recovered task (always yellow when completed after recovery)
    if (completionLog.recoveredCompletion || taskStatus?.recoveredAt) {
      return 'yellow';
    }
    
    // Green: completed on time or early
    if (completionLog.timingStatus === 'on_time' || completionLog.timingStatus === 'early') {
      return 'green';
    }
    
    // None: late completion but not recovered
    return 'none';
  }

  // PRIORITY 2: If task is archived, all participants should have red ring
  if (task && task.status === 'archived') {
    return 'red';
  }

  // PRIORITY 3: If task has expired (past due date), all participants should have red ring
  if (task && task.dueDate) {
    const now = new Date();
    const dueDateEnd = new Date(task.dueDate);
    dueDateEnd.setHours(23, 59, 59, 999); // End of due date
    
    // Task is expired if current time is past the due date
    if (now > dueDateEnd) {
      // Only show red if task is not completed (no completion log)
      return 'red';
    }
  }

  if (!taskStatus) return 'none';

  // PRIORITY 4: If individual task status is archived, show red
  if (taskStatus.archivedAt) {
    return 'red';
  }

  // PRIORITY 5: Check if individual status has expired (user-specific due date)
  const dueDate = taskStatus.effectiveDueDate || task?.dueDate;
  if (dueDate) {
    const now = new Date();
    const dueDateOnly = new Date(dueDate);
    dueDateOnly.setHours(23, 59, 59, 999); // End of due date
    
    // Task is expired if current time is past the due date
    if (now > dueDateOnly) {
      return 'red';
    }
  }

  // PRIORITY 6: Yellow: recovered but not yet completed
  if (taskStatus.recoveredAt) {
    return 'yellow';
  }

  // PRIORITY 7: No highlight: active task
  return 'none';
};

/**
 * Calculate ring color CSS class for avatar highlighting based on task status and completion
 * 
 * This function prioritizes completion logs over taskStatus.ringColor to ensure
 * accurate ring colors are displayed. The completion log has the most accurate
 * information about when and how a task was completed.
 * 
 * Rules:
 * - Green: when a user completes a task on time/early (timingStatus: 'on_time' or 'early')
 * - Yellow: when a user completes a recovered task or has recovered but not completed
 * - Red: when a task is expired (past due date) and not completed, OR archived but not completed
 * - No highlight: when a task is completed late but not recovered
 * 
 * @param taskStatus - The user's task status entity
 * @param completionLog - The completion log for this user (if completed)
 * @param task - The task entity (for checking overall task status and due date)
 * @returns The ring color class name
 */
export const getRingColor = (
  taskStatus: TaskStatusEntity | undefined,
  completionLog: CompletionLog | undefined,
  task?: Task
): string => {
  // PRIORITY 1: Use completion log if it exists (most accurate source of truth)
  // This ensures green ring shows immediately when task is completed
  if (completionLog) {
    const calculatedColor = calculateRingColor(completionLog, taskStatus, task);
    switch (calculatedColor) {
      case 'green':
        return 'ring-green-500';
      case 'yellow':
        return 'ring-yellow-500';
      case 'red':
        return 'ring-red-500';
      case 'none':
        return 'ring-border';
    }
  }

  if (!taskStatus) {
    // If no task status but we have task, check if task is archived or expired
    if (task) {
      const calculatedColor = calculateRingColor(undefined, undefined, task);
      switch (calculatedColor) {
        case 'green':
          return 'ring-green-500';
        case 'yellow':
          return 'ring-yellow-500';
        case 'red':
          return 'ring-red-500';
        case 'none':
          return 'ring-border';
      }
    }
    return 'ring-border';
  }

  // PRIORITY 2: If task status is completed but no completion log found, 
  // check if ringColor is set (this handles edge cases where completion log might not be passed)
  if (taskStatus.status === 'completed' && taskStatus.ringColor) {
    switch (taskStatus.ringColor) {
      case 'green':
        return 'ring-green-500';
      case 'yellow':
        return 'ring-yellow-500';
      case 'red':
        return 'ring-red-500';
      case 'none':
        return 'ring-border';
    }
  }

  // PRIORITY 3: Use taskStatus.ringColor if set (for non-completed tasks with explicit ring color)
  // BUT: Override with task-level checks (archived/expired) if task is provided
  if (taskStatus.ringColor && task) {
    // Check if task-level status should override individual ringColor
    const calculatedColor = calculateRingColor(undefined, taskStatus, task);
    // If calculated color is red (archived/expired), use it instead of stored ringColor
    if (calculatedColor === 'red') {
      return 'ring-red-500';
    }
  }

  if (taskStatus.ringColor) {
    switch (taskStatus.ringColor) {
      case 'green':
        return 'ring-green-500';
      case 'yellow':
        return 'ring-yellow-500';
      case 'red':
        return 'ring-red-500';
      case 'none':
        return 'ring-border';
    }
  }

  // PRIORITY 4: Calculate from task status and task entity (for non-completed tasks)
  const calculatedColor = calculateRingColor(undefined, taskStatus, task);
  switch (calculatedColor) {
    case 'green':
      return 'ring-green-500';
    case 'yellow':
      return 'ring-yellow-500';
    case 'red':
      return 'ring-red-500';
    case 'none':
      return 'ring-border';
  }
};

/**
 * Map task status to UI-friendly display status
 * Only returns: 'active', 'completed', 'archived'
 * 
 * @param status - The task status
 * @returns UI-friendly status string
 */
export const mapTaskStatusForUI = (status: TaskStatus): 'active' | 'completed' | 'archived' => {
  switch (status) {
    case 'active':
    case 'upcoming':
      return 'active';
    case 'completed':
      return 'completed';
    case 'archived':
      return 'archived';
    default:
      return 'active';
  }
};

/**
 * Check if a task can be completed by the current user
 * Users can only complete tasks that are due today (not upcoming tasks)
 * 
 * @param taskStatus - The user's task status entity
 * @param completionLog - The completion log for this user (if completed)
 * @param task - Optional task entity to check due date
 * @returns True if the task can be completed
 */
export const canCompleteTask = (
  taskStatus: TaskStatusEntity | undefined,
  completionLog: CompletionLog | undefined,
  task?: Task
): boolean => {
  if (!taskStatus) return false;
  if (completionLog) return false; // Already completed
  if (taskStatus.status === 'archived') return false; // Archived tasks need recovery first
  if (taskStatus.status !== 'active') return false;
  
  // Check if task is due today - users can only complete tasks due today
  if (task || taskStatus.effectiveDueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const taskDueDate = task?.dueDate || taskStatus.effectiveDueDate;
    const dueDate = normalizeToStartOfDay(new Date(taskDueDate));
    const isDueToday = dueDate.getTime() === today.getTime();
    
    // Only allow completion if task is due today
    return isDueToday;
  }
  
  // If no due date info, allow completion (fallback for edge cases)
  return true;
};

/**
 * Check if a task can be recovered by the current user
 * 
 * A task can be recovered if:
 * 1. The task itself is archived (task.status === 'archived'), OR
 * 2. The user's task status is archived (taskStatus.status === 'archived' OR taskStatus.archivedAt is set)
 * AND the task has not been completed by the user
 * AND the task has not been recovered yet (taskStatus.recoveredAt is not set)
 * 
 * @param taskStatus - The user's task status entity (optional - task can be archived at task level)
 * @param taskOverallStatus - The overall task status
 * @param completionLog - The completion log for this user (if completed)
 * @param task - Optional task entity to check task-level archived status
 * @returns True if the task can be recovered
 */
export const canRecoverTask = (
  taskStatus: TaskStatusEntity | undefined,
  taskOverallStatus: TaskStatus,
  completionLog: CompletionLog | undefined,
  task?: Task
): boolean => {
  // Already completed, can't recover
  if (completionLog) return false;
  
  // Check if task is archived at task level
  const isTaskArchived = taskOverallStatus === 'archived' || (task?.status === 'archived');
  
  // If task is archived at task level, user can always recover if they haven't completed it
  // Task-level archiving takes precedence - even if user previously recovered it,
  // they can recover it again when the task is archived at task level
  if (isTaskArchived) {
    // User can recover if they haven't completed it (recoveredAt status is ignored for task-level archived tasks)
    return true;
  }
  
  // If task is not archived at task level, check user's taskStatus
  if (!taskStatus) return false;
  
  // Can recover if user's status is archived and not recovered yet
  return (taskStatus.status === 'archived' || 
         (taskStatus.archivedAt !== undefined && taskStatus.archivedAt !== null)) &&
         !taskStatus.recoveredAt; // Not already recovered
};

/**
 * Get status badge variant for UI
 * 
 * @param uiStatus - The UI status ('active', 'completed', 'archived')
 * @returns Badge variant string
 */
export const getStatusBadgeVariant = (uiStatus: 'active' | 'completed' | 'archived'): 'default' | 'secondary' | 'outline' => {
  switch (uiStatus) {
    case 'completed':
      return 'default';
    case 'active':
      return 'secondary';
    case 'archived':
      return 'outline';
    default:
      return 'outline';
  }
};

/**
 * Get status color class for UI
 * 
 * @param uiStatus - The UI status ('active', 'completed', 'archived')
 * @returns Color class string
 */
export const getStatusColor = (uiStatus: 'active' | 'completed' | 'archived'): string => {
  switch (uiStatus) {
    case 'active':
      return 'text-primary';
    case 'completed':
      return 'text-status-completed';
    case 'archived':
      return 'text-muted-foreground';
    default:
      return 'text-muted-foreground';
  }
};


