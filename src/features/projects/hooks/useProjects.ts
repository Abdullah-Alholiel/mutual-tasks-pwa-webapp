// ============================================================================
// useProjects Hook - React Query Hook for Projects
// ============================================================================
// 
// This hook provides a standardized way to fetch and manage projects
// using React Query for caching and state management.
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDatabaseClient } from '@/db';
import { useAuth } from '../../auth/useAuth';
import type { Project, NotificationType } from '@/types';
import { handleError } from '@/lib/errorUtils';
import { toast } from 'sonner';

/**
 * Hook to fetch all projects for the current user
 */
export const useProjects = () => {
  const { user, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['projects', user?.id],
    queryFn: async () => {
      if (!user || !isAuthenticated) return [];

      const db = getDatabaseClient();
      const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      return await db.projects.getAll({ userId });
    },
    enabled: !!user && isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook to fetch a single project by ID
 */
export const useProject = (projectId: string | number | undefined) => {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;

      const db = getDatabaseClient();
      const id = typeof projectId === 'string' ? parseInt(projectId) : projectId;
      return await db.projects.getById(id);
    },
    enabled: !!projectId,
    staleTime: 0, // Always allow refetch for instant updates when members change
    refetchOnMount: true,
  });
};

/**
 * Hook to fetch public projects
 */
export const usePublicProjects = () => {
  const { user, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['projects', 'public', user?.id],
    queryFn: async () => {
      const db = getDatabaseClient();
      const allProjects = await db.projects.getAll({ isPublic: true });

      // Filter out projects where user is already a participant
      if (user && isAuthenticated) {
        const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
        return allProjects.filter(p =>
          !p.participants?.some(u => {
            const uId = typeof u.id === 'string' ? parseInt(u.id) : u.id;
            return uId === userId;
          }) &&
          !p.participantRoles?.some(pr => {
            const prId = typeof pr.userId === 'string' ? parseInt(pr.userId) : pr.userId;
            return prId === userId;
          }) &&
          (typeof p.ownerId === 'string' ? parseInt(p.ownerId) : p.ownerId) !== userId
        );
      }

      return allProjects;
    },
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Hook to create a new project
 */
export const useCreateProject = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!user) {
        throw new Error('User must be authenticated to create a project');
      }

      const db = getDatabaseClient();
      return await db.projects.create(data);
    },
    onSuccess: (newProject) => {
      // Invalidate and refetch projects
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created! 🎉', {
        description: 'Start adding tasks to get going!'
      });
      return newProject;
    },
    onError: (error) => {
      handleError(error, 'useCreateProject');
    },
  });
};

/**
 * Hook to update a project
 */
export const useUpdateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string | number; data: Partial<Project> }) => {
      const db = getDatabaseClient();
      const projectId = typeof id === 'string' ? parseInt(id) : id;
      return await db.projects.update(projectId, data);
    },
    onSuccess: (updatedProject) => {
      // Invalidate and refetch projects
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', updatedProject.id] });
      toast.success('Project updated! ✅');
    },
    onError: (error) => {
      handleError(error, 'useUpdateProject');
    },
  });
};

/**
 * Hook to fetch projects with computed stats (progress, completed tasks, total tasks)
 * for the current user. This is more efficient than fetching all tasks/logs for each card.
 */
export const useUserProjectsWithStats = () => {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['projects', 'with-stats', user?.id],
    queryFn: async () => {
      if (!user || !isAuthenticated) return [];

      const db = getDatabaseClient();
      const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;

      // 1. Get projects where user is participant
      const projects = await db.projects.getAll({ userId });

      if (projects.length === 0) return [];

      // 2. Get all tasks for these projects to calculate total tasks
      // Instead of fetching all tasks for all projects (which could be many),
      // we'll fetch them in parallel for each project.
      const projectsWithStats = await Promise.all(
        projects.map(async (project) => {
          const projectId = typeof project.id === 'string' ? parseInt(project.id) : project.id;

          // Get tasks for this project
          const tasks = await db.tasks.getAll({ projectId });
          const totalTasks = tasks.length;

          // Get completion logs for this user in this project
          // Optimization: many completion logs might belong to the same project
          const completionLogs = await db.completionLogs.getAll({ userId });

          const completedTasksCount = tasks.filter(t => {
            const taskId = typeof t.id === 'string' ? parseInt(t.id) : t.id;
            return completionLogs.some(cl => {
              const clTaskId = typeof cl.taskId === 'string' ? parseInt(cl.taskId) : cl.taskId;
              return clTaskId === taskId;
            });
          }).length;

          const progress = totalTasks > 0 ? Math.round((completedTasksCount / totalTasks) * 100) : 0;

          return {
            ...project,
            totalTasks,
            completedTasks: completedTasksCount,
            progress
          };
        })
      );

      return projectsWithStats;
    },
    enabled: !!user && isAuthenticated,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};

/**
 * Hook to delete a project
 */
export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string | number) => {
      const db = getDatabaseClient();
      const projectId = typeof id === 'string' ? parseInt(id) : id;
      await db.projects.delete(projectId);
    },
    onSuccess: () => {
      // Invalidate and refetch projects
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted! 🗑️');
    },
    onError: (error) => {
      handleError(error, 'useDeleteProject');
    },
  });
};
/**
 * Hook to join a project
 */
export const useJoinProject = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (projectId: string | number) => {
      if (!user) {
        throw new Error('User must be authenticated to join a project');
      }

      const db = getDatabaseClient();
      const pId = typeof projectId === 'string' ? parseInt(projectId) : projectId;
      const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;

      // 1. Add user as participant
      await db.projects.addParticipant(pId, userId, 'participant');

      // 2. Create task statuses for ALL existing tasks in the project
      // This ensures they see all tasks immediately in "Today" and other views
      const projectTasks = await db.tasks.getAll({ projectId: pId });
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create task statuses for all tasks (active for future/today, archived for past due)
      if (projectTasks.length > 0) {
        await Promise.all(
          projectTasks.map(async (task) => {
            // Check if status already exists (safety check)
            const existingStatus = await db.taskStatus.getByTaskAndUser(task.id, userId);
            if (existingStatus) {
              return; // Skip if already exists
            }

            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            const isPastDue = dueDate.getTime() < today.getTime();

            // Create task status with appropriate initial state
            await db.taskStatus.create({
              taskId: task.id,
              userId: userId,
              status: isPastDue ? ('archived' as const) : ('active' as const),
              archivedAt: isPastDue ? now : undefined,
              ringColor: undefined,
            });
          })
        );
      }

      // 3. Get project and existing participants to create notifications
      const project = await db.projects.getById(pId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Get existing participants (excluding the user joining)
      const existingParticipants = project.participantRoles
        ?.filter(pp => {
          const ppUserId = typeof pp.userId === 'string' ? parseInt(pp.userId) : pp.userId;
          return ppUserId !== userId && !pp.removedAt;
        })
        .map(pp => pp.userId) || [];

      // Create notifications for existing participants
      if (existingParticipants.length > 0) {
        const notificationsToCreate = existingParticipants.map(participantId => ({
          userId: typeof participantId === 'string' ? parseInt(participantId) : participantId,
          type: 'project_joined' as const,
          message: `${user.name} joined "${project.name}"`,
          projectId: pId,
          isRead: false,
          emailSent: false,
        }));
        await db.notifications.createMany(notificationsToCreate);
      }

      return { projectId: pId, userId };
    },
    onSuccess: async (_, projectId) => {
      // Immediately refetch to ensure UI updates instantly
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['projects'] }),
        queryClient.refetchQueries({ queryKey: ['project', String(projectId)] }),
        queryClient.refetchQueries({ queryKey: ['projects', 'with-stats'] }),
        // Also invalidate tasks queries so the new statuses are fetched
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['taskStatuses'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks', 'today'] }),
      ]);
      toast.success('Joined project! 🎉', {
        description: 'You have been added to all active tasks.'
      });
    },
    onError: (error) => {
      handleError(error, 'useJoinProject');
    },
  });
};

/**
 * Hook to leave a project
 */
export const useLeaveProject = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (projectId: string | number) => {
      if (!user) {
        throw new Error('User must be authenticated to leave a project');
      }

      const db = getDatabaseClient();
      const pId = typeof projectId === 'string' ? parseInt(projectId) : projectId;
      const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;

      // 1. Get all tasks for this project
      const projectTasks = await db.tasks.getAll({ projectId: pId });
      const projectTaskIds = projectTasks.map(task => 
        typeof task.id === 'string' ? parseInt(task.id) : task.id
      );

      // 2. Delete all task statuses for this user in this project
      if (projectTaskIds.length > 0) {
        await db.taskStatus.deleteByProjectAndUser(projectTaskIds, userId);
      }

      // 3. Remove the user from the project (soft delete)
      await db.projects.removeParticipant(pId, userId);
      return { projectId: pId, userId };
    },
    onSuccess: async (_, projectId) => {
      // Invalidate all relevant queries to ensure the project appears in "Public Projects"
      // and disappears from "My Projects", and task-related data is refreshed
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        queryClient.invalidateQueries({ queryKey: ['project', String(projectId)] }),
        queryClient.invalidateQueries({ queryKey: ['projects', 'with-stats'] }),
        // Explicitly invalidate public projects to ensure it reappears there
        queryClient.invalidateQueries({ queryKey: ['projects', 'public'] }),
        // Invalidate task-related queries since task statuses were deleted
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['taskStatuses'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks', 'project', projectId] }),
      ]);

      toast.success('Left project', {
        description: 'You have been removed from this project and all related tasks'
      });
    },
    onError: (error) => {
      handleError(error, 'useLeaveProject');
    },
  });
};
