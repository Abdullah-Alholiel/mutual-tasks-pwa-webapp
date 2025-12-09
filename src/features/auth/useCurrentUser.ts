// ============================================================================
// useCurrentUser Hook - Current User Management
// ============================================================================
// 
// This hook provides access to the current user and their stats.
// Uses authentication system to get the current user.
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { getDatabaseClient } from '@/db';
import { useAuth } from '../auth/useAuth';

/**
 * Hook to fetch current user from auth context
 */
export const useCurrentUser = () => {
  const { user, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['user', 'current', user?.id],
    queryFn: async () => {
      if (!user || !isAuthenticated) return null;
      
      const db = getDatabaseClient();
      const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      return await db.users.getById(userId);
    },
    enabled: !!user && isAuthenticated,
    staleTime: 1000 * 60 * 10, // 10 minutes
    initialData: user || undefined, // Use auth user as initial data
  });
};

/**
 * Hook to fetch current user stats
 */
export const useCurrentUserStats = () => {
  const { user, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['user', 'current', 'stats', user?.id],
    queryFn: async () => {
      if (!user || !isAuthenticated) return null;
      
      const db = getDatabaseClient();
      const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      return await db.users.getStats(userId);
    },
    enabled: !!user && isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
    initialData: user?.stats || undefined, // Use auth user stats as initial data
  });
};
