// ============================================================================
// Task Recovery Utilities - Single Source of Truth for Task Recovery Logic
// ============================================================================
// 
// This file provides standardized utilities for recovering archived tasks
// that should be used consistently across all components.
// ============================================================================

import type { Task, TaskStatusEntity, TaskStatus, RingColor } from '@/types';
import { calculateTaskStatusUserStatus } from './taskUtils';
import { normalizeId } from '../../lib/idUtils';

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
 * 
 * Recovered tasks should appear in Active section (NOT Needs Action).
 * 
 * @param taskId - The task ID to recover (string or number)
 * @param userId - The user ID recovering the task (string or number)
 * @param tasks - Array of all tasks
 * @param taskStatuses - Array of all task statuses
 * @returns Object with updated task and taskStatus, or null if recovery failed
 */
export const recoverTask = (
  taskId: string | number,
  userId: string | number,
  tasks: Task[],
  taskStatuses: TaskStatusEntity[]
): {
  updatedTask: Task | null;
  updatedTaskStatus: TaskStatusEntity | null;
  success: boolean;
} | null => {
  const now = new Date();
  const taskIdNum = normalizeId(taskId);
  const userIdNum = normalizeId(userId);
  
  const task = tasks.find(t => {
    const tId = normalizeId(t.id);
    return tId === taskIdNum;
  });
  
  if (!task) {
    return null;
  }

  // Find user's task status
  const userTaskStatus = taskStatuses.find(ts => {
    const tsTaskId = normalizeId(ts.taskId);
    const tsUserId = normalizeId(ts.userId);
    return tsTaskId === taskIdNum && tsUserId === userIdNum;
  });

  const computedStatus = calculateTaskStatusUserStatus(userTaskStatus, undefined, task);

  // Check if task can be recovered (only archived tasks)
  const canRecover = computedStatus === 'archived';

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
      status: 'recovered' as TaskStatus,
      recoveredAt: now, // Set recoveredAt to now (even if it was previously set)
      archivedAt: undefined, // Clear archivedAt
      ringColor: 'yellow' as RingColor // Yellow ring for recovered tasks
    };
  } else {
    // Edge case: user has no status yet, create recovered status entry
    updatedTaskStatus = {
      id: Date.now(),
      taskId: taskIdNum,
      userId: userIdNum,
      status: 'recovered' as TaskStatus,
      recoveredAt: now,
      archivedAt: undefined,
      ringColor: 'yellow' as RingColor
    };
  }

  return {
    updatedTask,
    updatedTaskStatus,
    success: true
  };
};
