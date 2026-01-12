import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getRealtimeManager } from '@/features/realtime/RealtimeManager';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseTaskInsertRealtimeParams {
    userId: number | null | undefined;
    enabled?: boolean;
}

/**
 * Hook to receive realtime updates when tasks are created/updated/deleted.
 * Works globally for Today's Tasks and per-project views.
 * 
 * Uses the same pattern as useNotifications - direct refetch for instant updates.
 */
export const useTaskInsertRealtime = ({
    userId,
    enabled = true,
}: UseTaskInsertRealtimeParams) => {
    const queryClient = useQueryClient();

    // Handler for task changes - uses refetchQueries for INSTANT update (like notifications)
    const handleTaskChange = useCallback((
        payload: RealtimePostgresChangesPayload<Record<string, unknown>>
    ) => {
        const newRecord = payload.new as Record<string, unknown> | undefined;
        const oldRecord = payload.old as Record<string, unknown> | undefined;
        const projectId = newRecord?.project_id || oldRecord?.project_id;

        console.log(`[TaskInsertRealtime] ${payload.eventType} on tasks table`, {
            projectId,
            taskId: newRecord?.id || oldRecord?.id
        });

        // Use refetchQueries with PREDICATE matching for aggressive instant refresh
        // This catches ALL variations of task queries (today, project, user, filtered)
        const refetchAll = () => {
            queryClient.refetchQueries({
                predicate: (query) => {
                    const key = query.queryKey;
                    // Match any query starting with 'tasks'
                    if (Array.isArray(key) && key[0] === 'tasks') {
                        return true;
                    }
                    // Match project detail queries
                    if (Array.isArray(key) && key[0] === 'project' && projectId && (key[1] === projectId || key[1] === String(projectId))) {
                        return true;
                    }
                    return false;
                }
            }).catch(err => {
                console.warn('[TaskInsertRealtime] Refetch failed:', err);
            });
        };

        // Immediate refetch (small delay for DB consistency)
        setTimeout(refetchAll, 100);
        // Backup refetch (slightly longer delay to ensure consistency)
        setTimeout(refetchAll, 500);

    }, [queryClient]);

    // Set up subscription directly with RealtimeManager (like notifications)
    useEffect(() => {
        if (!userId || !enabled) return;

        const manager = getRealtimeManager();
        const unsubscribe = manager.subscribe(
            'task-inserts',
            userId,
            handleTaskChange
        );

        return unsubscribe;
    }, [userId, enabled, handleTaskChange]);
};

export default useTaskInsertRealtime;
