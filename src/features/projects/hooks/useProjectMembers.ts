// ============================================================================
// useProjectMembers - Member Management for Project Detail
// ============================================================================

import { useState, useMemo, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { Project, ProjectParticipant, User, ProjectRole } from '@/types';
import { handleError } from '@/lib/errorUtils';
import { findUserByIdentifier, validateHandleFormat } from '@/lib/userUtils';
import { getDatabaseClient } from '@/db';
import { useQueryClient } from '@tanstack/react-query';
import type { ParticipantWithUser } from './types';

interface UseProjectMembersParams {
  projectId: string | undefined;
  currentProject: Project | undefined;
  projectFromDb: Project | null | undefined;
  projectParticipantsFromState: ProjectParticipant[] | undefined;
  user: User | null;
}

/**
 * Hook for managing project members (add, remove, update roles)
 */
export const useProjectMembers = ({
  projectId,
  currentProject,
  projectFromDb,
  projectParticipantsFromState,
  user,
}: UseProjectMembersParams) => {
  const queryClient = useQueryClient();
  
  // State
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [memberIdentifier, setMemberIdentifier] = useState('');
  const [projectParticipants, setProjectParticipants] = useState<ProjectParticipant[]>(
    projectParticipantsFromState || (currentProject?.participantRoles || [])
  );

  // Sync project participants with database data
  useEffect(() => {
    if (projectFromDb?.participantRoles) {
      setProjectParticipants(projectFromDb.participantRoles);
    } else if (projectParticipantsFromState && projectParticipants.length === 0) {
      setProjectParticipants(projectParticipantsFromState);
    }
  }, [projectFromDb?.participantRoles]);

  // Get project participants with user data
  const participants = useMemo((): ParticipantWithUser[] => {
    if (!currentProject?.participantRoles) return [];
    return projectParticipants
      .filter(pp => {
        const pProjectId = typeof currentProject.id === 'string' ? parseInt(currentProject.id) : currentProject.id;
        const ppProjectId = typeof pp.projectId === 'string' ? parseInt(pp.projectId) : pp.projectId;
        return ppProjectId === pProjectId && !pp.removedAt;
      })
      .map(pp => ({
        ...pp,
        user: pp.user || currentProject.participants?.find(u => {
          const uId = typeof u.id === 'string' ? parseInt(u.id) : u.id;
          const ppUserId = typeof pp.userId === 'string' ? parseInt(pp.userId) : pp.userId;
          return uId === ppUserId;
        })
      }));
  }, [projectParticipants, currentProject]);

  /**
   * Add a new member to the project
   */
  const handleAddMember = useCallback(async () => {
    if (!currentProject || !user) return;

    if (!memberIdentifier.trim()) {
      toast.error('Please enter a handle');
      return;
    }

    const handleValidation = validateHandleFormat(memberIdentifier);
    if (!handleValidation.isValid) {
      toast.error(handleValidation.error || 'Invalid handle format');
      return;
    }

    try {
      const userToAdd = await findUserByIdentifier(memberIdentifier);

      if (!userToAdd) {
        toast.error('User not found', {
          description: 'No user with this handle exists in the system'
        });
        return;
      }

      const userIdToAdd = typeof userToAdd.id === 'string' ? parseInt(userToAdd.id) : userToAdd.id;
      const pId = typeof currentProject.id === 'string' ? parseInt(currentProject.id) : currentProject.id;

      if (participants.some(p => {
        const pUserId = typeof p.userId === 'string' ? parseInt(p.userId) : p.userId;
        return pUserId === userIdToAdd;
      })) {
        toast.error('User already in project', {
          description: 'This user is already a member of this project'
        });
        return;
      }

      const now = new Date();
      const db = getDatabaseClient();

      await db.projects.addParticipant(pId, userIdToAdd, 'participant');

      const newParticipant: ProjectParticipant = {
        projectId: pId,
        userId: userIdToAdd,
        role: 'participant',
        addedAt: now,
        removedAt: undefined
      };

      setProjectParticipants(prev => [...prev, newParticipant]);
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });

      toast.success('Member added! 🎉', {
        description: `${userToAdd.name} (${userToAdd.handle}) has been added to the project`
      });

      setMemberIdentifier('');
      setShowAddMemberForm(false);
    } catch (error) {
      handleError(error, 'handleAddMember');
    }
  }, [currentProject, user, memberIdentifier, participants, projectId, queryClient]);

  /**
   * Remove a participant from the project
   */
  const handleRemoveParticipant = useCallback(async (userIdToRemove: number) => {
    if (!currentProject || !user) return;

    try {
      const db = getDatabaseClient();
      const pId = typeof currentProject.id === 'string' ? parseInt(currentProject.id) : currentProject.id;
      await db.projects.removeParticipant(pId, userIdToRemove);

      const now = new Date();
      setProjectParticipants(prev =>
        prev.map(pp => {
          const ppProjectId = typeof pp.projectId === 'string' ? parseInt(pp.projectId) : pp.projectId;
          const ppUserId = typeof pp.userId === 'string' ? parseInt(pp.userId) : pp.userId;
          if (ppProjectId === pId && ppUserId === userIdToRemove) {
            return { ...pp, removedAt: now };
          }
          return pp;
        })
      );

      queryClient.invalidateQueries({ queryKey: ['project', projectId] });

      toast.success('Participant removed', {
        description: 'The member has been removed from the project'
      });
    } catch (error) {
      handleError(error, 'handleRemoveParticipant');
    }
  }, [currentProject, user, projectId, queryClient]);

  /**
   * Update a participant's role
   */
  const handleUpdateRole = useCallback(async (userIdToUpdate: number, newRole: ProjectRole) => {
    if (!currentProject) return;

    try {
      const db = getDatabaseClient();
      const pId = typeof currentProject.id === 'string' ? parseInt(currentProject.id) : currentProject.id;
      await db.projects.updateParticipantRole(pId, userIdToUpdate, newRole);

      setProjectParticipants(prev =>
        prev.map(pp => {
          const ppProjectId = typeof pp.projectId === 'string' ? parseInt(pp.projectId) : pp.projectId;
          const ppUserId = typeof pp.userId === 'string' ? parseInt(pp.userId) : pp.userId;
          if (ppProjectId === pId && ppUserId === userIdToUpdate) {
            return { ...pp, role: newRole };
          }
          return pp;
        })
      );

      queryClient.invalidateQueries({ queryKey: ['project', projectId] });

      toast.success('Role updated', {
        description: `User role changed to ${newRole}`
      });
    } catch (error) {
      handleError(error, 'handleUpdateRole');
    }
  }, [currentProject, projectId, queryClient]);

  return {
    // State
    participants,
    projectParticipants,
    setProjectParticipants,
    showAddMemberForm,
    setShowAddMemberForm,
    showMembersDialog,
    setShowMembersDialog,
    memberIdentifier,
    setMemberIdentifier,
    
    // Handlers
    handleAddMember,
    handleRemoveParticipant,
    handleUpdateRole,
  };
};

