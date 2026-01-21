import type { Project, User, ProjectRole } from '@/types';
import { normalizeId, compareIds } from '@/lib/idUtils';

/**
 * ============================================================================
 * Project Permissions - Centralized Permission Checking Functions
 * ============================================================================
 *
 * Purpose:
 * - Single source of truth for project permission checks
 * - Consistent permission logic across all components
 * - Prevents permission inconsistencies and bugs
 *
 * Usage Pattern:
 * 1. Import: import { isUserOwner, isUserManager } from '@/lib/projects/projectPermissions';
 * 2. Use: if (isUserOwner(project, userId)) { ... }
 *
 * Critical: Always use these functions instead of inline permission checks
 * This prevents bugs from inconsistent permission logic
 * ============================================================================
 */

/**
 * Result type for project permission checks
 * Contains all relevant permission flags for a user in a project
 */
export interface ProjectPermissions {
  isOwner: boolean;
  isManager: boolean;
  isParticipant: boolean;
  canManage: boolean;
  canView: boolean;
}

/**
 * Get all permissions for a user in a project
 * Centralizes permission checking into a single, type-safe function
 *
 * @param project - The project to check permissions for
 * @param userId - The user ID to check
 * @param participants - Array of project participants (with roles)
 * @returns Object containing all permission flags
 *
 * Example:
 * const permissions = getProjectPermissions(project, userId, participants);
 * if (permissions.canManage) { / * allow user to manage project * / }
 */
export function getProjectPermissions(
  project: Project | undefined,
  userId: number | string,
  participants: Array<{ userId: User['id']; role?: ProjectRole }> | undefined
): ProjectPermissions {
  if (!project || !participants) {
    return {
      isOwner: false,
      isManager: false,
      isParticipant: false,
      canManage: false,
      canView: false,
    };
  }

  const normalizedUserId = typeof userId === 'string' ? parseInt(userId) : userId;
  const normalizedOwnerId = typeof project.ownerId === 'string' ? parseInt(project.ownerId) : project.ownerId;

  const isOwner = compareIds(project.ownerId, userId);
  const participant = participants.find(p => compareIds(p.userId, userId));
  const role = participant?.role;

  return {
    isOwner,
    isManager: role === 'owner' || role === 'manager',
    isParticipant: participant !== undefined || isOwner,
    canManage: isOwner || role === 'owner' || role === 'manager',
    canView: participant !== undefined || isOwner || project.isPublic || role === 'owner' || role === 'manager',
  };
}

/**
 * Check if a user is the owner of a project
 *
 * @param project - The project to check
 * @param userId - The user ID to check
 * @returns True if user is owner, false otherwise
 *
 * Example:
 * isUserOwner(project, userId) // true if owner
 */
export function isUserOwner(project: Project, userId: number | string): boolean {
  if (!project) return false;
  return compareIds(project.ownerId, userId);
}

/**
 * Check if a user is a manager (or owner) of a project
 *
 * @param project - The project to check
 * @param userId - The user ID to check
 * @param participants - Array of project participants (with roles)
 * @returns True if user is owner or manager, false otherwise
 *
 * Example:
 * isUserManager(project, userId, participants) // true if manager or owner
 */
export function isUserManager(
  project: Project | undefined,
  userId: number | string,
  participants: Array<{ userId: User['id']; role?: ProjectRole }> | undefined
): boolean {
  const permissions = getProjectPermissions(project, userId, participants);
  return permissions.canManage;
}

/**
 * Check if a user is a participant in a project
 *
 * @param project - The project to check
 * @param userId - The user ID to check
 * @param participants - Array of project participants
 * @returns True if user is in participants list, false otherwise
 *
 * Example:
 * isUserParticipant(project, userId, participants) // true if participant
 */
export function isUserParticipant(
  project: Project | undefined,
  userId: number | string,
  participants: Array<{ userId: User['id']; role?: ProjectRole }> | undefined
): boolean {
  const permissions = getProjectPermissions(project, userId, participants);
  return permissions.isParticipant;
}

/**
 * Get user's role in a project
 *
 * @param project - The project to check
 * @param userId - The user ID to check
 * @param participants - Array of project participants (with roles)
 * @returns The user's role (or null if not participant)
 *
 * Example:
 * getUserRoleInProject(project, userId, participants) // 'manager'
 */
export function getUserRoleInProject(
  project: Project | undefined,
  userId: number | string,
  participants: Array<{ userId: User['id']; role?: ProjectRole }> | undefined
): ProjectRole | null {
  const normalizedUserId = typeof userId === 'string' ? parseInt(userId) : userId;
  const participant = participants?.find(p => {
    const participantUserId = typeof p.userId === 'string' ? parseInt(p.userId) : p.userId;
    return participantUserId === normalizedUserId;
  });
  return participant?.role || null;
}

/**
 * Check if a user can create tasks in a project
 * Only owners and managers can create tasks
 *
 * @param project - The project to check
 * @param userId - The user ID to check
 * @param participants - Array of project participants (with roles)
 * @returns True if user can create tasks, false otherwise
 *
 * Example:
 * canUserCreateTasks(project, userId, participants) // true for owner/manager
 */
export function canUserCreateTasks(
  project: Project | undefined,
  userId: number | string,
  participants: Array<{ userId: User['id']; role?: ProjectRole }> | undefined
): boolean {
  const permissions = getProjectPermissions(project, userId, participants);
  return permissions.canManage;
}

/**
 * Check if a user can delete a project
 * Only owners can delete projects
 *
 * @param project - The project to check
 * @param userId - The user ID to check
 * @returns True if user is owner, false otherwise
 *
 * Example:
 * canUserDeleteProject(project, userId) // true for owner
 */
export function canUserDeleteProject(project: Project, userId: number | string): boolean {
  return isUserOwner(project, userId);
}

/**
 * Check if a user can edit project settings
 * Only owners and managers can edit settings
 *
 * @param project - The project to check
 * @param userId - The user ID to check
 * @param participants - Array of project participants (with roles)
 * @returns True if user can edit settings, false otherwise
 *
 * Example:
 * canUserEditProjectSettings(project, userId, participants) // true for owner/manager
 */
export function canUserEditProjectSettings(
  project: Project | undefined,
  userId: number | string,
  participants: Array<{ userId: User['id']; role?: ProjectRole }> | undefined
): boolean {
  const permissions = getProjectPermissions(project, userId, participants);
  return permissions.canManage;
}

/**
 * Check if a user can manage project members
 * Only owners and managers can manage members
 *
 * @param project - The project to check
 * @param userId - The user ID to check
 * @param participants - Array of project participants (with roles)
 * @returns True if user can manage members, false otherwise
 *
 * Example:
 * canUserManageMembers(project, userId, participants) // true for owner/manager
 */
export function canUserManageMembers(
  project: Project | undefined,
  userId: number | string,
  participants: Array<{ userId: User['id']; role?: ProjectRole }> | undefined
): boolean {
  const permissions = getProjectPermissions(project, userId, participants);
  return permissions.canManage;
}
