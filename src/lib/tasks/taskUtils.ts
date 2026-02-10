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
import {
  isPastDue,
  isDueToday,
  normalizeToEndOfDay,
} from '../datetime/datetimeUtils';

/**
 * Calculate the task status user status based on due date-time, completion, and recovery
 *
 * Rules:
 * - "Active": when due date-time is today (any time) but user hasn't marked it complete yet
 * - "Completed": when user has marked it as completed
 * - "Archived": when user doesn't mark as completed and due date-time has passed
 * - "Recovered": when user has recovered the task (recoveredAt is set)
 * - "Upcoming": when task's due date-time is after today's date
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

  const now = new Date();
  const dueDateTime = new Date(task.dueDate);

  // Check if task is past due (considering time)
  const pastDue = isPastDue(dueDateTime, now);

  // Recovered status: if task was recovered, it stays active until END OF the recovery day
  // A recovered task gives the user a chance to complete it for the rest of the day they recovered it
  // The "new due date" is the end of the day when recoveredAt was set
  if (taskStatus?.recoveredAt || taskStatus?.status === 'recovered') {
    // If we have a specific recoveredAt timestamp, check if we're still within that day
    if (taskStatus?.recoveredAt) {
      const recoveryDayEnd = normalizeToEndOfDay(taskStatus.recoveredAt);

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

  // Check if task is past due (considering time)
  // If due time has passed, it's archived (unless completed/recovered, checked above)
  if (pastDue) {
    return 'archived';
  }

  // Check if due today (date only)
  if (isDueToday(dueDateTime, now)) {
    return 'active';
  }

  // Future due date
  return 'upcoming';
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
 *    - Tasks automatically archived after due date-time (not completed)
 *    - Recovered tasks that haven't been completed yet (archivedAt stays)
 *    - When recovering: archivedAt STAYS until task is completed
 * 2. Recovered + Completed (YELLOW) - Recovered task, then completed
 * 3. Completed On-Time (GREEN) - On/before due date-time
 * 4. Completed Late (NONE) - After due date-time
 * 5. Expired (RED) - Past due date-time, not completed
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
  // PRIORITY 1: COMPLETED TASKS - Always show completion color if log exists
  // ============================================================================
  // This is the core fix: completion status must take precedence over
  // automatic expiration or manual archival for display purposes.
  if (completionLog) {
    // 1a. Recovered tasks always show yellow on completion
    if (taskStatus?.recoveredAt || taskStatus?.status === 'recovered') {
      return 'yellow';
    }

    // 1b. Trust stored ringColor if it exists (set at completion time)
    if (taskStatus?.ringColor) {
      // If it's red but we have a completion log, it's a BUG in data, 
      // but we should show yellow (tardy) as a safe fallback
      if (taskStatus.ringColor === 'red') return 'yellow';
      return taskStatus.ringColor;
    }

    // 1c. Fallback: Calculate from dates if no stored color
    const completionTime = new Date(completionLog.createdAt);
    const dueTime = new Date(task?.dueDate || new Date());

    // On or before due date-time: GREEN, else YELLOW (tardy)
    return completionTime.getTime() <= dueTime.getTime() ? 'green' : 'yellow';
  }

  // ============================================================================
  // PRIORITY 2: ARCHIVED TASKS SHOW RED (if not completed)
  // ============================================================================
  // This includes:
  // - Tasks that expired automatically (past due date-time, not completed)
  // - Any task with archivedAt timestamp set
  if (taskStatus?.archivedAt && taskStatus.archivedAt !== null) {
    return 'red';
  }

  // ============================================================================
  // PRIORITY 3: RECOVERED TASKS SHOW YELLOW (if not archived/completed)
  // ============================================================================
  // Recovered tasks show yellow ring until end of recovery day
  if (taskStatus?.recoveredAt || taskStatus?.status === 'recovered') {
    if (taskStatus?.recoveredAt) {
      const now = new Date();
      const recoveryDayEnd = new Date(taskStatus.recoveredAt);
      recoveryDayEnd.setHours(23, 59, 59, 999);

      if (now <= recoveryDayEnd) {
        return 'yellow';
      }
    }
    // If past recovery day and not completed, Priority 2 should have caught it if archivedAt was set.
    // If not, we fallback to red here as it's definitely expired.
    return 'red';
  }

  // PRIORITY 4 is now redundant as completionLog is checked first

  if (!taskStatus) return 'none';

  // ============================================================================
  // PRIORITY 4: EXPIRED TASKS SHOW RED (archivedAt is null but past due)
  // ============================================================================
  // Task is expired if current time is past due date
  // Only show red if task is not completed (no completion log)


  // PRIORITY 3: Check if task status user status would be archived (past due, not completed)
  // Note: General task status only includes 'active' and 'upcoming', so we check via taskStatus
  if (task && taskStatus && taskStatus.archivedAt) {
    return 'red';
  }

  // PRIORITY 4: If task has expired (past due date-time), all participants should have red ring
  if (task && task.dueDate) {
    const now = new Date();
    const dueTime = new Date(task.dueDate);

    // Task is expired if current time is past due date-time
    if (now.getTime() > dueTime.getTime()) {
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
  // Use calculateRingColor as the single source of truth for color determination
  const color = calculateRingColor(completionLog, taskStatus, task);

  switch (color) {
    case 'green':
      return 'ring-[#10B981]';
    case 'yellow':
      return 'ring-[#FCD34D]';
    case 'red':
      return 'ring-[#EF4444]';
    case 'none':
    default:
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

/**
 * Check if a task can be edited by the current user
 *
 * Rules:
 * - Upcoming tasks: Can always be edited/deleted by authorized users
 * - Active tasks (Due Today): Can be edited/deleted (fixes owner management on due date)
 * - Recovered tasks: Treated as active, so can be edited/deleted
 * - Completed/Archived: Cannot be edited to maintain history/prevent XP cheating
 *
 * @param taskStatus - The user's task status entity
 * @param completionLog - The completion log for this user (if completed)
 * @param task - The task entity (for checking due date)
 * @returns True if the task can be edited
 */
export const canEditTask = (
  taskStatus: TaskStatusEntity | undefined,
  completionLog: CompletionLog | undefined,
  task: Task
): boolean => {
  // Calculate the task status user status
  const computedStatus = calculateTaskStatusUserStatus(taskStatus, completionLog, task);

  // Allow editing for upcoming, active, and recovered tasks
  return (
    computedStatus === 'upcoming' ||
    computedStatus === 'active' ||
    computedStatus === 'recovered'
  );
};
