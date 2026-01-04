// ============================================================================
// useProjectSettings - Project Edit/Leave/Delete Operations
// ============================================================================

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { Project, User } from '@/types';
import { handleError } from '@/lib/errorUtils';
import { getDatabaseClient } from '@/db';
import { useQueryClient } from '@tanstack/react-query';
import type { ParticipantWithUser, ProjectPermissions } from './types';
import { useLeaveProject, useUpdateProject } from './useProjects';

interface UseProjectSettingsParams {
  projectId: string | undefined;
  currentProject: Project | undefined;
  user: User | null;
  participants: ParticipantWithUser[];
}

/**
 * Hook for project settings operations (edit, leave, delete)
 */
export const useProjectSettings = ({
  projectId,
  currentProject,
  user,
  participants,
}: UseProjectSettingsParams) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const leaveProjectMutation = useLeaveProject();

  // Dialog states
  const [showEditProjectForm, setShowEditProjectForm] = useState(false);
  const [showLeaveProjectDialog, setShowLeaveProjectDialog] = useState(false);
  const [showDeleteProjectDialog, setShowDeleteProjectDialog] = useState(false);

  // Permissions
  const permissions: ProjectPermissions = useMemo(() => {
    if (!currentProject || !user) {
      return { isOwner: false, isManager: false, canManage: false, canLeave: false, isParticipant: false };
    }

    const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    const ownerId = typeof currentProject.ownerId === 'string' ? parseInt(currentProject.ownerId) : currentProject.ownerId;

    const isOwner = ownerId === userId;
    const isParticipant = participants.some(p => {
      const pUserId = typeof p.userId === 'string' ? parseInt(p.userId) : p.userId;
      return pUserId === userId;
    }) || isOwner;

    const isManager = participants.some(p => {
      const pUserId = typeof p.userId === 'string' ? parseInt(p.userId) : p.userId;
      return pUserId === userId && p.role === 'manager';
    });

    return {
      isOwner,
      isManager,
      canManage: isOwner || isManager,
      canLeave: isParticipant && !isOwner,
      isParticipant,
    };
  }, [currentProject, user, participants]);

  /**
   * Edit project details
   */

  const mutation = useUpdateProject();
  const handleEditProject = useCallback(async (projectData: { name: string; description: string; icon?: string }) => {
    if (!currentProject) return;

    try {
      const pId = typeof currentProject.id === 'string' ? parseInt(currentProject.id) : currentProject.id;
      await mutation.mutateAsync({
        id: pId,
        data: {
          name: projectData.name,
          description: projectData.description,
          icon: projectData.icon
        }
      });

      // Invalidation is handled by the mutation

      setShowEditProjectForm(false);
    } catch (error) {
      // Error handled by mutation
    }
  }, [currentProject, mutation]);

  /**
   * Leave the project
   */
  const handleLeaveProject = useCallback(async () => {
    if (!currentProject || !user) return;

    const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    const pId = typeof currentProject.id === 'string' ? parseInt(currentProject.id) : currentProject.id;
    const ownerId = typeof currentProject.ownerId === 'string' ? parseInt(currentProject.ownerId) : currentProject.ownerId;

    if (ownerId === userId) {
      toast.error('Cannot leave project', {
        description: 'Project owner cannot leave the project'
      });
      setShowLeaveProjectDialog(false);
      return;
    }

    try {
      // Use the mutation for leaving (handles invalidation appropriately)
      await leaveProjectMutation.mutateAsync(pId);

      setShowLeaveProjectDialog(false);
      navigate('/projects');
    } catch (error) {
      // Error handled by mutation
    }
  }, [currentProject, user, leaveProjectMutation, navigate]);

  /**
   * Delete the project
   */
  const handleDeleteProject = useCallback(async () => {
    if (!currentProject) return;

    try {
      const db = getDatabaseClient();
      const pId = typeof currentProject.id === 'string' ? parseInt(currentProject.id) : currentProject.id;
      await db.projects.delete(pId);

      queryClient.invalidateQueries({ queryKey: ['projects'] });

      toast.success('Project deleted', {
        description: 'The project and all its data have been permanently removed'
      });

      setShowDeleteProjectDialog(false);
      setShowEditProjectForm(false);
      navigate('/projects');
    } catch (error) {
      handleError(error, 'handleDeleteProject');
    }
  }, [currentProject, queryClient, navigate]);

  return {
    // Permissions
    ...permissions,

    // Dialog states
    showEditProjectForm,
    setShowEditProjectForm,
    showLeaveProjectDialog,
    setShowLeaveProjectDialog,
    showDeleteProjectDialog,
    setShowDeleteProjectDialog,

    // Handlers
    handleEditProject,
    handleLeaveProject,
    handleDeleteProject,

    // Navigation
    navigate,
  };
};
