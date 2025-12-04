// ============================================================================
// Task Recovery Utilities - Single Source of Truth for Task Recovery Logic
// ============================================================================
// 
// This file provides standardized utilities for recovering archived tasks
// that should be used consistently across all components.
// ============================================================================

import type { Task, TaskStatusEntity, TaskStatusUserStatus, TimingStatus, RingColor } from '@/types';

/**
 * Recover a task - Single Source of Truth for Task Recovery Logic
 * 
 * This function handles recovering archived tasks (both task-level and user-level archived).
 * When a task is recovered:
 * - Task status changes from 'archived' to 'active' (if archived at task level)
 * - User's taskStatus changes from 'archived' to 'active'
 * - recoveredAt is set to current time
 * - archivedAt is cleared
 * - ringColor is set to 'yellow' (indicates recovered task)
 * - timingStatus is set to 'late'
 * 
 * Recovered tasks should appear in Active section (NOT Needs Action).
 * 
 * @param taskId - The task ID to recover
 * @param userId - The user ID recovering the task
 * @param tasks - Array of all tasks
 * @param taskStatuses - Array of all task statuses
 * @returns Object with updated task and taskStatus, or null if recovery failed
 */
export const recoverTask = (
  taskId: string,
  userId: string,
  tasks: Task[],
  taskStatuses: TaskStatusEntity[]
): {
  updatedTask: Task | null;
  updatedTaskStatus: TaskStatusEntity | null;
  success: boolean;
} | null => {
  const now = new Date();
  const task = tasks.find(t => t.id === taskId);
  
  if (!task) {
    return null;
  }

  // Check if task is archived at task level
  const isTaskArchived = task.status === 'archived';

  // Find user's task status
  const userTaskStatus = taskStatuses.find(ts => ts.taskId === taskId && ts.userId === userId);

  // Check if task can be recovered
  // Task can be recovered if:
  // 1. Task is archived at task level, OR
  // 2. User's taskStatus is archived
  const canRecover = isTaskArchived || 
                    (userTaskStatus && (
                      userTaskStatus.status === 'archived' || 
                      (userTaskStatus.archivedAt !== undefined && userTaskStatus.archivedAt !== null)
                    ));

  if (!canRecover) {
    return null;
  }

  // Update task status if archived at task level
  const updatedTask: Task | null = isTaskArchived
    ? {
        ...task,
        status: 'active' as Task['status'],
        updatedAt: now
      }
    : null;

  // Update user's task status
  let updatedTaskStatus: TaskStatusEntity | null = null;
  
  if (userTaskStatus) {
    // Update existing task status
    updatedTaskStatus = {
      ...userTaskStatus,
      status: 'active' as TaskStatusUserStatus,
      recoveredAt: now, // Set recoveredAt to now (even if it was previously set)
      archivedAt: undefined, // Clear archivedAt
      ringColor: 'yellow' as RingColor, // Yellow ring for recovered tasks
      timingStatus: 'late' as TimingStatus,
      updatedAt: now
    };
  } else if (isTaskArchived) {
    // If task is archived at task level but user has no taskStatus,
    // create a new taskStatus for recovery
    // Note: This is an edge case - normally all participants should have taskStatuses
    updatedTaskStatus = {
      id: `ts-recover-${Date.now()}-${userId}`,
      taskId: taskId,
      userId: userId,
      status: 'active' as TaskStatusUserStatus,
      effectiveDueDate: task.dueDate,
      recoveredAt: now,
      archivedAt: undefined,
      ringColor: 'yellow' as RingColor,
      timingStatus: 'late' as TimingStatus,
      createdAt: now,
      updatedAt: now
    };
  }

  return {
    updatedTask,
    updatedTaskStatus,
    success: true
  };
};

