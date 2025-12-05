// ============================================================================
// Task Recovery Utilities - Single Source of Truth for Task Recovery Logic
// ============================================================================
// 
// This file provides standardized utilities for recovering archived tasks
// that should be used consistently across all components.
// ============================================================================

import type { Task, TaskStatusEntity, TaskStatusUserStatus, TimingStatus, RingColor } from '@/types';
import { calculateTaskStatusUserStatus } from './taskUtils';

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

  // Find user's task status
  const userTaskStatus = taskStatuses.find(ts => ts.taskId === taskId && ts.userId === userId);

  const computedStatus = calculateTaskStatusUserStatus(userTaskStatus, undefined, task);

  // Check if task can be recovered (only archived tasks)
  const canRecover = computedStatus === 'Archived';

  if (!canRecover) {
    return null;
  }

  // Keep general task status (active/upcoming) but update timestamp
  const updatedTask: Task | null = {
    ...task,
    updatedAt: now
  };

  // Update user's task status
  let updatedTaskStatus: TaskStatusEntity | null = null;
  
  if (userTaskStatus) {
    // Update existing task status
    updatedTaskStatus = {
      ...userTaskStatus,
      status: 'Recovered' as TaskStatusUserStatus,
      recoveredAt: now, // Set recoveredAt to now (even if it was previously set)
      archivedAt: undefined, // Clear archivedAt
      ringColor: 'yellow' as RingColor, // Yellow ring for recovered tasks
      timingStatus: 'late' as TimingStatus,
      updatedAt: now
    };
  } else {
    // Edge case: user has no status yet, create recovered status entry
    updatedTaskStatus = {
      id: `ts-recover-${Date.now()}-${userId}`,
      taskId: taskId,
      userId: userId,
      status: 'Recovered' as TaskStatusUserStatus,
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

