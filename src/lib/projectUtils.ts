// ============================================================================
// Project Utilities - Centralized Project Logic
// ============================================================================
// 
// This file provides standardized utilities for project-related calculations
// and filtering that should be used consistently across all components.
// Supports both string and number IDs for compatibility.
// ============================================================================

import type { Project, Task, CompletionLog, User, ProjectRole } from '@/types';
import { PROJECT_ROLES } from '@/types';
import { normalizeId } from './idUtils';

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
  userId: string | number
): { progress: number; completedTasks: number; totalTasks: number } => {
  const projectId = normalizeId(project.id);
  const userIdNum = normalizeId(userId);
  
  const projectTasks = tasks.filter(t => {
    const tProjectId = normalizeId(t.projectId);
    return tProjectId === projectId;
  });
  const totalTasks = projectTasks.length;
  
  const completedTasks = projectTasks.filter(t => {
    const tId = normalizeId(t.id);
    return completionLogs.some(cl => {
      const clTaskId = normalizeId(cl.taskId);
      const clUserId = normalizeId(cl.userId);
      return clTaskId === tId && clUserId === userIdNum;
    });
  }).length;
  
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
  userId: string | number
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
export const getUserProjects = (projects: Project[], userId: string | number): Project[] => {
  const userIdNum = normalizeId(userId);
  
  return projects.filter(p => {
    const ownerId = normalizeId(p.ownerId);
    if (ownerId === userIdNum) return true;
    
    if (p.participants?.some(u => {
      const participantId = typeof u === 'object' && 'id' in u ? normalizeId(u.id) : normalizeId(u);
      return participantId === userIdNum;
    })) return true;
    
    if (p.participantRoles?.some(pr => {
      const prUserId = normalizeId(pr.userId);
      return prUserId === userIdNum && !pr.removedAt;
    })) return true;
    
    return false;
  });
};

/**
 * Filter public projects that user is not part of
 * 
 * @param projects - Array of projects
 * @param userId - The user ID to filter by
 * @returns Public projects where user is not a participant
 */
export const getPublicProjects = (projects: Project[], userId: string | number): Project[] => {
  const userIdNum = normalizeId(userId);
  
  return projects.filter(p => {
    if (!p.isPublic) return false;
    
    const ownerId = normalizeId(p.ownerId);
    if (ownerId === userIdNum) return false;
    
    if (p.participants?.some(u => {
      const participantId = typeof u === 'object' && 'id' in u ? normalizeId(u.id) : normalizeId(u);
      return participantId === userIdNum;
    })) return false;
    
    if (p.participantRoles?.some(pr => {
      const prUserId = normalizeId(pr.userId);
      return prUserId === userIdNum;
    })) return false;
    
    return true;
  });
};

/**
 * Get projects where user can create tasks (only owner/manager roles)
 * 
 * @param projects - Array of projects
 * @param userId - The user ID to filter by
 * @returns Projects where user has owner or manager role
 */
export const getProjectsWhereCanCreateTasks = (
  projects: Project[],
  userId: string | number
): Project[] => {
  const userIdNum = normalizeId(userId);
  
  return projects.filter(p => {
    const ownerId = normalizeId(p.ownerId);
    if (ownerId === userIdNum) return true;
    
    return p.participantRoles?.some(pr => {
      const prUserId = normalizeId(pr.userId);
      return prUserId === userIdNum && 
             (pr.role === 'owner' || pr.role === 'manager') && 
             !pr.removedAt;
    }) || false;
  });
};

/**
 * Get available roles that can be assigned to a participant
 * 
 * @param currentRole - The current role of the participant
 * @returns Array of available roles
 */
export const getAvailableRoles = (currentRole: ProjectRole): ProjectRole[] => {
  const allRoles: ProjectRole[] = ['owner', 'manager', 'participant'];
  
  // For now, allow any role change (you can add restrictions here)
  return allRoles.filter(role => role !== currentRole);
};
