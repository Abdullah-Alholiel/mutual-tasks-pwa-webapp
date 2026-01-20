// ============================================================================
// User Data Hooks - Centralized User Fetching with React Query Caching
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { getDatabaseClient } from '@/db';
import { PERFORMANCE_CONFIG } from '@/config/appConfig';
import { perf } from '@/lib/monitoring/performance';

/**
 * Hook to fetch a single user by ID
 * Centralizes user fetching logic with caching
 */
export const useUser = (userId: number | string | undefined) => {
    return useQuery({
        queryKey: ['user', userId],
        queryFn: async () => {
            if (!userId) return null;
            const db = getDatabaseClient();
            const id = typeof userId === 'string' ? parseInt(userId) : userId;

            // Performance monitoring
            return await perf.measure('users.getById', async () => {
                return await db.users.getById(id);
            });
        },
        enabled: !!userId,
        staleTime: PERFORMANCE_CONFIG.CACHING.USER_DATA_STALE_TIME,
        gcTime: PERFORMANCE_CONFIG.CACHING.USER_DATA_GC_TIME,
    });
};

/**
 * Hook to fetch multiple users by IDs efficiently
 * Uses batch fetching to avoid N+1 query problem
 */
export const useBatchUsers = (userIds: (number | string)[] | undefined) => {
    // Create a stable, sorted key for React Query
    const sortedIds = userIds?.map(id => typeof id === 'string' ? parseInt(id) : id).sort((a, b) => a - b);

    return useQuery({
        queryKey: ['users', 'batch', sortedIds],
        queryFn: async () => {
            if (!userIds || userIds.length === 0) return [];
            const db = getDatabaseClient();
            const numericIds = userIds.map(id => typeof id === 'string' ? parseInt(id) : id);

            // Performance monitoring
            return await perf.measure('users.getByIds', async () => {
                return await db.users.getByIds(numericIds);
            }, { count: numericIds.length });
        },
        enabled: !!userIds && userIds.length > 0,
        staleTime: PERFORMANCE_CONFIG.CACHING.USER_DATA_STALE_TIME,
        gcTime: PERFORMANCE_CONFIG.CACHING.USER_DATA_GC_TIME,
    });
};

/**
 * Hook to search users by query (handle or email)
 */
export const useUserSearch = (query: string | undefined) => {
    return useQuery({
        queryKey: ['users', 'search', query],
        queryFn: async () => {
            if (!query || query.length < 2) return [];
            const db = getDatabaseClient();

            return await perf.measure('users.search', async () => {
                return await db.users.search(query);
            }, { query });
        },
        enabled: !!query && query.length >= 2,
        staleTime: PERFORMANCE_CONFIG.CACHING.SEARCH_DATA_STALE_TIME,
        gcTime: PERFORMANCE_CONFIG.CACHING.SEARCH_DATA_GC_TIME,
    });
};
