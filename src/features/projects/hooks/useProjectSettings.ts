// ============================================================================
// useProjectSettings - Project Edit/Leave/Delete Operations
// ============================================================================

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';
import type { Project, User } from '@/types';
import { handleError } from '@/lib/errorUtils';
import { getDatabaseClient } from '@/db';
import { useQueryClient } from '@tanstack/react-query';
import type { ParticipantWithUser, ProjectPermissions } from './types';
import { useLeaveProject, useUpdateProject } from './useProjects';
import { notifyProjectUpdated, notifyProjectDeleted } from '@/lib/tasks/taskEmailNotifications';

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
      if (user) {
        notifyProjectUpdated(pId, typeof user.id === 'string' ? parseInt(user.id) : user.id).catch((err: any) => {
          console.error('Failed to send project update notification:', err);
        });
      }

      setShowEditProjectForm(false);
    } catch (error) {
      // Error handled by mutation
    }
  }, [currentProject, mutation, user]);

  /**
   * Leave the project
   */
  const handleLeaveProject = useCallback(async () => {
    if (!currentProject || !user) return;

    const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    const pId = typeof currentProject.id === 'string' ? parseInt(currentProject.id) : currentProject.id;
    const ownerId = typeof currentProject.ownerId === 'string' ? parseInt(currentProject.ownerId) : currentProject.ownerId;

    if (ownerId === userId) {
      toast.error("You can't leave this project yet.", {
        description: 'As the owner, you must transfer ownership first.'
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

      // Notify participants about project deletion
      if (user && participants.length > 0) {
        const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
        const participantIds = participants.map(p => typeof p.userId === 'string' ? parseInt(p.userId) : p.userId);

        // Include owner in notification list if they are not the one deleting (though owner usually deletes)
        // Ensure unique IDs
        const uniqueIds = Array.from(new Set(participantIds));

        notifyProjectDeleted(userId, currentProject.name, uniqueIds).catch((err: any) => {
          console.error('Failed to send project deletion emails:', err);
        });
      }

      await db.projects.delete(pId);

      queryClient.invalidateQueries({ queryKey: ['projects'] });

      toast.success('Project removed.', {
        description: 'The project and all associated tasks are gone.'
      });

      setShowDeleteProjectDialog(false);
      setShowEditProjectForm(false);
      navigate('/projects');
    } catch (error) {
      handleError(error, 'handleDeleteProject');
    }
  }, [currentProject, queryClient, navigate, user, participants]);

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
