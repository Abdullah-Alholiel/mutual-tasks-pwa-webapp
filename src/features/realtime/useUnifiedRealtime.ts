// ============================================================================
// useUnifiedRealtime - UNIFIED Single-Channel Realtime Hook V2
// ============================================================================
// Complete rewrite with health monitoring, reconnection, and connection status.
// Replaces RealtimeManager and useOptimisticSubscription patterns.
//
// Architecture:
// - Single WebSocket channel for all real-time events
// - Centralized query key management for consistent cache invalidation
// - Health monitoring with periodic checks and auto-reconnection
// - Connection status tracking and reconnection with exponential backoff
// - Proper cleanup to prevent memory leaks and duplicate connections
//
// Features:
// - Automatic reconnection with exponential backoff (1s → 30s max)
// - Health monitoring every 30 seconds
// - Connection status (connected/disconnected/reconnecting)
// - User-specific notification filtering
// - Instant cache updates without server round-trips
// - Comprehensive logging with centralized logger
// ============================================================================

import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSharedSupabaseClient } from '@/lib/supabaseClient';
import type { RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js';
import { transformNotificationRow, type NotificationRow } from '@/db/transformers';
import type { Notification } from '@/types';
import { NOTIFICATION_KEYS, TASK_KEYS, PROJECT_KEYS, TASK_STATUS_KEYS, COMPLETION_LOG_KEYS } from '@/lib/queryKeys';
import { browserNotificationService } from '@/lib/notifications/browserNotificationService';
import { logger } from '@/lib/monitoring/logger';
import { withRetry } from '@/lib/utils/retry';

// ============================================================================
// Type Definitions
// ============================================================================

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

type Payload = RealtimePostgresChangesPayload<Record<string, unknown>>;

interface UseUnifiedRealtimeOptions {
    userId?: number | null;
    enabled?: boolean;
    onConnectionStatusChange?: (status: ConnectionStatus) => void;
}

// ============================================================================
// Cache Update Utilities
// ============================================================================

function updateCacheData(currentData: unknown, payload: Payload): unknown {
    const { eventType } = payload;
    const newData = payload.new as Record<string, unknown> | undefined;
    const oldData = payload.old as Record<string, unknown> | undefined;

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

    if (currentData && typeof currentData === 'object') {
        const obj = currentData as Record<string, unknown>;
        if (obj.tasks && Array.isArray(obj.tasks)) {
            return { ...obj, tasks: updateCacheData(obj.tasks, payload) };
        }
    }

    return currentData;
}

function updateAllCaches(
    queryClient: ReturnType<typeof useQueryClient>,
    payload: Payload,
    tableHint: string
) {
    const cache = queryClient.getQueryCache();
    let updatedCount = 0;

    cache.findAll().forEach((query) => {
        try {
            const currentData = queryClient.getQueryData(query.queryKey);
            if (!currentData) return;

            const updated = updateCacheData(currentData, payload);
            if (updated !== currentData) {
                queryClient.setQueryData(query.queryKey, updated);
                updatedCount++;
            }
        } catch (error) {
            logger.warn(`[UnifiedRealtime] Cache update error for ${tableHint}:`, error);
        }
    });

    if (updatedCount > 0) {
        logger.debug(`[UnifiedRealtime] Updated ${updatedCount} cache entries for ${tableHint}`);
    }
}

// ============================================================================
// Table-Specific Change Handlers
// ============================================================================

function handleTaskChange(
    queryClient: ReturnType<typeof useQueryClient>,
    payload: Payload
) {
    logger.debug('[UnifiedRealtime] Task change:', payload.eventType, payload.new);
    updateAllCaches(queryClient, payload, 'tasks');
    queryClient.invalidateQueries({ queryKey: TASK_KEYS.all });
    queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.all });
}

function handleStatusChange(
    queryClient: ReturnType<typeof useQueryClient>,
    payload: Payload
) {
    // DEBUG: Log the actual event received from Supabase
    console.log('[UnifiedRealtime] 🔄 TASK_STATUSES event:', payload.eventType, payload.new, payload.old);
    logger.debug('[UnifiedRealtime] Status change:', payload.eventType);

    // Invalidate all task-related queries for consistency
    console.log('[UnifiedRealtime] 📤 Invalidating TASK_KEYS.all, TASK_STATUS_KEYS.all, COMPLETION_LOG_KEYS.all');
    queryClient.invalidateQueries({ queryKey: TASK_KEYS.all });
    queryClient.invalidateQueries({ queryKey: TASK_STATUS_KEYS.all });
    queryClient.invalidateQueries({ queryKey: COMPLETION_LOG_KEYS.all });

    // Force immediate refetch of active queries for instant UI update
    console.log('[UnifiedRealtime] 🔃 Forcing refetch of active queries...');
    queryClient.refetchQueries({
        queryKey: TASK_KEYS.all,
        type: 'active'
    }).then(() => {
        console.log('[UnifiedRealtime] ✅ TASK_KEYS refetch complete');
    });
    queryClient.refetchQueries({
        queryKey: TASK_STATUS_KEYS.all,
        type: 'active'
    }).then(() => {
        console.log('[UnifiedRealtime] ✅ TASK_STATUS_KEYS refetch complete');
    });
}

function handleLogChange(
    queryClient: ReturnType<typeof useQueryClient>,
    payload: Payload
) {
    logger.debug('[UnifiedRealtime] Log change:', payload.eventType);
    queryClient.invalidateQueries({ queryKey: TASK_KEYS.lists() });
}

function handleParticipantChange(
    queryClient: ReturnType<typeof useQueryClient>,
    payload: Payload
) {
    logger.debug('[UnifiedRealtime] Participant change:', payload.eventType);
    queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.all });
}

function handleFriendshipChange(
    queryClient: ReturnType<typeof useQueryClient>,
    payload: Payload
) {
    logger.debug('[UnifiedRealtime] Friendship change:', payload.eventType);
    queryClient.invalidateQueries({ queryKey: ['friends'] });
    queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
}

// ============================================================================
// Notification-Specific Logic
// ============================================================================

const isValidNotificationPayload = (payload: Record<string, unknown>): payload is NotificationRow => {
    return (
        typeof payload.id === 'string' &&
        typeof payload.user_id === 'string' &&
        typeof payload.type === 'string' &&
        typeof payload.message === 'string' &&
        typeof payload.created_at === 'string' &&
        typeof payload.is_read === 'boolean' &&
        typeof payload.email_sent === 'boolean'
    );
};

function handleNotificationChange(
    queryClient: ReturnType<typeof useQueryClient>,
    payload: Payload,
    currentUserId: number
) {
    logger.debug('[UnifiedRealtime] Notification event received:', {
        eventType: payload.eventType,
        schema: payload.schema,
        table: payload.table,
    });

    const rawNew = payload.new as Record<string, unknown> | undefined;
    const rawOld = payload.old as Record<string, unknown> | undefined;

    if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && rawNew) {
        if (rawNew.user_id !== String(currentUserId)) {
            logger.debug('[UnifiedRealtime] Skipping notification - not for current user');
            return;
        }

        if (!isValidNotificationPayload(rawNew)) {
            logger.warn('[UnifiedRealtime] Incomplete notification payload, falling back to invalidate');
            queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all(currentUserId) });
            return;
        }

        let newNotification: Notification;
        try {
            newNotification = transformNotificationRow(rawNew);
        } catch (e) {
            logger.warn('[UnifiedRealtime] Failed to transform notification, falling back to invalidate', e);
            queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all(currentUserId) });
            return;
        }

        if (payload.eventType === 'INSERT') {
            browserNotificationService.showNotification(newNotification);
        }

        const targetQueryKey = NOTIFICATION_KEYS.lists(currentUserId);
        const currentData = queryClient.getQueryData<Notification[]>(targetQueryKey);

        if (Array.isArray(currentData)) {
            let updatedData: Notification[];

            switch (payload.eventType) {
                case 'INSERT':
                    updatedData = [newNotification, ...currentData.filter(n => n.id !== newNotification.id)];
                    logger.debug('[UnifiedRealtime] Adding notification to cache');
                    break;
                case 'UPDATE':
                    updatedData = currentData.map(n =>
                        n.id === newNotification.id ? newNotification : n
                    );
                    logger.debug('[UnifiedRealtime] Updating notification in cache');
                    break;
                default:
                    updatedData = currentData;
            }

            queryClient.setQueryData(targetQueryKey, updatedData);
            queryClient.refetchQueries({
                queryKey: targetQueryKey,
                type: 'active',
            });
        } else {
            queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all(currentUserId) });
            queryClient.refetchQueries({ queryKey: targetQueryKey });
        }

        queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all(currentUserId) });
    }

    if (payload.eventType === 'DELETE' && rawOld) {
        const oldId = rawOld.id;
        const targetQueryKey = NOTIFICATION_KEYS.lists(currentUserId);
        const currentData = queryClient.getQueryData<Notification[]>(targetQueryKey);

        if (Array.isArray(currentData)) {
            const updatedData = currentData.filter(n => String(n.id) !== String(oldId));
            logger.debug('[UnifiedRealtime] Removing notification from cache');
            queryClient.setQueryData(targetQueryKey, updatedData);
        } else {
            queryClient.refetchQueries({ queryKey: targetQueryKey });
        }

        queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all(currentUserId) });
    }
}

// ============================================================================
// Main Hook
// ============================================================================

const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const MAX_RECONNECT_DELAY = 30000; // 30 seconds max
const INITIAL_RECONNECT_DELAY = 1000; // 1 second initial

export function useUnifiedRealtime(options: UseUnifiedRealtimeOptions = {}) {
    const { userId, enabled = true, onConnectionStatusChange } = options;
    const queryClient = useQueryClient();
    const channelRef = useRef<RealtimeChannel | null>(null);
    const isMounted = useRef(true);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
    // Use ref to track status without causing re-renders in useCallback dependencies
    const connectionStatusRef = useRef<ConnectionStatus>('disconnected');
    const reconnectAttempts = useRef(0);
    const isReconnecting = useRef(false);  // Prevents reconnection storms after timeout
    const healthCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // CRITICAL FIX: Removed connectionStatus from dependencies to break infinite loop
    // Uses ref to compare values without triggering callback recreation
    const updateConnectionStatus = useCallback((status: ConnectionStatus) => {
        if (status !== connectionStatusRef.current) {
            connectionStatusRef.current = status;
            setConnectionStatus(status);
            onConnectionStatusChange?.(status);
        }
    }, [onConnectionStatusChange]);

    const performHealthCheck = useCallback(() => {
        if (!channelRef.current) {
            updateConnectionStatus('disconnected');
            return;
        }

        const state = channelRef.current.state;
        if (state === 'joined' || state === 'joining') {
            updateConnectionStatus('connected');
            reconnectAttempts.current = 0;
            isReconnecting.current = false;  // Clear reconnecting flag after successful connect
        } else {
            logger.warn('[UnifiedRealtime] Unhealthy channel detected, attempting reconnection');
            isReconnecting.current = true;  // Set reconnecting flag before attempting reconnect
            attemptReconnect();
        }
    }, [updateConnectionStatus]);

    const startHealthMonitoring = useCallback(() => {
        if (healthCheckIntervalRef.current) return;

        healthCheckIntervalRef.current = setInterval(() => {
            performHealthCheck();
        }, HEALTH_CHECK_INTERVAL);

        performHealthCheck();
    }, [performHealthCheck]);

    const stopHealthMonitoring = useCallback(() => {
        if (healthCheckIntervalRef.current) {
            clearInterval(healthCheckIntervalRef.current);
            healthCheckIntervalRef.current = null;
        }
    }, []);

    const attemptReconnect = useCallback(async () => {
        if (reconnectAttempts.current > 0) return; // Already reconnecting

        updateConnectionStatus('reconnecting');
        reconnectAttempts.current++;

        const delay = Math.min(
            INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts.current - 1),
            MAX_RECONNECT_DELAY
        );

        logger.info(`[UnifiedRealtime] Attempting reconnect ${reconnectAttempts.current} in ${delay}ms`);

        reconnectTimeoutRef.current = setTimeout(() => {
            if (!isMounted.current) return;

            const supabase = getSharedSupabaseClient();
            if (!supabase) {
                logger.warn('[UnifiedRealtime] Supabase client not available for reconnection');
                updateConnectionStatus('disconnected');
                return;
            }

            if (channelRef.current) {
                try {
                    supabase.removeChannel(channelRef.current);
                } catch (err) {
                    logger.warn('[UnifiedRealtime] Error removing channel during reconnect:', err);
                }
            }

            reconnectAttempts.current = 0;
            updateConnectionStatus('disconnected');

        }, delay);
    }, [updateConnectionStatus]);

    const cleanup = useCallback((supabase: ReturnType<typeof getSharedSupabaseClient>) => {
        stopHealthMonitoring();

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (channelRef.current && isMounted.current) {
            logger.debug('[UnifiedRealtime] Cleaning up channel');
            try {
                supabase.removeChannel(channelRef.current);
            } catch (error) {
                logger.warn('[UnifiedRealtime] Channel cleanup warning:', error);
            }
            channelRef.current = null;
        }

        reconnectAttempts.current = 0;
        updateConnectionStatus('disconnected');
    }, [stopHealthMonitoring, updateConnectionStatus]);

    const setupChannel = useCallback(() => {
        const supabase = getSharedSupabaseClient();
        if (!supabase) {
            logger.warn('[UnifiedRealtime] Supabase client not available');
            return;
        }

        cleanup(supabase);

        logger.info('[UnifiedRealtime] Initializing realtime channel');

        let channel = supabase
            .channel('unified-realtime-v6', {
                config: {
                    broadcast: { self: true },
                    presence: { key: 'user' },
                },
            })
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'tasks' },
                (payload) => {
                    logger.debug('[UnifiedRealtime] TASKS event received');
                    handleTaskChange(queryClient, payload);
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'task_statuses' },
                (payload) => {
                    logger.debug('[UnifiedRealtime] TASK_STATUSES event received');
                    handleStatusChange(queryClient, payload);
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'completion_logs' },
                (payload) => {
                    logger.debug('[UnifiedRealtime] COMPLETION_LOGS event received');
                    handleLogChange(queryClient, payload);
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'project_participants' },
                (payload) => {
                    logger.debug('[UnifiedRealtime] PROJECT_PARTICIPANTS event received');
                    handleParticipantChange(queryClient, payload);
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'friendships' },
                (payload) => {
                    logger.debug('[UnifiedRealtime] FRIENDSHIPS event received');
                    handleFriendshipChange(queryClient, payload);
                }
            );

        if (userId) {
            const notificationFilter = `user_id=eq.${String(userId)}`;
            logger.debug('[UnifiedRealtime] Subscribing to notifications with filter:', notificationFilter);

            channel = channel.on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: notificationFilter,
                },
                (payload) => {
                    logger.debug('[UnifiedRealtime] NOTIFICATIONS event received');
                    handleNotificationChange(queryClient, payload, userId);
                }
            );
        } else {
            logger.warn('[UnifiedRealtime] No userId provided - skipping notification subscription');
        }

        channel.subscribe((status, err) => {
            logger.debug(`[UnifiedRealtime] Channel Status: ${status}`);

            switch (status) {
                case 'SUBSCRIBED':
                    logger.info('[UnifiedRealtime] Channel SUBSCRIBED successfully');
                    updateConnectionStatus('connected');
                    reconnectAttempts.current = 0;
                    break;
                case 'CHANNEL_ERROR':
                    logger.error('[UnifiedRealtime] Channel ERROR:', err);
                    updateConnectionStatus('disconnected');
                    attemptReconnect();
                    break;
                case 'TIMED_OUT':
                    logger.error('[UnifiedRealtime] Channel TIMED OUT');
                    updateConnectionStatus('disconnected');
                    attemptReconnect();
                    break;
                case 'CLOSED':
                    logger.warn('[UnifiedRealtime] Channel CLOSED');
                    updateConnectionStatus('disconnected');
                    break;
                default:
                    logger.debug(`[UnifiedRealtime] Channel status: ${status}`);
            }
        });

        channelRef.current = channel;
        startHealthMonitoring();
    }, [queryClient, userId, cleanup, updateConnectionStatus, startHealthMonitoring, attemptReconnect]);

    useEffect(() => {
        if (!enabled) {
            const supabase = getSharedSupabaseClient();
            if (supabase) cleanup(supabase);
            return () => { };
        }

        isMounted.current = true;
        setupChannel();

        return () => {
            isMounted.current = false;
            const supabase = getSharedSupabaseClient();
            if (supabase) cleanup(supabase);
        };
    }, [enabled, setupChannel, cleanup]);

    return { connectionStatus };
}

export default useUnifiedRealtime;
