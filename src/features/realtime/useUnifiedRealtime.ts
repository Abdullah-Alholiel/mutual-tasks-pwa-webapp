// ============================================================================
// useUnifiedRealtime - SINGLE Unified Channel for ALL Realtime Updates
// ============================================================================
// This hook consolidates ALL task-related realtime subscriptions into ONE
// channel to avoid conflicts. Uses aggressive cache updates with string
// matching to ensure ALL relevant queries are updated instantly.
// ============================================================================

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSharedSupabaseClient } from '@/lib/supabaseClient';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { transformNotificationRow, type NotificationRow } from '@/db/transformers';
import type { Notification } from '@/types';

type Payload = RealtimePostgresChangesPayload<Record<string, unknown>>;

// ============================================================================
// AGGRESSIVE CACHE UPDATER - Updates ALL matching caches
// ============================================================================

function updateCacheData(currentData: unknown, payload: Payload): unknown {
    const { eventType } = payload;
    const newData = payload.new as Record<string, unknown> | undefined;
    const oldData = payload.old as Record<string, unknown> | undefined;

    // Handle arrays (list of tasks)
    if (Array.isArray(currentData)) {
        switch (eventType) {
            case 'INSERT':
                return newData ? [newData, ...currentData] : currentData;
            case 'UPDATE':
                return newData
                    ? currentData.map((item: unknown) =>
                        (item as Record<string, unknown>).id === newData.id
                            ? { ...(item as Record<string, unknown>), ...newData }
                            : item
                    )
                    : currentData;
            case 'DELETE':
                return oldData
                    ? currentData.filter(
                        (item: unknown) =>
                            (item as Record<string, unknown>).id !== oldData.id
                    )
                    : currentData;
            default:
                return currentData;
        }
    }

    // Handle objects with nested tasks (project detail)
    if (currentData && typeof currentData === 'object') {
        const obj = currentData as Record<string, unknown>;

        // Check for nested tasks array
        if (obj.tasks && Array.isArray(obj.tasks)) {
            return {
                ...obj,
                tasks: updateCacheData(obj.tasks, payload),
            };
        }

        // Check for nested data in various formats
        for (const key of Object.keys(obj)) {
            if (Array.isArray(obj[key])) {
                const arr = obj[key] as unknown[];
                // Check if array contains items with id field (likely tasks)
                if (
                    arr.length > 0 &&
                    arr[0] &&
                    typeof arr[0] === 'object' &&
                    'id' in (arr[0] as Record<string, unknown>)
                ) {
                    return {
                        ...obj,
                        [key]: updateCacheData(arr, payload),
                    };
                }
            }
        }
    }

    return currentData;
}

function updateAllTaskCaches(
    queryClient: ReturnType<typeof useQueryClient>,
    payload: Payload
) {
    const cache = queryClient.getQueryCache();
    const allQueries = cache.findAll();

    allQueries.forEach((query) => {
        try {
            const currentData = queryClient.getQueryData(query.queryKey);
            if (!currentData) return;

            const updated = updateCacheData(currentData, payload);
            if (updated !== currentData) {
                queryClient.setQueryData(query.queryKey, updated);
            }
        } catch (error) {
            console.warn(
                '[UnifiedRealtime] Failed to update cache for',
                query.queryKey,
                error
            );
        }
    });
}

// ============================================================================
// HANDLERS - Process each table change
// ============================================================================

function handleTaskChange(
    queryClient: ReturnType<typeof useQueryClient>,
    payload: Payload
) {

    // 1. IMMEDIATE optimistic cache update
    updateAllTaskCaches(queryClient, payload);

    // 2. AGGRESSIVE invalidation - force refetch of ALL related queries
    setTimeout(() => {
        const cache = queryClient.getQueryCache();
        const allQueries = cache.findAll();

        allQueries.forEach((query) => {
            const queryKeyStr = JSON.stringify(query.queryKey).toLowerCase();

            // If query contains ANY task-related keywords, refetch it
            if (
                queryKeyStr.includes('task') ||
                queryKeyStr.includes('project') ||
                queryKeyStr.includes('today') ||
                queryKeyStr.includes('list') ||
                queryKeyStr.includes('detail')
            ) {
                queryClient.invalidateQueries({ queryKey: query.queryKey });

                // FORCE immediate refetch for critical views
                if (
                    queryKeyStr.includes('today') ||
                    queryKeyStr.includes('project') ||
                    queryKeyStr.includes('tasks')
                ) {
                    queryClient.refetchQueries({ queryKey: query.queryKey });
                }
            }
        });
    }, 50); // 50ms delay for DB consistency
}

async function handleStatusChange(
    queryClient: ReturnType<typeof useQueryClient>,
    payload: Payload
) {

    const newData = payload.new as Record<string, unknown> | undefined;

    // If we have task_id, fetch the updated task for full data
    if (newData?.task_id) {
        try {
            const supabase = getSharedSupabaseClient();
            const { data: updatedTask } = await supabase
                .from('tasks')
                .select('*')
                .eq('id', newData.task_id)
                .single();

            if (updatedTask) {
                updateAllTaskCaches(queryClient, {
                    eventType: 'UPDATE',
                    new: updatedTask,
                    old: payload.old,
                    schema: 'public',
                    table: 'tasks',
                    commit_timestamp: '',
                    errors: null,
                });
            }
        } catch (error) {
            console.warn('[UnifiedRealtime] Failed to fetch updated task:', error);
        }
    }

    // Force refetch all status-related queries
    queryClient.refetchQueries({
        predicate: (query) => {
            const keyStr = JSON.stringify(query.queryKey).toLowerCase();
            return (
                keyStr.includes('status') ||
                keyStr.includes('task') ||
                keyStr.includes('project')
            );
        },
    });
}

function handleLogChange(
    queryClient: ReturnType<typeof useQueryClient>,
    payload: Payload
) {

    queryClient.refetchQueries({
        predicate: (query) => {
            const keyStr = JSON.stringify(query.queryKey).toLowerCase();
            return keyStr.includes('log') || keyStr.includes('task');
        },
    });
}

function handleParticipantChange(
    queryClient: ReturnType<typeof useQueryClient>,
    payload: Payload
) {

    const newData = payload.new as Record<string, unknown> | undefined;

    if (newData?.project_id) {
        // Invalidate that specific project
        queryClient.refetchQueries({
            predicate: (query) =>
                JSON.stringify(query.queryKey).includes(String(newData.project_id)),
        });
    }

    // Also refetch all projects list
    queryClient.refetchQueries({
        predicate: (query) => {
            const keyStr = JSON.stringify(query.queryKey).toLowerCase();
            return keyStr.includes('project');
        },
    });
}

/**
 * Show browser notification if supported and permitted
 */
function showBrowserNotification(notification: Notification) {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
        new Notification('Mutual Tasks', {
            body: notification.message,
            icon: '/icons/icon-192x192.png',
            tag: `notification-${notification.id}`,
        });
    } else if (Notification.permission !== 'denied') {
        // Request permission
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification('Mutual Tasks', {
                    body: notification.message,
                    icon: '/icons/icon-192x192.png',
                    tag: `notification-${notification.id}`,
                });
            }
        });
    }
}

function handleNotificationChange(
    queryClient: ReturnType<typeof useQueryClient>,
    payload: Payload
) {
    // Show browser notification for new items
    if (payload.eventType === 'INSERT' && payload.new) {
        try {
            const newNotification = transformNotificationRow(payload.new as NotificationRow);
            showBrowserNotification(newNotification);
        } catch (e) {
            console.warn('[UnifiedRealtime] Failed to show browser notification:', e);
        }
    }

    // Identify user ID from payload to invalidate specific user cache if possible
    const userId = (payload.new as any)?.user_id || (payload.old as any)?.user_id;

    // Invalidate all notification queries
    queryClient.invalidateQueries({
        predicate: (query) => {
            const keyStr = JSON.stringify(query.queryKey).toLowerCase();
            const matchesType = keyStr.includes('notification');

            // If we have a user ID, strictly match it to avoid invalidating everyone's cache (though RLS prevents seeing others)
            const matchesUser = userId ? keyStr.includes(String(userId)) : true;

            return matchesType && matchesUser;
        },
    });

    // Also force refetch for immediate UI update
    if (userId) {
        queryClient.refetchQueries({ queryKey: ['notifications', userId] });
    } else {
        queryClient.refetchQueries({ queryKey: ['notifications'] });
    }
}


// ============================================================================
// MAIN HOOK
// ============================================================================

export function useUnifiedRealtime() {
    const queryClient = useQueryClient();

    useEffect(() => {
        const supabase = getSharedSupabaseClient();

        // ===========================================================
        // SINGLE CHANNEL FOR ALL TASK-RELATED CHANGES
        // ===========================================================
        const unifiedChannel = supabase
            .channel('unified-realtime-channel')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'tasks',
                },
                (payload) => handleTaskChange(queryClient, payload)
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'task_statuses',
                },
                (payload) => handleStatusChange(queryClient, payload)
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'completion_logs',
                },
                (payload) => handleLogChange(queryClient, payload)
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'project_participants',
                },
                (payload) => handleParticipantChange(queryClient, payload)
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                },
                (payload) => handleNotificationChange(queryClient, payload)
            )
            .subscribe();

        return () => {
            supabase.removeChannel(unifiedChannel);
        };
    }, [queryClient]);
}

export default useUnifiedRealtime;
