// ============================================================================
// useTaskInsertRealtime Hook - Legacy Compatibility Hook
// ============================================================================
// This hook is now a NO-OP since all realtime updates are handled
// globally by useUnifiedRealtime in GlobalRealtimeSubscriptions.tsx.
//
// Kept for backward compatibility with existing code.
// All task inserts/updates/deletes are now automatically reflected via React Query.
// ============================================================================

interface UseTaskInsertRealtimeParams {
    userId: number | null | undefined;
    enabled?: boolean;
}

export const useTaskInsertRealtime = ({
    userId,
    enabled = true,
}: UseTaskInsertRealtimeParams) => {
    // All realtime updates now handled by useUnifiedRealtime at app level
    // This hook exists only for backward compatibility
    // Tasks table changes are automatically invalidating all task queries
    return null;
};

export default useTaskInsertRealtime;
