// ============================================================================
// Modular Task Utilities - Single Source of Truth for Task Logic
// ============================================================================
// 
// This file provides standardized, reusable utilities for task-related logic
// that should be used consistently across all components.
// ============================================================================

import { TaskStatusEntity, CompletionLog, RingColor, TaskStatus, TaskStatusUserStatus } from '@/types';

/**
 * Calculate ring color for avatar highlighting based on task status and completion
 * 
 * Rules:
 * - Green: when a user completes a task on time/early (timingStatus: 'on_time' or 'early')
 * - Yellow: when a user completes a recovered task or has recovered but not completed
 * - Red: when a task is expired (past due date) and not completed, OR archived but not completed
 * - No highlight: when a task is completed late but not recovered
 * 
 * @param taskStatus - The user's task status entity
 * @param completionLog - The completion log for this user (if completed)
 * @param taskDueDate - Optional task due date to check for expiration
 * @returns The ring color class name
 */
export const getRingColor = (
  taskStatus: TaskStatusEntity | undefined,
  completionLog: CompletionLog | undefined,
  taskDueDate?: Date
): string => {
  if (!taskStatus) return 'ring-border';

  // If taskStatus has ringColor set, use it (highest priority)
  // This ensures green ring shows for completed tasks even after moving to "Done for the day"
  if (taskStatus.ringColor) {
    switch (taskStatus.ringColor) {
      case 'green':
        return 'ring-green-500';
      case 'yellow':
        return 'ring-yellow-500';
      case 'red':
        return 'ring-red-500';
      case 'none':
        // If 'none' but completed, check completion log for proper color
        if (completionLog) {
          // Fall through to completion log check below
          break;
        }
        return 'ring-border';
    }
  }

  // If completed, determine color based on recovery and timing
  if (completionLog) {
    // Yellow: recovered task (always yellow when completed after recovery)
    if (completionLog.recoveredCompletion || taskStatus.recoveredAt) {
      return 'ring-yellow-500';
    }
    
    // Green: completed on time or early
    if (completionLog.timingStatus === 'on_time' || completionLog.timingStatus === 'early') {
      return 'ring-green-500';
    }
    
    // None: late completion but not recovered
    return 'ring-border';
  }

  // Red: expired task (past due date) and not completed
  // Check if task is expired (past due date) and not completed
  // Use effectiveDueDate (user-specific) if available, otherwise use task due date
  const dueDate = taskStatus.effectiveDueDate || taskDueDate;
  if (dueDate && !completionLog) {
    const now = new Date();
    const dueDateOnly = new Date(dueDate);
    dueDateOnly.setHours(23, 59, 59, 999); // End of due date
    
    // Task is expired if current time is past the due date
    if (now > dueDateOnly) {
      return 'ring-red-500';
    }
  }

  // Red: archived but not completed
  if (taskStatus.archivedAt && !completionLog) {
    return 'ring-red-500';
  }

  // Yellow: recovered but not yet completed
  if (taskStatus.recoveredAt) {
    return 'ring-yellow-500';
  }

  // No highlight: active task
  return 'ring-border';
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
 * 
 * @param taskStatus - The user's task status entity
 * @param completionLog - The completion log for this user (if completed)
 * @returns True if the task can be completed
 */
export const canCompleteTask = (
  taskStatus: TaskStatusEntity | undefined,
  completionLog: CompletionLog | undefined
): boolean => {
  if (!taskStatus) return false;
  if (completionLog) return false; // Already completed
  if (taskStatus.status === 'archived') return false; // Archived tasks need recovery first
  return taskStatus.status === 'active';
};

/**
 * Check if a task can be recovered by the current user
 * 
 * @param taskStatus - The user's task status entity
 * @param taskOverallStatus - The overall task status
 * @returns True if the task can be recovered
 */
export const canRecoverTask = (
  taskStatus: TaskStatusEntity | undefined,
  taskOverallStatus: TaskStatus,
  completionLog: CompletionLog | undefined
): boolean => {
  if (!taskStatus) return false;
  if (completionLog) return false; // Already completed, can't recover
  // Can recover if archived and not recovered yet
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

