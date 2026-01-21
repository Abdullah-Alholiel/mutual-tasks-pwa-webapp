// ============================================================================
// useFriendRequestsRealtime Hook - Legacy Compatibility Hook
// ============================================================================
// This hook is now a NO-OP since all realtime updates are handled
// globally by useUnifiedRealtime in GlobalRealtimeSubscriptions.tsx.
//
// Kept for backward compatibility with existing code.
// All friendship updates are now automatically reflected via React Query invalidation.
// ============================================================================

interface UseFriendRequestsRealtimeParams {
    userId: number | null | undefined;
    enabled?: boolean;
}

export const useFriendRequestsRealtime = ({
    userId,
    enabled = true,
}: UseFriendRequestsRealtimeParams) => {
    // All realtime updates now handled by useUnifiedRealtime at app level
    // This hook exists only for backward compatibility
    // Friendship table changes are automatically invalidating ['friends'] and ['friendRequests'] queries
    return null;
};

export default useFriendRequestsRealtime;
