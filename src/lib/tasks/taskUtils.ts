// ============================================================================
// Modular Task Utilities - Single Source of Truth for Task Logic
// ============================================================================
// 
// This file provides standardized, reusable utilities for task-related logic
// that should be used consistently across all components.
// ============================================================================

import type { TaskStatusEntity, CompletionLog, RingColor, TaskStatus, Task } from '@/types';
import { normalizeId } from '../idUtils';
import { STATUS_COLORS } from '@/constants/statusColors';

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
 * 1. If completed on-time/early: Green
 * 2. If completed late (after due date): Yellow (tardy)
 * 3. If recovered but not completed: Red
 * 4. If task is archived: Red
 * 5. If task has expired (past due date): Red
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
  // PRIORITY 1: If completed, determine color based on timing
  if (completionLog) {
    // Green: completed on time or early
    const completionDate = normalizeToStartOfDay(new Date(completionLog.createdAt));
    const taskDueDate = normalizeToStartOfDay(new Date(task?.dueDate || new Date()));
    if (completionDate.getTime() <= taskDueDate.getTime()) {
      return 'green';
    }

    // Yellow: late completion (tardy) - completed after deadline
    return 'yellow';
  }

  if (!taskStatus) return 'none';

  // PRIORITY 2: Check if task is recovered but NOT completed
  // Recovered-but-not-completed tasks show RED (expired)
  if ((taskStatus?.recoveredAt || taskStatus?.status === 'recovered') && !completionLog) {
    // Check if the recovered task has expired again
    if (taskStatus.recoveredAt) {
      const now = new Date();
      const recoveryDayEnd = new Date(taskStatus.recoveredAt);
      recoveryDayEnd.setHours(23, 59, 59, 999); // End of recovery day

      // If current time is past end of recovery day, task expired again -> red
      if (now > recoveryDayEnd) {
        return 'red';
      }
    }
    // Within recovery day but not completed, still show red (recovered tasks are still expired)
    return 'red';
  }

  // PRIORITY 3: Check if task status user status would be archived (past due, not completed)
  // Note: General task status only includes 'active' and 'upcoming', so we check via taskStatus
  if (task && taskStatus && taskStatus.archivedAt) {
    return 'red';
  }

  // PRIORITY 4: If task has expired (past due date), all participants should have red ring
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

  // PRIORITY 5: If individual task status is archived, show red
  if (taskStatus.archivedAt) {
    return 'red';
  }

  // PRIORITY 6: Check if individual status has expired (use task dueDate)
  // Note: effectiveDueDate not in TaskStatusEntity type
  if (task?.dueDate) {
    const now = new Date();
    const dueDateOnly = new Date(task.dueDate);
    dueDateOnly.setHours(23, 59, 59, 999); // End of due date

    // Task is expired if current time is past the due date
    if (now > dueDateOnly) {
      return 'red';
    }
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
 * - Green: on-time/early completion
 * - Yellow: late completion (tardy)
 * - Red: expired, archived, or recovered-but-not-completed
 * - No highlight: active task (not completed, not expired)
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
        return 'ring-[#10B981]';
      case 'yellow':
        return 'ring-[#FCD34D]';
      case 'red':
        return 'ring-[#EF4444]';
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
          return 'ring-[#10B981]';
        case 'yellow':
          return 'ring-[#FCD34D]';
        case 'red':
          return 'ring-[#EF4444]';
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
        return 'ring-[#10B981]';
      case 'yellow':
        return 'ring-[#FCD34D]';
      case 'red':
        return 'ring-[#EF4444]';
      case 'none':
        return 'ring-border';
    }
  }

  // PRIORITY 2.5: Check if task is recovered but NOT completed - show red ring
  // Recovered-but-not-completed tasks should show red (expired)
  // Completed tasks are handled in PRIORITY 1 using calculateRingColor
  if (!completionLog && (taskStatus.recoveredAt || taskStatus.status === 'recovered')) {
    // Check if recovery has expired (past end of recovery day)
    if (taskStatus.recoveredAt) {
      const now = new Date();
      const recoveryDayEnd = new Date(taskStatus.recoveredAt);
      recoveryDayEnd.setHours(23, 59, 59, 999); // End of recovery day

      // If past recovery day, show red (expired again)
      if (now > recoveryDayEnd) {
        return 'ring-[#EF4444]';
      }
    }
    // Within recovery day but not completed, still show red (recovered tasks are still expired)
    return 'ring-[#EF4444]';
  }

  // PRIORITY 3: Use taskStatus.ringColor if set (for non-completed tasks with explicit ring color)
  // BUT: Override with task-level checks (archived/expired) if task is provided
  if (taskStatus.ringColor && task) {
    // Check if task-level status should override individual ringColor
    const calculatedColor = calculateRingColor(undefined, taskStatus, task);
    // If calculated color is red (archived/expired), use it instead of stored ringColor
    if (calculatedColor === 'red') {
      return 'ring-[#EF4444]';
    }
  }

  if (taskStatus.ringColor) {
    switch (taskStatus.ringColor) {
      case 'green':
        return 'ring-[#10B981]';
      case 'yellow':
        return 'ring-[#FCD34D]';
      case 'red':
        return 'ring-[#EF4444]';
      case 'none':
        return 'ring-border';
    }
  }

  // PRIORITY 4: Calculate from task status and task entity (for non-completed tasks)
  const calculatedColor = calculateRingColor(undefined, taskStatus, task);
  switch (calculatedColor) {
    case 'green':
      return 'ring-[#10B981]';
    case 'yellow':
      return 'ring-[#FCD34D]';
    case 'red':
      return 'ring-[#EF4444]';
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
      return 'text-[#FCD34D]';
    case 'completed':
      return 'text-[#10B981]';
    case 'archived':
      return 'text-muted-foreground';
    default:
      return 'text-muted-foreground';
  }
};
