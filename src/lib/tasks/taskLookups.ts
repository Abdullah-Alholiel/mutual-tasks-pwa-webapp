import type { Task, TaskStatusEntity, CompletionLog } from '@/types';
import { normalizeId } from '@/lib/idUtils';

/**
 * ============================================================================
 * Task Lookups - Centralized Task Data Lookup Functions
 * ============================================================================
 *
 * Purpose:
 * - Single source of truth for finding task-related data
 * - Consistent lookup patterns across all components
 * - Eliminates duplicated find() logic throughout codebase
 *
 * Usage Pattern:
 * 1. Import: import { findTaskStatus, findCompletionLog } from '@/lib/tasks/taskLookups';
 * 2. Use: const ts = findTaskStatus(taskStatuses, taskId, userId);
 *
 * Critical: Always use these functions instead of inline find() calls
 * This ensures consistent ID handling and reduces bug surface
 * ============================================================================
 */

/**
 * Find a specific task status by task ID and user ID
 * Centralizes the common pattern of finding a user's status for a specific task
 *
 * @param taskStatuses - Array of task statuses to search
 * @param taskId - The task ID to find
 * @param userId - The user ID to find
 * @returns The task status entity or undefined if not found
 *
 * Example:
 * const ts = findTaskStatus(task.taskStatus, task.id, user.id);
 * if (ts) { console.log('Found task status:', ts); }
 */
export function findTaskStatus(
  taskStatuses: TaskStatusEntity[] | undefined,
  taskId: number | string,
  userId: number | string
): TaskStatusEntity | undefined {
  if (!taskStatuses || taskStatuses.length === 0) return undefined;

  const normalizedTaskId = normalizeId(taskId);
  const normalizedUserId = normalizeId(userId);

  return taskStatuses.find(ts => {
    const tsTaskId = normalizeId(ts.taskId);
    const tsUserId = normalizeId(ts.userId);
    return tsTaskId === normalizedTaskId && tsUserId === normalizedUserId;
  });
}

/**
 * Find a specific completion log by task ID and user ID
 * Centralizes the common pattern of finding a user's completion log for a specific task
 *
 * @param completionLogs - Array of completion logs to search
 * @param taskId - The task ID to find
 * @param userId - The user ID to find
 * @returns The completion log or undefined if not found
 *
 * Example:
 * const log = findCompletionLog(completionLogs, task.id, user.id);
 * if (log) { console.log('Found completion log:', log); }
 */
export function findCompletionLog(
  completionLogs: CompletionLog[] | undefined,
  taskId: number | string,
  userId: number | string
): CompletionLog | undefined {
  if (!completionLogs || completionLogs.length === 0) return undefined;

  const normalizedTaskId = normalizeId(taskId);
  const normalizedUserId = normalizeId(userId);

  return completionLogs.find(log => {
    const logTaskId = normalizeId(log.taskId);
    const logUserId = normalizeId(log.userId);
    return logTaskId === normalizedTaskId && logUserId === normalizedUserId;
  });
}

/**
 * Get all task statuses for a specific task across all users
 * Useful when you need to see all participants' statuses for a task
 *
 * @param taskStatuses - Array of task statuses to search
 * @param taskId - The task ID to filter by
 * @returns Array of task statuses for the specified task
 *
 * Example:
 * const allStatuses = getTaskStatusesForTask(task.taskStatus, task.id);
 * console.log('All participants:', allStatuses.length);
 */
export function getTaskStatusesForTask(
  taskStatuses: TaskStatusEntity[] | undefined,
  taskId: number | string
): TaskStatusEntity[] {
  if (!taskStatuses || taskStatuses.length === 0) return [];

  const normalizedTaskId = normalizeId(taskId);
  return taskStatuses.filter(ts => {
    const tsTaskId = normalizeId(ts.taskId);
    return tsTaskId === normalizedTaskId;
  });
}

/**
 * Get all completion logs for a specific task across all users
 * Useful when you need to see all participants' completion logs for a task
 *
 * @param completionLogs - Array of completion logs to search
 * @param taskId - The task ID to filter by
 * @returns Array of completion logs for the specified task
 *
 * Example:
 * const allLogs = getCompletionLogsForTask(completionLogs, task.id);
 * console.log('All completions:', allLogs.length);
 */
export function getCompletionLogsForTask(
  completionLogs: CompletionLog[] | undefined,
  taskId: number | string
): CompletionLog[] {
  if (!completionLogs || completionLogs.length === 0) return [];

  const normalizedTaskId = normalizeId(taskId);
  return completionLogs.filter(log => {
    const logTaskId = normalizeId(log.taskId);
    return logTaskId === normalizedTaskId;
  });
}

/**
 * Get all task statuses for a specific user across all tasks
 * Useful when you need to see a user's statuses for all tasks
 *
 * @param taskStatuses - Array of task statuses to search
 * @param userId - The user ID to filter by
 * @returns Array of task statuses for the specified user
 *
 * Example:
 * const myStatuses = getUserTaskStatuses(taskStatuses, user.id);
 * console.log('My statuses:', myStatuses.length);
 */
export function getUserTaskStatuses(
  taskStatuses: TaskStatusEntity[] | undefined,
  userId: number | string
): TaskStatusEntity[] {
  if (!taskStatuses || taskStatuses.length === 0) return [];

  const normalizedUserId = normalizeId(userId);
  return taskStatuses.filter(ts => {
    const tsUserId = normalizeId(ts.userId);
    return tsUserId === normalizedUserId;
  });
}

/**
 * Get all completion logs for a specific user across all tasks
 * Useful when you need to see a user's completion logs for all tasks
 *
 * @param completionLogs - Array of completion logs to search
 * @param userId - The user ID to filter by
 * @returns Array of completion logs for the specified user
 *
 * Example:
 * const myLogs = getUserCompletionLogs(completionLogs, user.id);
 * console.log('My completions:', myLogs.length);
 */
export function getUserCompletionLogs(
  completionLogs: CompletionLog[] | undefined,
  userId: number | string
): CompletionLog[] {
  if (!completionLogs || completionLogs.length === 0) return [];

  const normalizedUserId = normalizeId(userId);
  return completionLogs.filter(log => {
    const logUserId = normalizeId(log.userId);
    return logUserId === normalizedUserId;
  });
}

/**
 * Get complete task data for a specific user
 * Returns both task status and completion log (if exists) for a user in a task
 *
 * @param task - The task entity
 * @param taskStatuses - Array of all task statuses
 * @param completionLogs - Array of all completion logs
 * @param userId - The user ID to get data for
 * @returns Object containing task status and completion log
 *
 * Example:
 * const userData = getUserTaskData(task, taskStatuses, completionLogs, user.id);
 * if (userData.completionLog) { console.log('User completed this task'); }
 */
export function getUserTaskData(
  task: Task,
  taskStatuses: TaskStatusEntity[] | undefined,
  completionLogs: CompletionLog[] | undefined,
  userId: number | string
): { taskStatus: TaskStatusEntity | undefined; completionLog: CompletionLog | undefined } {
  const taskStatus = findTaskStatus(taskStatuses, task.id, userId);
  const completionLog = findCompletionLog(completionLogs, task.id, userId);

  return { taskStatus, completionLog };
}
