// ============================================================================
// Modular Task Utilities - Single Source of Truth for Task Logic
// ============================================================================
// 
// This file provides standardized, reusable utilities for task-related logic
// that should be used consistently across all components.
// ============================================================================

import type { TaskStatusEntity, CompletionLog, RingColor, TaskStatus, Task } from '@/types';
import { normalizeId } from '../idUtils';

/**
 * Calculate the task status user status based on due date, completion, and recovery
 * 
 * Rules:
 * - "Active": when due date is today but user hasn't marked it complete yet
 * - "Completed": when user has marked it as completed
 * - "Archived": when user doesn't mark as completed and due date has passed
 * - "Recovered": when user has recovered the task (recoveredAt is set)
 * - "Upcoming": when task's due date is after today's date
 * 
 * @param taskStatus - The user's task status entity
 * @param completionLog - The completion log for this user (if completed)
 * @param task - The task entity (for checking due date)
 * @returns The calculated task status user status
 */
export const calculateTaskStatusUserStatus = (
  taskStatus: TaskStatusEntity | undefined,
  completionLog: CompletionLog | undefined,
  task: Task
): TaskStatus => {
  // Completed always wins
  if (completionLog || taskStatus?.status === 'completed') {
    return 'completed';
  }

  // Use task dueDate (effectiveDueDate not in TaskStatusEntity type)
  const effectiveDueDate = normalizeToStartOfDay(new Date(task.dueDate));
  const today = normalizeToStartOfDay(new Date());
  const isPastDue = effectiveDueDate.getTime() < today.getTime();

  // Recovered status: if task was recovered, it stays active until END OF the recovery day
  // A recovered task gives the user a chance to complete it for the rest of the day they recovered it
  // The "new due date" is the end of the day when recoveredAt was set
  if (taskStatus?.recoveredAt || taskStatus?.status === 'recovered') {
    // If we have a specific recoveredAt timestamp, check if we're still within that day
    if (taskStatus?.recoveredAt) {
      const now = new Date();
      const recoveryDayEnd = new Date(taskStatus.recoveredAt);
      recoveryDayEnd.setHours(23, 59, 59, 999); // End of recovery day

      // If current time is within recovery day (before end of day), task is still recovered
      if (now <= recoveryDayEnd) {
        return 'recovered';
      }

      // If past end of recovery day, it has expired again -> back to archived
      return 'archived';
    }

    // If status is 'recovered' but no recoveredAt timestamp, treat as recovered for today
    return 'recovered';
  }

  // Explicit archived flag from user status takes precedence over date check
  // But only if not recovered (checked above)
  if (taskStatus?.status === 'archived' || (taskStatus?.archivedAt && !taskStatus?.recoveredAt)) {
    return 'archived';
  }

  if (effectiveDueDate.getTime() > today.getTime()) {
    return 'upcoming';
  }

  if (effectiveDueDate.getTime() === today.getTime()) {
    return 'active';
  }

  // Past due and not completed/recovered -> archived
  return 'archived';
};

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
 * 1. Archived (RED) - Takes absolute precedence over all other checks
 *    - Tasks automatically archived after due date (not completed)
 *    - Recovered tasks that haven't been completed yet (archivedAt stays)
 *    - When recovering: archivedAt STAYS until task is completed
 * 2. Recovered + Completed (YELLOW) - Recovered task, then completed
 * 3. Completed On-Time (GREEN) - On/before due date
 * 4. Completed Late (NONE) - After due date
 * 5. Expired (RED) - Past due date, not completed
 * 6. Otherwise (NONE) - Active/Upcoming tasks
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
  // ============================================================================
  // PRIORITY 1: ARCHIVED TASKS ALWAYS SHOW RED (absolute precedence)
  // ============================================================================
  // Archived status takes precedence over all other ring color logic
  // This includes:
  // - Tasks that expired automatically (past due, not completed)
  // - Recovered tasks that haven't been completed yet (archivedAt stays, recoveredAt set)
  // - Any task with archivedAt timestamp set
  //
  // CRITICAL: When recovering an archived task, archivedAt STAYS.
  // The task remains "archived" with red ring until the user completes it.
  // At that point, completedAt is set and ring color recalculates based on timing.
  // ============================================================================
  if (taskStatus?.archivedAt && taskStatus.archivedAt !== null) {
    return 'red';
  }

  // ============================================================================
  // PRIORITY 2: RECOVERED TASKS SHOW YELLOW (if not archived)
  // ============================================================================
  // Recovered tasks show yellow ring until end of recovery day
  // After recovery day expires, Priority 1 catches them as red (archivedAt set)
  if (taskStatus?.recoveredAt || taskStatus?.status === 'recovered') {
    // Check if recovered task has expired again
    // The "new due date" for recovered tasks is END of day they were recovered
    if (taskStatus?.recoveredAt) {
      const now = new Date();
      const recoveryDayEnd = new Date(taskStatus.recoveredAt);
      recoveryDayEnd.setHours(23, 59, 59, 999); // End of recovery day

      // If current time is past end of recovery day, Priority 1 will catch as red
      if (now <= recoveryDayEnd) {
        return 'yellow';  // Within recovery day
      }
    }
    // Outside recovery day or no timestamp: fallback to red (caught by Priority 1 if archivedAt set)
    return 'red';
  }

  // ============================================================================
  // PRIORITY 3: COMPLETED TASKS - Use stored or calculate timing
  // ============================================================================
  if (completionLog) {
    // Yellow: recovered task (already checked above, but keep for safety)
    if (taskStatus?.recoveredAt) {
      return 'yellow';
    }

    // BEST PRACTICE: Trust stored ringColor if it exists
    // The ringColor was set at completion time with correct calculation
    // This prevents mismatches when recalculating with current dates
    if (taskStatus?.ringColor) {
      return taskStatus.ringColor;
    }

    // FALLBACK: Calculate from dates only if no stored ringColor
    // (This handles legacy data or edge cases where ringColor wasn't stored)
    const completionDate = normalizeToStartOfDay(new Date(completionLog.createdAt));
    const taskDueDate = normalizeToStartOfDay(new Date(task?.dueDate || new Date()));

    // On or before due date: GREEN
    if (completionDate.getTime() <= taskDueDate.getTime()) {
      return 'green';
    }

    // Late completion but not recovered: NONE
    return 'none';
  }

  if (!taskStatus) return 'none';

  // ============================================================================
  // PRIORITY 4: EXPIRED TASKS SHOW RED (archivedAt is null but past due)
  // ============================================================================
  // Task is expired if current time is past due date
  // Only show red if task is not completed (no completion log)
  if (task && task.dueDate) {
    const now = new Date();
    const dueDateEnd = new Date(task.dueDate);
    dueDateEnd.setHours(23, 59, 59, 999); // End of due date

    // Task is expired if current time is past due date
    if (now > dueDateEnd) {
      // Only show red if task is not completed
      if (!completionLog) {
        return 'red';
      }
    }
  }

  // ============================================================================
  // PRIORITY 5: ACTIVE/UPCOMING TASKS
  // ============================================================================
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

  // PRIORITY 2.5: Check if task is recovered - show yellow ring immediately
  // This takes precedence over stored ringColor to ensure instant feedback after recovery
  if (taskStatus.recoveredAt || taskStatus.status === 'recovered') {
    // Check if recovery has expired (past end of recovery day)
    if (taskStatus.recoveredAt) {
      const now = new Date();
      const recoveryDayEnd = new Date(taskStatus.recoveredAt);
      recoveryDayEnd.setHours(23, 59, 59, 999); // End of recovery day

      // If past recovery day, show red (expired again)
      if (now > recoveryDayEnd) {
        return 'ring-red-500';
      }
    }
    // Within recovery day, show yellow
    return 'ring-yellow-500';
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
    case 'archived':
      return 'archived';
    case 'completed':
      return 'completed';
    case 'recovered':
      return 'active';
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
  if (completionLog) return false; // Already completed

  // Calculate status - if we have a task, use the full calculation (handles missing taskStatus)
  // Otherwise, fall back to the taskStatus's explicit status or default to 'active'
  const computedStatus = task ? calculateTaskStatusUserStatus(taskStatus, completionLog, task) : (taskStatus?.status || 'active');

  // Recovered tasks can always be completed from today's view
  if (taskStatus?.recoveredAt || computedStatus === 'recovered') {
    return true;
  }

  // Only allow completion for active (due today) tasks
  return computedStatus === 'active';
};

/**
 * Check if a task can be recovered by the current user
 * Tasks can be recovered when the user's task status is archived (past due and not completed)
 * and the task has not already been recovered or completed.
 * 
 * @param taskStatus - The user's task status entity (optional - task can be archived at task level)
 * @param completionLog - The completion log for this user (if completed)
 * @param task - Optional task entity to check task-level archived status
 * @returns True if the task can be recovered
 */
export const canRecoverTask = (
  taskStatus: TaskStatusEntity | undefined,
  completionLog: CompletionLog | undefined,
  task?: Task
): boolean => {
  if (completionLog) return false;
  if (!taskStatus && !task) return false;

  // Already recovered
  if (taskStatus?.recoveredAt || taskStatus?.status === 'recovered') return false;

  const computedStatus = task
    ? calculateTaskStatusUserStatus(taskStatus, completionLog, task)
    : taskStatus?.status;

  return computedStatus === 'archived';
};

/**
 * Get status badge variant for UI
 * 
 * @param uiStatus - The UI status ('active', 'completed', 'archived')
 * @returns Badge variant string
 */
export const getStatusBadgeVariant = (
  uiStatus: TaskStatus
): 'default' | 'secondary' | 'outline' => {
  switch (uiStatus) {
    case 'completed':
      return 'default';
    case 'active':
    case 'upcoming':
    case 'recovered':
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
export const getStatusColor = (
  uiStatus: TaskStatus
): string => {
  switch (uiStatus) {
    case 'active':
      return 'text-primary';
    case 'upcoming':
      return 'text-muted-foreground';
    case 'recovered':
      return 'text-accent';
    case 'completed':
      return 'text-status-completed';
    case 'archived':
      return 'text-muted-foreground';
    default:
      return 'text-muted-foreground';
  }
};
