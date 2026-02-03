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
import { notificationService } from '@/lib/notifications/notificationService';

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
  const [isAddingMember, setIsAddingMember] = useState(false);

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

    // Prevent rapid double-clicks
    if (isAddingMember) {
      console.log('[useProjectMembers] Add member already in progress, skipping duplicate call.');
      return;
    }
    setIsAddingMember(true);

    // Check if the current user has permission to add members (owner or manager)
    const currentUserId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    const isOwner = (typeof currentProject.ownerId === 'string' ? parseInt(currentProject.ownerId) : currentProject.ownerId) === currentUserId;
    const isManager = participants.some(p => {
      const pUserId = typeof p.userId === 'string' ? parseInt(p.userId) : p.userId;
      return pUserId === currentUserId && p.role === 'manager';
    });

    if (!isOwner && !isManager) {
      toast.error('Permission denied', {
        description: 'Only project owners and managers can add members'
      });
      return;
    }

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

      // Create task statuses for all existing tasks in the project
      const projectTasks = await db.tasks.getAll({ projectId: pId });
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create task statuses for all tasks
      const taskStatusesToCreate = projectTasks
        .filter(task => {
          // Check if status already exists (safety check)
          // We'll check this in the loop below to avoid unnecessary creates
          return true;
        })
        .map(task => {
          const dueDate = new Date(task.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          const isPastDue = dueDate.getTime() < today.getTime();

          return {
            taskId: typeof task.id === 'string' ? parseInt(task.id) : task.id,
            userId: userIdToAdd,
            status: isPastDue ? ('archived' as const) : ('active' as const),
            archivedAt: isPastDue ? now : undefined,
            ringColor: undefined,
          };
        });

      // Create task statuses (checking for existence first to avoid duplicates)
      if (taskStatusesToCreate.length > 0) {
        await Promise.all(
          taskStatusesToCreate.map(async (statusData) => {
            const existingStatus = await db.taskStatus.getByTaskAndUser(statusData.taskId, statusData.userId);
            if (!existingStatus) {
              await db.taskStatus.create(statusData);
            }
          })
        );
      }

      const newParticipant: ProjectParticipant = {
        projectId: pId,
        userId: userIdToAdd,
        role: 'participant',
        addedAt: now,
        removedAt: undefined
      };

      setProjectParticipants(prev => [...prev, newParticipant]);

      // Immediately refetch to ensure UI updates instantly
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['project', projectId] }),
        queryClient.refetchQueries({ queryKey: ['project', String(pId)] }),
        queryClient.refetchQueries({ queryKey: ['project', pId] }),
        queryClient.refetchQueries({ queryKey: ['projects'] }),
        queryClient.refetchQueries({ queryKey: ['projects', 'with-stats'] }),
        // Also refetch for the new user's projects and tasks
        queryClient.refetchQueries({ queryKey: ['projects', userIdToAdd] }),
        queryClient.refetchQueries({ queryKey: ['tasks'] }),
        queryClient.refetchQueries({ queryKey: ['taskStatuses'] }),
        queryClient.refetchQueries({ queryKey: ['tasks', 'today', userIdToAdd] }),
      ]);

      // Send notification to the newly added member
      try {
        // Create notification for the new member that they've been added
        await db.notifications.create({
          userId: userIdToAdd,
          type: 'project_joined',
          message: `You've been added to "${currentProject.name}" by ${user.name}`,
          projectId: pId,
          isRead: false,
          emailSent: false,
        });

        // Notify existing project members (except the adder) about the new member
        const existingParticipants = participants.filter(p => {
          const pUserId = typeof p.userId === 'string' ? parseInt(p.userId) : p.userId;
          const currentUserId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
          return pUserId !== currentUserId && pUserId !== userIdToAdd;
        });

        if (existingParticipants.length > 0) {
          const notificationsToCreate = existingParticipants.map(p => ({
            userId: typeof p.userId === 'string' ? parseInt(p.userId) : p.userId,
            type: 'project_joined' as const,
            message: `${userToAdd.name} joined "${currentProject.name}"`,
            projectId: pId,
            isRead: false,
            emailSent: false,
          }));
          await db.notifications.createMany(notificationsToCreate);
        }
      } catch (notifError) {
        // Don't fail the member addition if notification fails
        console.error('Failed to send notifications:', notifError);
      }

      toast.success('Member added! 🎉', {
        description: `${userToAdd.name} (${userToAdd.handle}) has been added to the project`
      });

      setMemberIdentifier('');
      setShowAddMemberForm(false);
    } catch (error) {
      handleError(error, 'handleAddMember');
    } finally {
      setIsAddingMember(false);
    }
  }, [currentProject, user, memberIdentifier, participants, projectId, queryClient, isAddingMember]);

  /**
   * Add multiple members to the project (batch operation)
   */
  const handleAddMembers = useCallback(async (userIds: number[]) => {
    if (!currentProject || !user || userIds.length === 0) return;

    // Check if the current user has permission to add members (owner or manager)
    const currentUserId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    const isOwner = (typeof currentProject.ownerId === 'string' ? parseInt(currentProject.ownerId) : currentProject.ownerId) === currentUserId;
    const isManager = participants.some(p => {
      const pUserId = typeof p.userId === 'string' ? parseInt(p.userId) : p.userId;
      return pUserId === currentUserId && p.role === 'manager';
    });

    if (!isOwner && !isManager) {
      toast.error('Permission denied', {
        description: 'Only project owners and managers can add members'
      });
      return;
    }

    try {
      const pId = typeof currentProject.id === 'string' ? parseInt(currentProject.id) : currentProject.id;
      const db = getDatabaseClient();

      // Filter out users who are already in the project
      const existingParticipantUserIds = participants.map(p => typeof p.userId === 'string' ? parseInt(p.userId) : p.userId);
      const userIdsToAdd = userIds.filter(id => !existingParticipantUserIds.includes(id));

      if (userIdsToAdd.length === 0) {
        toast.info('No new members to add', {
          description: 'All selected users are already in this project'
        });
        return;
      }

      const now = new Date();

      // Get all existing tasks in the project once (shared across all new members)
      const projectTasks = await db.tasks.getAll({ projectId: pId });
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Add each user as participant
      const addedParticipants: ProjectParticipant[] = [];

      for (const userIdToAdd of userIdsToAdd) {
        await db.projects.addParticipant(pId, userIdToAdd, 'participant');

        // Create task statuses for all existing tasks for this user
        const taskStatusesToCreate = projectTasks
          .map(task => {
            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            const isPastDue = dueDate.getTime() < today.getTime();

            return {
              taskId: typeof task.id === 'string' ? parseInt(task.id) : task.id,
              userId: userIdToAdd,
              status: isPastDue ? ('archived' as const) : ('active' as const),
              archivedAt: isPastDue ? now : undefined,
              ringColor: undefined,
            };
          });

        // Create task statuses (checking for existence first to avoid duplicates)
        if (taskStatusesToCreate.length > 0) {
          await Promise.all(
            taskStatusesToCreate.map(async (statusData) => {
              const existingStatus = await db.taskStatus.getByTaskAndUser(statusData.taskId, statusData.userId);
              if (!existingStatus) {
                await db.taskStatus.create(statusData);
              }
            })
          );
        }

        addedParticipants.push({
          projectId: pId,
          userId: userIdToAdd,
          role: 'participant',
          addedAt: now,
          removedAt: undefined
        });
      }

      // Update local state
      setProjectParticipants(prev => [...prev, ...addedParticipants]);

      // Get user details for notifications
      const userIdsStr = userIdsToAdd.map(id => String(id));
      const usersToAdd = await Promise.all(
        userIdsStr.map(async (userIdStr) => {
          const userData = await db.users.getById(parseInt(userIdStr));
          return userData;
        })
      );

      // Send notifications to all newly added members
      try {
        const notificationsForNewMembers = userIdsToAdd.map(userIdToAdd => ({
          userId: userIdToAdd,
          type: 'project_joined' as const,
          message: `You've been added to "${currentProject.name}" by ${user.name}`,
          projectId: pId,
          isRead: false,
          emailSent: false,
        }));
        await db.notifications.createMany(notificationsForNewMembers);

        // Notify existing project members (except the adder) about new members
        const existingParticipants = participants.filter(p => {
          const pUserId = typeof p.userId === 'string' ? parseInt(p.userId) : p.userId;
          const currentUserId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
          return pUserId !== currentUserId && !userIdsToAdd.includes(pUserId);
        });

        if (existingParticipants.length > 0 && usersToAdd.length > 0) {
          const memberNames = usersToAdd.map(u => u?.name || 'Unknown').join(', ');
          const notificationsToCreate = existingParticipants.map(p => ({
            userId: typeof p.userId === 'string' ? parseInt(p.userId) : p.userId,
            type: 'project_joined' as const,
            message: `${usersToAdd.length} ${usersToAdd.length === 1 ? 'member' : 'members'} joined "${currentProject.name}"`,
            projectId: pId,
            isRead: false,
            emailSent: false,
          }));
          await db.notifications.createMany(notificationsToCreate);
        }
      } catch (notifError) {
        console.error('Failed to send notifications:', notifError);
      }

      // Immediately refetch to ensure UI updates instantly
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['project', projectId] }),
        queryClient.refetchQueries({ queryKey: ['project', String(pId)] }),
        queryClient.refetchQueries({ queryKey: ['project', pId] }),
        queryClient.refetchQueries({ queryKey: ['projects'] }),
        queryClient.refetchQueries({ queryKey: ['projects', 'with-stats'] }),
        ...userIdsToAdd.map(userIdToAdd => queryClient.refetchQueries({ queryKey: ['projects', userIdToAdd] })),
        queryClient.refetchQueries({ queryKey: ['tasks'] }),
        queryClient.refetchQueries({ queryKey: ['taskStatuses'] }),
        ...userIdsToAdd.map(userIdToAdd => queryClient.refetchQueries({ queryKey: ['tasks', 'today', userIdToAdd] })),
      ]);

      toast.success(`${addedParticipants.length} member${addedParticipants.length > 1 ? 's' : ''} added! 🎉`, {
        description: addedParticipants.length === 1
          ? `${usersToAdd[0]?.name} has been added to the project`
          : `${addedParticipants.length} members have been added to the project`
      });
    } catch (error) {
      handleError(error, 'handleAddMembers');
    }
  }, [currentProject, user, participants, projectId, queryClient]);

  /**
   * Remove a participant from the project
   */
  const handleRemoveParticipant = useCallback(async (userIdToRemove: number) => {
    if (!currentProject || !user) return;

    try {
      const db = getDatabaseClient();
      const pId = typeof currentProject.id === 'string' ? parseInt(currentProject.id) : currentProject.id;

      // 1. Get all tasks for this project
      const projectTasks = await db.tasks.getAll({ projectId: pId });
      const projectTaskIds = projectTasks.map(task =>
        typeof task.id === 'string' ? parseInt(task.id) : task.id
      );

      // 2. Delete all task statuses for this user in this project
      if (projectTaskIds.length > 0) {
        await db.taskStatus.deleteByProjectAndUser(projectTaskIds, userIdToRemove);
      }

      // 3. Remove the user from the project (soft delete)
      await db.projects.removeParticipant(pId, userIdToRemove);

      const now = new Date();
      setProjectParticipants(prev =>
        prev.filter(pp => {
          const ppProjectId = typeof pp.projectId === 'string' ? parseInt(pp.projectId) : pp.projectId;
          const ppUserId = typeof pp.userId === 'string' ? parseInt(pp.userId) : pp.userId;
          return !(ppProjectId === pId && ppUserId === userIdToRemove);
        })
      );

      // Refetch all relevant queries immediately
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['project', projectId] }),
        queryClient.refetchQueries({ queryKey: ['project', String(pId)] }),
        queryClient.refetchQueries({ queryKey: ['project', pId] }),
        queryClient.refetchQueries({ queryKey: ['projects'] }),
        queryClient.refetchQueries({ queryKey: ['tasks'] }),
        queryClient.refetchQueries({ queryKey: ['taskStatuses'] }),
        queryClient.refetchQueries({ queryKey: ['tasks', 'project', pId] }),
      ]);

      toast.success('Participant removed', {
        description: 'The member has been removed from the project and all related tasks'
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

      // Create notification for the user whose role was updated
      try {
        await db.notifications.create({
          userId: userIdToUpdate,
          type: 'project_joined', // Fallback to 'project_joined' as 'role_changed' is not in DB enum yet
          message: `Your role in "${currentProject.name}" has been updated to ${newRole}`,
          projectId: pId,
          isRead: false,
          emailSent: false,
        });
      } catch (notifError) {
        console.error('Failed to send role update notification:', notifError);
      }

      // Refetch project immediately to show updated role
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['project', projectId] }),
        queryClient.refetchQueries({ queryKey: ['project', String(pId)] }),
        queryClient.refetchQueries({ queryKey: ['project', pId] }),
      ]);

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
    isAddingMember,

    // Handlers
    handleAddMember,
    handleAddMembers,
    handleRemoveParticipant,
    handleUpdateRole,
  };
};

