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
 * Automatically recalculates stats from completion logs to ensure accuracy
 */
export const useCurrentUserStats = () => {
  const { user, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['user', 'current', 'stats', user?.id],
    queryFn: async () => {
      if (!user || !isAuthenticated) return null;
      
      const db = getDatabaseClient();
      const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      
      // Always recalculate stats from completion logs to ensure accuracy
      // This ensures stats are always in sync with actual completion activity
      try {
        const stats = await db.users.recalculateStats(userId, user.timezone || 'UTC');
        return stats;
      } catch (error) {
        console.error('Failed to recalculate user stats:', error);
        // Fallback: try to get existing stats if recalculation fails
        const existingStats = await db.users.getStats(userId);
        return existingStats;
      }
    },
    enabled: !!user && isAuthenticated,
    staleTime: 1000 * 60 * 1, // 1 minute - short stale time to ensure freshness
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
    initialData: user?.stats || undefined, // Use auth user stats as initial data
  });
};
