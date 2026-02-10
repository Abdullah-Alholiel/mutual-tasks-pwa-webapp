// ============================================================================
// useProjectMembers - Member Management for Project Detail
// ============================================================================

import { useState, useMemo, useEffect, useCallback } from 'react';
import { toast } from '@/components/ui/sonner';
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
      toast.error("You don't have permission for this.", {
        description: 'Only moderators and owners can add members.'
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
        toast.error("Hm, we couldn't find that user.", {
          description: "Double-check the handle and try again."
        });
        return;
      }

      const userIdToAdd = typeof userToAdd.id === 'string' ? parseInt(userToAdd.id) : userToAdd.id;
      const pId = typeof currentProject.id === 'string' ? parseInt(currentProject.id) : currentProject.id;

      if (participants.some(p => {
        const pUserId = typeof p.userId === 'string' ? parseInt(p.userId) : p.userId;
        return pUserId === userIdToAdd;
      })) {
        toast.error("They're already here.", {
          description: "This user is already a member of the project."
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
        .filter(() => {
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

      // Send notifications using unified notification service
      try {
        await notificationService.notifyProjectJoined(pId, userIdToAdd);
      } catch (notifError) {
        console.error('Failed to send notifications:', notifError);
      }

      toast.success('Member added! 🎉', {
        description: `${userToAdd.name} is now part of the project.`
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
        toast.info("No new members to add.", {
          description: 'Everyone selected is already in the project.'
        });
        return;
      }

      const now = new Date();

      // ✅ OPTIMISTIC UPDATE - Do this FIRST, immediately
      const optimisticParticipants = userIdsToAdd.map(userId => ({
        projectId: pId,
        userId: userId,
        role: 'participant' as const,
        addedAt: now,
        removedAt: undefined
      }));
      setProjectParticipants(prev => [...prev, ...optimisticParticipants]);

      // Show success toast immediately (user sees this while loading)
      toast.success('Members added! 🎉', {
        description: `They'll be added to all tasks shortly.`
      });

      // ✅ ACTUALLY AWAIT the work - no fire-and-forget
      try {
        // Get all tasks
        const projectTasks = await db.tasks.getAll({ projectId: pId });
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // ✅ PARALLEL: Add all users at once (not serial)
        await Promise.all(
          userIdsToAdd.map(async (userIdToAdd) => {
            await db.projects.addParticipant(pId, userIdToAdd, 'participant');

            // Create task statuses
            const taskStatusesToCreate = projectTasks.map(task => {
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
          })
        );

        // ✅ PARALLEL: Send all notifications at once
        await Promise.all(
          userIdsToAdd.map(userIdToAdd =>
            notificationService.notifyProjectJoined(pId, userIdToAdd, userIdsToAdd.length).catch(err => {
              console.error('Notification failed:', err);
            })
          )
        );

        // ✅ NON-BLOCKING: Refetch queries (don't await)
        Promise.all([
          queryClient.refetchQueries({ queryKey: ['project', projectId] }),
          queryClient.refetchQueries({ queryKey: ['project', String(pId)] }),
          queryClient.refetchQueries({ queryKey: ['project', pId] }),
          queryClient.refetchQueries({ queryKey: ['projects'] }),
          queryClient.refetchQueries({ queryKey: ['projects', 'with-stats'] }),
          ...userIdsToAdd.map(userIdToAdd => queryClient.refetchQueries({ queryKey: ['projects', userIdToAdd] })),
          queryClient.refetchQueries({ queryKey: ['tasks'] }),
          queryClient.refetchQueries({ queryKey: ['taskStatuses'] }),
          ...userIdsToAdd.map(userIdToAdd => queryClient.refetchQueries({ queryKey: ['tasks', 'today', userIdToAdd] })),
        ]).catch(err => {
          console.error('Refetch failed:', err);
        });

      } catch (error) {
        handleError(error, 'handleAddMembers background process');
        // Start rollback or extensive error handling if critical data consistency is lost
        // For now, simple logging as this is an optimistic update scenario
      }

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

      toast.success('Member removed.', {
        description: "They've been removed from the project and related tasks."
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
        const updaterId = typeof user?.id === 'string' ? parseInt(user.id) : (user?.id ?? 0);
        await notificationService.notifyRoleChanged(pId, updaterId, userIdToUpdate, newRole);
      } catch (notifError) {
        console.error('Failed to send role update notification:', notifError);
      }

      // Refetch project immediately to show updated role
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['project', projectId] }),
        queryClient.refetchQueries({ queryKey: ['project', String(pId)] }),
        queryClient.refetchQueries({ queryKey: ['project', pId] }),
      ]);

      toast.success('Role updated. 🛡️', {
        description: "The member's permissions have been changed."
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

