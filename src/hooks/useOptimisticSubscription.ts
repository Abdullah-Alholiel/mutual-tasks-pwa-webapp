import { useEffect } from 'react';
import { useQueryClient, QueryKey } from '@tanstack/react-query';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { getRealtimeManager, SubscriptionType } from '@/features/realtime/RealtimeManager';

interface UseOptimisticSubscriptionOptions<TData> {
    channelName: SubscriptionType;
    queryKey: QueryKey;
    userId?: number | null;
    enabled?: boolean;
    filter?: {
        projectId?: string | number;
        taskIds?: number[];
    };
    updater: (
        oldData: TData | undefined,
        payload: RealtimePostgresChangesPayload<Record<string, unknown>>
    ) => TData | undefined;
    invalidateDelay?: number;
    /**
     * Optional side effect to run when an event is received.
     * Useful for invalidating extra queries or triggering UI feedback.
     */
    sideEffect?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
}

/**
 * Generic hook for optimistic realtime updates.
 * 
 * 1. Subscribes to a channel via RealtimeManager
 * 2. On Event: optimistically updates React Query cache via `updater` function
 * 3. Schedules a background invalidation/refetch ensure consistency
 */
export function useOptimisticSubscription<TData = unknown>({
    channelName,
    queryKey,
    userId,
    enabled = true,
    filter,
    updater,
    invalidateDelay = 1000,
    sideEffect
}: UseOptimisticSubscriptionOptions<TData>) {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!enabled || (userId === undefined && !filter?.projectId)) return;

        // Use userId or a default for project-specific subscriptions
        const effectiveUserId = userId ?? 0;

        const manager = getRealtimeManager();

        const handleUpdate = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            // 1. Optimistic Update (Immediate)
            queryClient.setQueryData<TData>(queryKey, (oldData) => {
                return updater(oldData, payload);
            });

            // 2. Side Effect (Immediate)
            if (sideEffect) {
                sideEffect(payload);
            }

            // 3. Background Validation (Delayed)
            // We use invalidateQueries to trigger a refetch
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey });
            }, invalidateDelay);
        };

        const unsubscribe = manager.subscribe(
            channelName,
            effectiveUserId,
            handleUpdate,
            filter
        );

        return unsubscribe;
    }, [
        channelName,
        // Stable query key serialization for dependency array
        JSON.stringify(queryKey),
        userId,
        enabled,
        updater,
        invalidateDelay,
        sideEffect,
        queryClient,
        // Stable filter serialization
        JSON.stringify(filter)
    ]);
}
