// ============================================================================
// Project Utilities - Centralized Project Logic
// ============================================================================
// 
// This file provides standardized utilities for project-related calculations
// and filtering that should be used consistently across all components.
// ============================================================================

import type { Project, Task, CompletionLog, User, ProjectParticipant } from '@/types';

/**
 * Calculate project progress for a specific user
 * 
 * @param project - The project to calculate progress for
 * @param tasks - All tasks in the project
 * @param completionLogs - All completion logs
 * @param userId - The user ID to calculate progress for
 * @returns Progress percentage (0-100) and completed task count
 */
export const calculateProjectProgress = (
  project: Project,
  tasks: Task[],
  completionLogs: CompletionLog[],
  userId: string
): { progress: number; completedTasks: number; totalTasks: number } => {
  const projectTasks = tasks.filter(t => t.projectId === project.id);
  const totalTasks = projectTasks.length;
  
  const completedTasks = projectTasks.filter(t => 
    completionLogs.some(cl => cl.taskId === t.id && cl.userId === userId)
  ).length;
  
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  
  return { progress, completedTasks, totalTasks };
};

/**
 * Calculate project progress for multiple projects
 * 
 * @param projects - Array of projects
 * @param tasks - All tasks
 * @param completionLogs - All completion logs
 * @param userId - The user ID to calculate progress for
 * @returns Projects with calculated progress
 */
export const calculateProjectsProgress = (
  projects: Project[],
  tasks: Task[],
  completionLogs: CompletionLog[],
  userId: string
): Project[] => {
  return projects.map(project => {
    const { progress, completedTasks, totalTasks } = calculateProjectProgress(
      project,
      tasks,
      completionLogs,
      userId
    );
    
    return {
      ...project,
      progress,
      completedTasks,
      totalTasks
    };
  });
};

/**
 * Filter projects by user participation
 * 
 * @param projects - Array of projects
 * @param userId - The user ID to filter by
 * @returns Projects where user is owner or participant
 */
export const getUserProjects = (projects: Project[], userId: string): Project[] => {
  return projects.filter(p =>
    p.participants?.some(u => u.id === userId) ||
    p.participantRoles?.some(pr => pr.userId === userId) ||
    p.ownerId === userId
  );
};

/**
 * Filter public projects that user is not part of
 * 
 * @param projects - Array of projects
 * @param userId - The user ID to filter by
 * @returns Public projects where user is not a participant
 */
export const getPublicProjects = (projects: Project[], userId: string): Project[] => {
  return projects.filter(p => 
    p.isPublic && 
    !p.participants?.some(u => u.id === userId) &&
    !p.participantRoles?.some(pr => pr.userId === userId) &&
    p.ownerId !== userId
  );
};

/**
 * Check if a user can create tasks in a project
 * Only owners and managers can create tasks
 * 
 * @param project - The project to check
 * @param userId - The user ID to check
 * @returns True if user is owner or manager, false otherwise
 */
export const canCreateTasks = (project: Project, userId: string): boolean => {
  // Owner can always create tasks
  if (project.ownerId === userId) {
    return true;
  }

  // Check if user is a manager
  const userParticipant = project.participantRoles?.find(
    pr => pr.userId === userId && !pr.removedAt
  );

  if (userParticipant && (userParticipant.role === 'owner' || userParticipant.role === 'manager')) {
    return true;
  }

  return false;
};

/**
 * Get projects where user can create tasks (owner or manager role)
 * Filters "My Projects" to only include projects where user has task creation permissions
 * 
 * @param projects - Array of projects
 * @param userId - The user ID to filter by
 * @returns Projects where user is owner or manager (can create tasks)
 */
export const getProjectsWhereCanCreateTasks = (projects: Project[], userId: string): Project[] => {
  // First get user's projects
  const userProjects = getUserProjects(projects, userId);
  
  // Then filter to only those where user can create tasks
  return userProjects.filter(project => canCreateTasks(project, userId));
};

/**
 * Leave Project - Modular utility for removing a user from a project
 * 
 * This function handles:
 * - Removing user from project participants
 * - Updating project participant roles
 * - Preventing owner from leaving (must transfer ownership first)
 * - Returning updated data structures for database operations
 * 
 * @param projectId - The project ID to leave
 * @param userId - The user ID leaving the project
 * @param currentParticipants - Current project participants array
 * @param currentOwnerId - Current project owner ID
 * @returns Object with updated participants and success/error information
 */
export const leaveProject = (
  projectId: string,
  userId: string,
  currentParticipants: ProjectParticipant[],
  currentOwnerId: string
): {
  success: boolean;
  error?: string;
  updatedParticipants: ProjectParticipant[];
  shouldTransferOwnership?: boolean;
} => {
  // Check if user is the owner
  if (currentOwnerId === userId) {
    return {
      success: false,
      error: 'Project owner cannot leave the project. Please transfer ownership first or delete the project.',
      updatedParticipants: currentParticipants,
      shouldTransferOwnership: true
    };
  }

  // Check if user is a participant
  const userParticipant = currentParticipants.find(
    p => p.projectId === projectId && p.userId === userId && !p.removedAt
  );

  if (!userParticipant) {
    return {
      success: false,
      error: 'User is not a participant in this project',
      updatedParticipants: currentParticipants
    };
  }

  // Mark participant as removed
  const now = new Date();
  const updatedParticipants = currentParticipants.map(p => {
    if (p.projectId === projectId && p.userId === userId) {
      return {
        ...p,
        removedAt: now
      };
    }
    return p;
  });

  return {
    success: true,
    updatedParticipants
  };
};

/**
 * Check if a user can leave a project
 * 
 * @param userId - The user ID to check
 * @param ownerId - The project owner ID
 * @param participants - Project participants array
 * @param projectId - The project ID
 * @returns True if user can leave, false otherwise
 */
export const canLeaveProject = (
  userId: string,
  ownerId: string,
  participants: ProjectParticipant[],
  projectId: string
): boolean => {
  // Owner cannot leave
  if (ownerId === userId) {
    return false;
  }

  // Check if user is an active participant
  const userParticipant = participants.find(
    p => p.projectId === projectId && p.userId === userId && !p.removedAt
  );

  return !!userParticipant;
};

