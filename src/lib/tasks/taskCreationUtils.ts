// ============================================================================
// Task Creation Utilities - Standardized Task Creation Logic
// ============================================================================
// 
// This file provides standardized utilities for task creation
// that should be used consistently across all components.
// ============================================================================

import type { Task, TaskStatusEntity, Project, User, TaskStatus } from '@/types';
import { compareIds } from '../idUtils';

/**
 * Get all project participant IDs (including owner/creator)
 * 
 * @param project - The project
 * @param allUsers - Array of all users
 * @returns Array of user IDs that are participants in the project
 */
export const getProjectParticipantIds = (
  project: Project,
  allUsers: User[]
): number[] => {
  const participantIds = new Set<number>();

  // Always include the owner
  if (project.ownerId) {
    participantIds.add(project.ownerId);
  }

  // Add participants from participants array
  if (project.participants) {
    project.participants.forEach(p => {
      const userId = typeof p === 'object' && 'id' in p ? p.id : p;
      if (userId) {
        participantIds.add(userId);
      }
    });
  }

  // Add participants from participantRoles
  if (project.participantRoles) {
    project.participantRoles.forEach(pr => {
      if (pr.userId && !pr.removedAt) {
        participantIds.add(pr.userId);
      }
    });
  }

  return Array.from(participantIds);
};

/**
 * Get IDs of users who should be assigned to a new task
 * Includes the creator and all active project participants
 */
export const getParticipatingUserIds = (
  project: Project,
  creatorId: number | string
): number[] => {
  const ids = new Set<number>();
  ids.add(Number(creatorId));

  if (project.participantRoles) {
    project.participantRoles.forEach(pr => {
      if (pr.userId && !pr.removedAt) {
        ids.add(Number(pr.userId));
      }
    });
  }

  // Also check project.ownerId if it's not the creator
  if (project.ownerId) {
    ids.add(Number(project.ownerId));
  }

  return Array.from(ids);
};

/**
 * Build task status entity for a user
 * 
 * @param taskId - Task ID
 * @param userId - User ID
 * @param status - Task status
 * @param dueDate - Due date
 * @param timestamp - Timestamp for creation/update
 * @returns Task status entity
 */
export const buildTaskStatus = (
  taskId: string,
  userId: number,
  status: TaskStatus,
  dueDate: Date,
  timestamp: Date
): TaskStatusEntity => ({
  id: Date.now(),
  taskId: Number(taskId),
  userId,
  status
});

/**
 * Create task statuses for all project participants
 * 
 * @param taskId - Task ID
 * @param project - Project
 * @param allUsers - Array of all users
 * @param dueDate - Due date for the task
 * @param timestamp - Timestamp for creation
 * @returns Array of task status entities
 */
export const createTaskStatusesForAllParticipants = (
  taskId: string,
  project: Project,
  allUsers: User[],
  dueDate: Date,
  timestamp: Date
): TaskStatusEntity[] => {
  const participantIds = getProjectParticipantIds(project, allUsers);

  return participantIds.map(userId =>
    buildTaskStatus(taskId, userId, 'active', dueDate, timestamp)
  );
};

/**
 * Validate that a project has enough participants for task creation
 * 
 * @param project - Project to validate
 * @param allUsers - Array of all users
 * @param minParticipants - Minimum number of participants required (default: 2)
 * @returns Object with isValid flag and error message if invalid
 */
export const validateProjectForTaskCreation = (
  project: Project,
  allUsers: User[],
  minParticipants: number = 1
): { isValid: boolean; error?: string } => {
  // For public projects, skip participant validation
  // Tasks in public projects are automatically assigned to all members
  // Only owners and managers can create tasks in public projects
  if (project.isPublic) {
    return { isValid: true };
  }

  // For private projects, validate minimum participants
  const participantIds = getProjectParticipantIds(project, allUsers);

  if (participantIds.length < minParticipants) {
    return {
      isValid: false,
      error: `Task requires at least ${minParticipants} participants. Add more members to the project first.`
    };
  }

  return { isValid: true };
};


