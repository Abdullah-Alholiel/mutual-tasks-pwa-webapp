// ============================================================================
// useCurrentUser Hook - Current User Management
// ============================================================================
// 
// This hook provides access to the current user and their stats.
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/db';
import { currentUser as mockCurrentUser } from '@/lib/mockData';

/**
 * Hook to fetch current user
 * In a real app, this would get the user from auth context
 */
export const useCurrentUser = () => {
  return useQuery({
    queryKey: ['user', 'current'],
    queryFn: async () => {
      // For now, use mock current user
      // In production, this would fetch from auth context or API
      return await db.getUser(mockCurrentUser.id);
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    initialData: mockCurrentUser, // Use mock as initial data
  });
};

/**
 * Hook to fetch current user stats
 */
export const useCurrentUserStats = () => {
  return useQuery({
    queryKey: ['user', 'current', 'stats'],
    queryFn: async () => {
      return await db.getUserStats(mockCurrentUser.id);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    initialData: mockCurrentUser.stats, // Use mock as initial data
  });
};


