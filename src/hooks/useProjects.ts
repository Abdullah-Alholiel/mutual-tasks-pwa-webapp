// ============================================================================
// useProjects Hook - React Query Hook for Projects
// ============================================================================
// 
// This hook provides a standardized way to fetch and manage projects
// using React Query for caching and state management.
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/db';
import { currentUser } from '@/lib/mockData';
import type { Project } from '@/types';
import { handleError } from '@/lib/errorUtils';
import { toast } from 'sonner';

/**
 * Hook to fetch all projects for the current user
 */
export const useProjects = () => {
  return useQuery({
    queryKey: ['projects', currentUser.id],
    queryFn: async () => {
      return await db.getProjects({ userId: currentUser.id });
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook to fetch a single project by ID
 */
export const useProject = (projectId: string | undefined) => {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      return await db.getProject(projectId);
    },
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Hook to fetch public projects
 */
export const usePublicProjects = () => {
  return useQuery({
    queryKey: ['projects', 'public', currentUser.id],
    queryFn: async () => {
      const allProjects = await db.getProjects({ isPublic: true });
      // Filter out projects where user is already a participant
      return allProjects.filter(p => 
        !p.participants?.some(u => u.id === currentUser.id) &&
        !p.participantRoles?.some(pr => pr.userId === currentUser.id) &&
        p.ownerId !== currentUser.id
      );
    },
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Hook to create a new project
 */
export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
      return await db.createProject(data);
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
    mutationFn: async ({ id, data }: { id: string; data: Partial<Project> }) => {
      return await db.updateProject(id, data);
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

