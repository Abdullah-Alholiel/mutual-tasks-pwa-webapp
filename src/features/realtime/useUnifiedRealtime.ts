// ============================================================================
// useUnifiedRealtime - SINGLE Unified Channel for ALL Realtime Updates
// ============================================================================
// This hook consolidates ALL realtime subscriptions (tasks, notifications, etc.)
// into a SINGLE Supabase channel. This prevents connection conflicts and ensures
// reliable, instant updates across the application.
//
// IMPORTANT: Pass the current user's ID to enable user-specific notification
// filtering. Without it, notification subscriptions will be skipped.
//
// Architecture:
// - Single WebSocket channel for all real-time events
// - Centralized query key management for consistent cache invalidation
// - Proactive browser notification permission handling
// - Proper cleanup to prevent memory leaks and duplicate connections
// ============================================================================

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSharedSupabaseClient } from '@/lib/supabaseClient';
import type { RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js';
import { transformNotificationRow, type NotificationRow } from '@/db/transformers';
import type { Notification } from '@/types';
import { NOTIFICATION_KEYS, TASK_KEYS, PROJECT_KEYS } from '@/lib/queryKeys';
import { browserNotificationService } from '@/lib/notifications/browserNotificationService';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Type alias for Supabase realtime payload
 * Represents database change events from postgres_changes channel
 */
type Payload = RealtimePostgresChangesPayload<Record<string, unknown>>;

/**
 * Configuration options for the unified realtime hook
 */
interface UseUnifiedRealtimeOptions {
    /**
     * The current user's ID. Required for user-specific notification filtering.
     * If not provided, notification subscriptions will be skipped.
     */
    userId?: number | null;
}

// ============================================================================
// Cache Update Utilities
// ============================================================================

/**
 * Updates cached data based on the realtime event type
 * Handles INSERT, UPDATE, and DELETE operations for arrays and nested objects
 *
 * @param currentData - The current cached data to update
 * @param payload - The realtime event payload containing eventType, new, and old data
 * @returns Updated data with the change applied, or original data if no change needed
 */
function updateCacheData(currentData: unknown, payload: Payload): unknown {
    const { eventType } = payload;
    const newData = payload.new as Record<string, unknown> | undefined;
    const oldData = payload.old as Record<string, unknown> | undefined;

    // Handle array data (most common case for list queries)
    if (Array.isArray(currentData)) {
        switch (eventType) {
            case 'INSERT':
                // Prepend new item to the beginning of the array (newest first)
                return newData ? [newData, ...currentData] : currentData;

            case 'UPDATE':
                // Replace the matching item with updated data
                return newData
                    ? currentData.map((item: unknown) =>
                        (item as Record<string, unknown>).id === newData.id
                            ? { ...(item as Record<string, unknown>), ...newData }
                            : item
                    )
                    : currentData;

            case 'DELETE':
                // Remove the deleted item from the array
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

    // Handle nested object data (e.g., queries that return { tasks: [...] })
    if (currentData && typeof currentData === 'object') {
        const obj = currentData as Record<string, unknown>;
        if (obj.tasks && Array.isArray(obj.tasks)) {
            return { ...obj, tasks: updateCacheData(obj.tasks, payload) };
        }
    }

    return currentData;
}

/**
 * Updates all matching React Query caches with new data from a realtime event
 * This provides instant UI updates without requiring a server round-trip
 *
 * @param queryClient - The React Query client instance
 * @param payload - The realtime event payload
 * @param tableHint - Identifier for logging purposes (e.g., 'tasks', 'notifications')
 */
function updateAllCaches(
    queryClient: ReturnType<typeof useQueryClient>,
    payload: Payload,
    tableHint: string
) {
    const cache = queryClient.getQueryCache();
    let updatedCount = 0;

    // Find all queries and update matching caches
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
            console.warn(`[UnifiedRealtime] Cache update error for ${tableHint}:`, error);
        }
    });

    // Log successful cache updates for debugging
    if (updatedCount > 0) {
        console.log(`[UnifiedRealtime] ✅ Updated ${updatedCount} cache entries for ${tableHint}`);
    }
}

// ============================================================================
// Table-Specific Change Handlers
// ============================================================================

/**
 * Handles realtime events for the tasks table
 * Updates task caches and invalidates related project data
 *
 * @param queryClient - The React Query client instance
 * @param payload - The realtime event payload
 */
function handleTaskChange(
    queryClient: ReturnType<typeof useQueryClient>,
    payload: Payload
) {
    console.log('[UnifiedRealtime] 📋 Task change:', payload.eventType, payload.new);

    // Update all matching caches immediately
    updateAllCaches(queryClient, payload, 'tasks');

    // Invalidate to trigger background refetch for consistency
    queryClient.invalidateQueries({ queryKey: TASK_KEYS.all });
    queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.all });
}

/**
 * Handles realtime events for the task_statuses table
 * Invalidates task-related caches when status changes
 *
 * @param queryClient - The React Query client instance
 * @param payload - The realtime event payload
 */
function handleStatusChange(
    queryClient: ReturnType<typeof useQueryClient>,
    payload: Payload
) {
    console.log('[UnifiedRealtime] 📊 Status change:', payload.eventType);
    queryClient.invalidateQueries({ queryKey: TASK_KEYS.all });
}

/**
 * Handles realtime events for the completion_logs table
 * Invalidates task-related caches when logs are added/modified
 *
 * @param queryClient - The React Query client instance
 * @param payload - The realtime event payload
 */
function handleLogChange(
    queryClient: ReturnType<typeof useQueryClient>,
    payload: Payload
) {
    console.log('[UnifiedRealtime] 📝 Log change:', payload.eventType);
    queryClient.invalidateQueries({ queryKey: TASK_KEYS.lists() });
}

/**
 * Handles realtime events for the project_participants table
 * Invalidates project-related caches when membership changes
 *
 * @param queryClient - The React Query client instance
 * @param payload - The realtime event payload
 */
function handleParticipantChange(
    queryClient: ReturnType<typeof useQueryClient>,
    payload: Payload
) {
    console.log('[UnifiedRealtime] 👥 Participant change:', payload.eventType);
    queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.all });
}

// ============================================================================
// Notification-Specific Logic
// ============================================================================

/**
 * Type guard to validate notification payload structure
 * Ensures the payload contains all required fields before processing
 *
 * This prevents runtime errors from malformed payloads and ensures
 * type safety at runtime by validating against the NotificationRow type
 *
 * @param payload - The raw payload object from Supabase realtime event
 * @returns True if payload is a valid NotificationRow, false otherwise
 */
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

/**
 * Handles realtime events for the notifications table
 * Provides instant UI updates with proper cache invalidation
 *
 * Process flow:
 * 1. Validate the notification belongs to current user
 * 2. Validate payload structure with type guard
 * 3. Transform raw DB row to Notification type
 * 4. Show browser notification for INSERT events
 * 5. Update all notification caches immediately
 * 6. Invalidate queries for background consistency
 *
 * @param queryClient - The React Query client instance
 * @param payload - The realtime event payload
 * @param currentUserId - The current user's ID for filtering
 */
function handleNotificationChange(
    queryClient: ReturnType<typeof useQueryClient>,
    payload: Payload,
    currentUserId: number
) {
    console.log('[UnifiedRealtime] 🔔 Notification event received:', {
        eventType: payload.eventType,
        rawPayload: payload.new || payload.old,
        schema: payload.schema,
        table: payload.table,
        commit_timestamp: payload.commit_timestamp,
    });

    const rawNew = payload.new as Record<string, unknown> | undefined;
    const rawOld = payload.old as Record<string, unknown> | undefined;

    // =========================================================================
    // Handle INSERT and UPDATE events
    // =========================================================================
    if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && rawNew) {
        // Security: Ensure notification belongs to current user (defense in depth)
        // Supabase RLS should already filter, but we validate at application level too
        if (rawNew.user_id !== String(currentUserId)) {
            console.log('[UnifiedRealtime] ⏭️ Skipping notification - not for current user:', {
                payloadUserId: rawNew.user_id,
                currentUserId,
            });
            return;
        }

        // Validate payload structure before processing
        if (!isValidNotificationPayload(rawNew)) {
            console.warn('[UnifiedRealtime] ⚠️ Incomplete notification payload, falling back to invalidate:', rawNew);
            queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all(currentUserId) });
            return;
        }

        // Transform raw DB row to Notification type
        let newNotification: Notification;
        try {
            newNotification = transformNotificationRow(rawNew);
            console.log('[UnifiedRealtime] ✅ Transformed notification:', newNotification);
        } catch (e) {
            console.warn('[UnifiedRealtime] ⚠️ Failed to transform notification, falling back to invalidate:', e);
            queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all(currentUserId) });
            return;
        }

        // Show browser notification for new items (INSERT only)
        if (payload.eventType === 'INSERT') {
            browserNotificationService.showNotification(newNotification);
        }

        // =========================================================================
        // Instant Cache Update - No server round-trip!
        // =========================================================================
        // Use DIRECT query key access instead of unreliable findAll() predicate
        // This ensures we update the exact query used by useNotifications hook
        // =========================================================================
        const targetQueryKey = NOTIFICATION_KEYS.lists(currentUserId);
        console.log('[UnifiedRealtime] 🎯 Targeting query key:', targetQueryKey);

        const currentData = queryClient.getQueryData<Notification[]>(targetQueryKey);
        console.log('[UnifiedRealtime] 📊 Current cached data:', {
            exists: !!currentData,
            isArray: Array.isArray(currentData),
            length: Array.isArray(currentData) ? currentData.length : 'N/A',
        });

        if (Array.isArray(currentData)) {
            let updatedData: Notification[];

            switch (payload.eventType) {
                case 'INSERT':
                    // Add to the beginning of the list (newest first), avoiding duplicates
                    updatedData = [newNotification, ...currentData.filter(n => n.id !== newNotification.id)];
                    console.log('[UnifiedRealtime] ⚡ INSTANT: Adding notification to cache');
                    break;

                case 'UPDATE':
                    // Update existing notification in the list
                    updatedData = currentData.map(n =>
                        n.id === newNotification.id ? newNotification : n
                    );
                    console.log('[UnifiedRealtime] ⚡ INSTANT: Updating notification in cache');
                    break;

                default:
                    updatedData = currentData;
            }

            // Direct cache update triggers immediate UI re-render
            queryClient.setQueryData(targetQueryKey, updatedData);

            // Verify the update succeeded and log details
            const verifiedData = queryClient.getQueryData<Notification[]>(targetQueryKey);
            const newItem = verifiedData?.find(n => n.id === newNotification.id);
            console.log('[UnifiedRealtime] ✅ Cache updated successfully:', {
                queryKey: targetQueryKey,
                previousLength: currentData.length,
                newLength: verifiedData?.length,
                includesNewItem: !!newItem,
                newNotificationId: newNotification.id,
                newNotificationIsRead: newItem?.isRead,
            });

            // Force a refetch to guarantee UI update (workaround for setQueryData not triggering re-render)
            queryClient.refetchQueries({
                queryKey: targetQueryKey,
                type: 'active', // Only refetch if query is currently being observed
            });
        } else {
            // Cache miss - query might not be registered yet or not an array
            console.log('[UnifiedRealtime] ⚠️ Cache miss - triggering refetch:', {
                queryKey: targetQueryKey,
                currentDataType: typeof currentData,
                isArray: Array.isArray(currentData),
            });

            // Fallback: Trigger immediate refetch instead of relying on invalidation
            queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all(currentUserId) });
            queryClient.refetchQueries({ queryKey: targetQueryKey });
        }

        // Background invalidation for any other notification queries (defense in depth)
        queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all(currentUserId) });
    }

    // =========================================================================
    // Handle DELETE events
    // =========================================================================
    if (payload.eventType === 'DELETE' && rawOld) {
        const oldId = rawOld.id;

        // Use direct query key access for DELETE as well
        const targetQueryKey = NOTIFICATION_KEYS.lists(currentUserId);
        console.log('[UnifiedRealtime] 🎯 DELETE: Targeting query key:', targetQueryKey);

        const currentData = queryClient.getQueryData<Notification[]>(targetQueryKey);

        if (Array.isArray(currentData)) {
            const updatedData = currentData.filter(n => String(n.id) !== String(oldId));
            console.log('[UnifiedRealtime] ⚡ INSTANT: Removing notification from cache:', {
                oldId,
                beforeCount: currentData.length,
                afterCount: updatedData.length,
            });
            queryClient.setQueryData(targetQueryKey, updatedData);
        } else {
            console.log('[UnifiedRealtime] ⚠️ DELETE: Cache miss - triggering refetch');
            queryClient.refetchQueries({ queryKey: targetQueryKey });
        }

        queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all(currentUserId) });
    }
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * useUnifiedRealtime - Unified Realtime Subscription Hook
 *
 * This hook creates a single Supabase WebSocket channel that listens to all
 * necessary tables for real-time updates. It provides instant UI updates
 * through direct cache manipulation and proper query invalidation.
 *
 * Features:
 * - Single channel prevents connection conflicts
 * - User-specific notification filtering for security
 * - Instant cache updates without server round-trips
 * - Proper cleanup prevents memory leaks
 * - Comprehensive logging for debugging
 *
 * @param options - Configuration options (userId required for notification filtering)
 * @example
 * ```tsx
 * const { user } = useAuth();
 * const userId = user?.id ? parseInt(user.id) : null;
 * useUnifiedRealtime({ userId });
 * ```
 */
export function useUnifiedRealtime(options: UseUnifiedRealtimeOptions = {}) {
    const { userId } = options;
    const queryClient = useQueryClient();
    const channelRef = useRef<RealtimeChannel | null>(null);
    const isMounted = useRef(true);

    /**
     * Cleanup function with lifecycle tracking
     * Prevents cleanup from running after component unmount
     * Also prevents duplicate cleanup calls
     *
     * @param supabase - The Supabase client instance for channel removal
     */
    const cleanup = useCallback((supabase: ReturnType<typeof getSharedSupabaseClient>) => {
        if (channelRef.current && isMounted.current) {
            console.log('[UnifiedRealtime] 🧹 Cleaning up channel...');
            try {
                supabase.removeChannel(channelRef.current);
            } catch (error) {
                console.warn('[UnifiedRealtime] ⚠️ Channel cleanup warning:', error);
            }
            channelRef.current = null;
        }
    }, []);

    useEffect(() => {
        isMounted.current = true;
        const supabase = getSharedSupabaseClient();

        // Exit early if Supabase is not available
        if (!supabase) {
            console.warn('[UnifiedRealtime] Supabase client not available');
            return () => { isMounted.current = false; };
        }

        // Clean up any existing channel before creating new one
        cleanup(supabase);

        console.log('[UnifiedRealtime] 🚀 Setting up unified realtime channel...', {
            userId: userId ?? 'NOT PROVIDED',
            hasUserId: !!userId,
        });

        // =========================================================================
        // Channel Setup
        // =========================================================================
        // Create a single channel that listens to multiple tables
        // Using broadcast and presence for future real-time features
        // =========================================================================
        let channel = supabase
            .channel('unified-realtime-v5', {
                config: {
                    broadcast: { self: true },
                    presence: { key: 'user' },
                },
            })
            // Subscribe to task changes (all tasks, filtered by project membership on server)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'tasks' },
                (payload) => {
                    console.log('[UnifiedRealtime] 📋 TASKS event received');
                    handleTaskChange(queryClient, payload);
                }
            )
            // Subscribe to task status changes
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'task_statuses' },
                (payload) => {
                    console.log('[UnifiedRealtime] 📊 TASK_STATUSES event received');
                    handleStatusChange(queryClient, payload);
                }
            )
            // Subscribe to completion log changes
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'completion_logs' },
                (payload) => {
                    console.log('[UnifiedRealtime] 📝 COMPLETION_LOGS event received');
                    handleLogChange(queryClient, payload);
                }
            )
            // Subscribe to project participant changes
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'project_participants' },
                (payload) => {
                    console.log('[UnifiedRealtime] 👥 PROJECT_PARTICIPANTS event received');
                    handleParticipantChange(queryClient, payload);
                }
            );

        // =========================================================================
        // Notification Subscription (User-Specific)
        // =========================================================================
        // Subscribe to notifications filtered by user_id
        // This ensures users only receive their own notifications
        // =========================================================================
        if (userId) {
            // CRITICAL: Ensure string-to-string comparison in Supabase filter
            // Database stores user_id as string (e.g., "1"), so filter must also be string
            const notificationFilter = `user_id=eq.${String(userId)}`;
            console.log('[UnifiedRealtime] 🔔 Subscribing to notifications with filter:', notificationFilter);
            console.log('[UnifiedRealtime] 🔔 userId type:', typeof userId, '| value:', userId);

            channel = channel.on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: notificationFilter,
                },
                (payload) => {
                    // Log RAW event BEFORE any validation - critical for debugging
                    console.log('[UnifiedRealtime] 📡 RAW notification event:', {
                        eventType: payload.eventType,
                        new: payload.new,
                        old: payload.old,
                        table: payload.table,
                        schema: payload.schema,
                        commit_timestamp: payload.commit_timestamp,
                    });

                    handleNotificationChange(queryClient, payload, userId);
                }
            );
        } else {
            console.warn('[UnifiedRealtime] ⚠️ No userId provided - skipping notification subscription!');
            console.warn('[UnifiedRealtime] ⚠️ To receive notifications, pass userId to useUnifiedRealtime({ userId })');
        }

        // =========================================================================
        // Channel Subscription Status Handling
        // =========================================================================
        // Log subscription status for debugging connection issues
        // Handle reconnection scenarios gracefully
        // =========================================================================
        channel.subscribe((status, err) => {
            const timestamp = new Date().toISOString();
            console.log(`[UnifiedRealtime] [${timestamp}] 📡 Channel Status:`, status);

            switch (status) {
                case 'SUBSCRIBED':
                    console.log('[UnifiedRealtime] ✅ Channel SUBSCRIBED successfully!');
                    console.log('[UnifiedRealtime] ✅ Listening for: tasks, task_statuses, completion_logs, project_participants' + (userId ? ', notifications' : ''));
                    break;
                case 'CHANNEL_ERROR':
                    console.error('[UnifiedRealtime] ❌ Channel ERROR:', err);
                    break;
                case 'TIMED_OUT':
                    console.error('[UnifiedRealtime] ⏰ Channel TIMED OUT - will retry');
                    break;
                case 'CLOSED':
                    console.warn('[UnifiedRealtime] 🔒 Channel CLOSED');
                    break;
                default:
                    console.log('[UnifiedRealtime] 📡 Channel status:', status);
            }
        });

        channelRef.current = channel;

        // =========================================================================
        // Cleanup on Unmount
        // =========================================================================
        // Proper cleanup prevents memory leaks and duplicate connections
        // Set isMounted.current = false AFTER cleanup to prevent race conditions
        // =========================================================================
        return () => {
            cleanup(supabase);
            isMounted.current = false;
        };
    }, [queryClient, userId, cleanup]);
}

export default useUnifiedRealtime;
