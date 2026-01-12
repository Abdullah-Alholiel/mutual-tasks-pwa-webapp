// ============================================================================
// useFriendRequestsRealtime Hook - Real-time Friend Request Updates
// ============================================================================
// Provides real-time updates for friend requests using the RealtimeManager
// ============================================================================

import { useOptimisticSubscription } from '@/hooks/useOptimisticSubscription';
import type { Friend } from '@/types';

interface UseFriendRequestsRealtimeParams {
    userId: number | null | undefined;
    enabled?: boolean;
}

export const useFriendRequestsRealtime = ({
    userId,
    enabled = true,
}: UseFriendRequestsRealtimeParams) => {
    // 1. Optimistic friend requests (Incoming)
    // We only optimistically handle DELETE (reject/accept removes from pending list)
    // INSERTs need joined user data, so we rely on the fast invalidation
    useOptimisticSubscription<Friend[]>({
        channelName: 'friend-requests',
        queryKey: ['friendRequests'],
        userId,
        enabled,
        updater: (oldData = [], payload) => {
            if (payload.eventType === 'DELETE') {
                return oldData.filter(f => f.id !== payload.old.id);
            }
            if (payload.eventType === 'UPDATE') {
                // If status changed to something other than pending, remove it
                if (payload.new.status !== 'pending') {
                    return oldData.filter(f => f.id !== payload.new.id);
                }
            }
            // For INSERT, we can't construct the full User object easily without preloading.
            // We rely on the hook's background invalidation to fetch it quickly.
            return oldData;
        },
        invalidateDelay: 500
    });

    // 2. Optimistic friends list (Accepted)
    useOptimisticSubscription<Friend[]>({
        channelName: 'friend-requests', // Reuse the same channel connection
        queryKey: ['friends'],
        userId,
        enabled,
        updater: (oldData = [], payload) => {
            if (payload.eventType === 'DELETE') {
                return oldData.filter(f => f.id !== payload.old.id);
            }
            // For INSERT/UPDATE (Accepted), we rely on invalidation for full profile data
            return oldData;
        },
        invalidateDelay: 500
    });
};

export default useFriendRequestsRealtime;
