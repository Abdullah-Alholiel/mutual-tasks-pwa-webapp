// ============================================================================
// useProjectRealtime Hook - Legacy Compatibility Hook
// ============================================================================
// This hook is now a NO-OP since all realtime updates are handled
// globally by useUnifiedRealtime in GlobalRealtimeSubscriptions.tsx.
//
// Kept for backward compatibility with existing code.
// All project updates are now automatically reflected via React Query invalidation.
// ============================================================================

export const useProjectRealtime = () => {
    // All realtime updates now handled by useUnifiedRealtime at app level
    // This hook exists only for backward compatibility
    return null;
};

export const useProjectDetailRealtime = (projectId: string | number | undefined, userId?: number | null) => {
    // All realtime updates now handled by useUnifiedRealtime at app level
    // This hook exists only for backward compatibility
    return null;
};

export default useProjectRealtime;
