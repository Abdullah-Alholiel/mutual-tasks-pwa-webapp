// ============================================================================
// Project Utilities - Centralized Project Logic
// ============================================================================
// 
// This file provides standardized utilities for project-related calculations
// and filtering that should be used consistently across all components.
// ============================================================================

import type { Project, Task, CompletionLog, User } from '@/types';

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

