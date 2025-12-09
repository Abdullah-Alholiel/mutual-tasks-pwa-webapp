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
import type { Project } from '@/types';
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
    staleTime: 1000 * 60 * 5,
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
