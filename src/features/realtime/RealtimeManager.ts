// ============================================================================
// RealtimeManager - Singleton for All Supabase Realtime Subscriptions
// ============================================================================
// Provides a centralized, singleton-based subscription manager that ensures
// only ONE channel per subscription type exists, preventing redundant
// subscriptions when navigating between tabs.
// ============================================================================

import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { getSharedSupabaseClientOrUndefined } from '@/lib/supabaseClient';

// Subscription types supported by the manager
export type SubscriptionType =
    | 'projects'
    | 'tasks'
    | 'task-inserts' // Watches tasks table for INSERT/UPDATE/DELETE (not just statuses)
    | 'notifications'
    | 'friend-requests'
    | `project-detail:${string}`;

// Connection status
export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

// Callback type for subscription updates
export type SubscriptionCallback = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;

// Callback for connection status changes
export type ConnectionStatusCallback = (status: ConnectionStatus) => void;

// Internal channel tracking
interface ChannelEntry {
    channel: RealtimeChannel;
    callbacks: Set<SubscriptionCallback>;
    userId: number;
    options?: { taskIds?: number[]; projectId?: string | number };
}

/**
 * Singleton manager for all Supabase realtime subscriptions.
 * Ensures exactly one channel per subscription type exists.
 * Includes health monitoring and auto-reconnection.
 */
class RealtimeSubscriptionManager {
    private static instance: RealtimeSubscriptionManager | null = null;
    private channels: Map<SubscriptionType, ChannelEntry> = new Map();
    private isInitializing: Map<SubscriptionType, boolean> = new Map();

    // Health monitoring
    private connectionStatus: ConnectionStatus = 'disconnected';
    private statusCallbacks: Set<ConnectionStatusCallback> = new Set();
    private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
    private reconnectAttempts: number = 0;
    private readonly MAX_RECONNECT_DELAY = 30000; // 30 seconds max
    private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

    private constructor() { }

    static getInstance(): RealtimeSubscriptionManager {
        if (!RealtimeSubscriptionManager.instance) {
            RealtimeSubscriptionManager.instance = new RealtimeSubscriptionManager();
        }
        return RealtimeSubscriptionManager.instance;
    }

    /**
     * Subscribe to a realtime channel. Returns an unsubscribe function.
     * If a channel already exists for this type, the callback is added to existing channel.
     */
    subscribe(
        type: SubscriptionType,
        userId: number,
        callback: SubscriptionCallback,
        options?: {
            taskIds?: number[];
            projectId?: string | number;
        }
    ): () => void {
        const supabase = getSharedSupabaseClientOrUndefined();
        if (!supabase) {
            console.warn(`[RealtimeManager] Supabase not configured, skipping ${type} subscription`);
            return () => { };
        }

        const existingEntry = this.channels.get(type);

        // If channel exists and is for the same user, just add callback
        if (existingEntry && existingEntry.userId === userId) {
            existingEntry.callbacks.add(callback);
            return () => this.unsubscribe(type, callback);
        }

        // If channel exists but for different user, clean it up first
        if (existingEntry && existingEntry.userId !== userId) {
            this.removeChannel(type);
        }

        // Prevent duplicate initialization
        if (this.isInitializing.get(type)) {
            // Wait and retry - this shouldn't happen often
            setTimeout(() => {
                const entry = this.channels.get(type);
                if (entry) {
                    entry.callbacks.add(callback);
                }
            }, 100);
            return () => this.unsubscribe(type, callback);
        }

        this.isInitializing.set(type, true);

        // Create new channel
        const channel = this.createChannel(type, userId, options);
        const entry: ChannelEntry = {
            channel,
            callbacks: new Set([callback]),
            userId,
        };

        this.channels.set(type, entry);

        channel.subscribe((status, err) => {
            this.isInitializing.set(type, false);
            if (status === 'CHANNEL_ERROR' && err) {
                console.error(`[RealtimeManager] ${type} subscription error:`, err);
            }
        });

        return () => this.unsubscribe(type, callback);
    }

    /**
     * Unsubscribe a callback from a channel. 
     * Only removes the channel when no callbacks remain.
     */
    private unsubscribe(type: SubscriptionType, callback: SubscriptionCallback): void {
        const entry = this.channels.get(type);
        if (!entry) return;

        entry.callbacks.delete(callback);

        // Only remove channel when no callbacks remain
        if (entry.callbacks.size === 0) {
            this.removeChannel(type);
        }
    }

    /**
     * Remove a channel completely
     */
    private removeChannel(type: SubscriptionType): void {
        const entry = this.channels.get(type);
        if (!entry) return;

        const supabase = getSharedSupabaseClientOrUndefined();
        if (supabase) {
            try {
                supabase.removeChannel(entry.channel);
            } catch (err) {
                // Ignore cleanup errors
            }
        }

        this.channels.delete(type);
        this.isInitializing.delete(type);
    }

    /**
     * Create a channel with appropriate listeners based on type
     */
    private createChannel(
        type: SubscriptionType,
        userId: number,
        options?: {
            taskIds?: number[];
            projectId?: string | number;
        }
    ): RealtimeChannel {
        const supabase = getSharedSupabaseClientOrUndefined()!;

        // Use stable channel name (no Date.now())
        const channelName = `${type}:user:${userId}`;

        const notifyCallbacks = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            const entry = this.channels.get(type);
            if (entry) {
                entry.callbacks.forEach(cb => {
                    try {
                        cb(payload);
                    } catch (err) {
                        console.error(`[RealtimeManager] Callback error for ${type}:`, err);
                    }
                });
            }
        };

        switch (type) {
            case 'projects':
                return supabase
                    .channel(channelName)
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'public', table: 'project_participants', filter: `user_id=eq.${userId}` },
                        notifyCallbacks
                    );

            case 'tasks': {
                // Build filter based on taskIds or userId
                const hasTaskFilter = options?.taskIds && options.taskIds.length > 0 && options.taskIds.length <= 100;
                const filter = hasTaskFilter
                    ? `task_id=in.(${options!.taskIds!.join(',')})`
                    : `user_id=eq.${userId}`;

                return supabase
                    .channel(channelName)
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'public', table: 'task_statuses', filter },
                        notifyCallbacks
                    );
            }

            case 'task-inserts': {
                // Subscribe to tasks table for INSERT/UPDATE/DELETE
                // This catches new tasks created by other users
                // No filter - we get all tasks and filter in the callback based on project membership
                return supabase
                    .channel(channelName)
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'public', table: 'tasks' },
                        notifyCallbacks
                    );
            }

            case 'notifications':
                return supabase
                    .channel(channelName)
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
                        notifyCallbacks
                    );

            case 'friend-requests':
                // Subscribe to friendships table for both incoming and outgoing changes
                // We use a broad filter and filter in the callback for better coverage
                return supabase
                    .channel(channelName)
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'public', table: 'friendships', filter: `user_id=eq.${userId}` },
                        notifyCallbacks
                    )
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'public', table: 'friendships', filter: `friend_id=eq.${userId}` },
                        notifyCallbacks
                    );

            default:
                // Handle project-detail:${projectId} pattern
                if (type.startsWith('project-detail:')) {
                    const projectId = options?.projectId || type.split(':')[1];
                    return supabase
                        .channel(`project:${projectId}:${userId}`)
                        .on(
                            'postgres_changes',
                            { event: '*', schema: 'public', table: 'project_participants', filter: `project_id=eq.${projectId}` },
                            notifyCallbacks
                        )
                        .on(
                            'postgres_changes',
                            { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` },
                            notifyCallbacks
                        );
                }

                throw new Error(`[RealtimeManager] Unknown subscription type: ${type}`);
        }
    }

    /**
     * Get current active subscriptions (for debugging)
     */
    getActiveSubscriptions(): string[] {
        return Array.from(this.channels.keys());
    }

    /**
     * Remove all subscriptions (for cleanup/logout)
     */
    removeAll(): void {
        this.stopHealthMonitor();
        for (const type of this.channels.keys()) {
            this.removeChannel(type);
        }
        this.setConnectionStatus('disconnected');
    }

    // =========================================================================
    // Connection Status & Health Monitoring
    // =========================================================================

    /**
     * Get current connection status
     */
    getConnectionStatus(): ConnectionStatus {
        return this.connectionStatus;
    }

    /**
     * Register a callback for connection status changes
     */
    onConnectionChange(callback: ConnectionStatusCallback): () => void {
        this.statusCallbacks.add(callback);
        // Immediately call with current status
        callback(this.connectionStatus);
        return () => this.statusCallbacks.delete(callback);
    }

    /**
     * Start periodic health monitoring
     */
    startHealthMonitor(): void {
        if (this.healthCheckInterval) return; // Already running

        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, this.HEALTH_CHECK_INTERVAL);

        // Initial check
        this.performHealthCheck();
    }

    /**
     * Stop health monitoring
     */
    stopHealthMonitor(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }

    /**
     * Perform a health check on all active channels
     */
    private performHealthCheck(): void {
        const supabase = getSharedSupabaseClientOrUndefined();
        if (!supabase) {
            this.setConnectionStatus('disconnected');
            return;
        }

        // Check if we have any active channels
        if (this.channels.size === 0) {
            // No subscriptions, consider as "connected" (idle)
            this.setConnectionStatus('connected');
            return;
        }

        // Check channel statuses
        let hasHealthyChannel = false;
        for (const [type, entry] of this.channels) {
            const state = entry.channel.state;
            if (state === 'joined' || state === 'joining') {
                hasHealthyChannel = true;
                break;
            }
        }

        if (hasHealthyChannel) {
            this.setConnectionStatus('connected');
            this.reconnectAttempts = 0;
        } else {
            console.warn('[RealtimeManager] No healthy channels detected, attempting reconnection');
            this.attemptReconnect();
        }
    }

    /**
     * Attempt to reconnect all channels with exponential backoff
     */
    private async attemptReconnect(): Promise<void> {
        if (this.connectionStatus === 'reconnecting') return;

        this.setConnectionStatus('reconnecting');
        this.reconnectAttempts++;

        // Calculate delay with exponential backoff
        const delay = Math.min(
            1000 * Math.pow(2, this.reconnectAttempts - 1),
            this.MAX_RECONNECT_DELAY
        );

        await new Promise(resolve => setTimeout(resolve, delay));

        // Re-subscribe to all channels
        const channelsCopy = new Map(this.channels);
        for (const [type, entry] of channelsCopy) {
            // Remove old channel
            this.removeChannel(type);

            // Re-create with same callbacks
            const callbacks = Array.from(entry.callbacks);
            if (callbacks.length > 0) {
                // Subscribe with first callback
                this.subscribe(type, entry.userId, callbacks[0], entry.options);
                // Add remaining callbacks
                const newEntry = this.channels.get(type);
                if (newEntry) {
                    callbacks.slice(1).forEach(cb => newEntry.callbacks.add(cb));
                }
            }
        }
    }

    /**
     * Update connection status and notify callbacks
     */
    private setConnectionStatus(status: ConnectionStatus): void {
        if (this.connectionStatus === status) return;

        this.connectionStatus = status;

        this.statusCallbacks.forEach(cb => {
            try {
                cb(status);
            } catch (err) {
                console.error('[RealtimeManager] Status callback error:', err);
            }
        });
    }
}

// Export singleton instance getter
export const getRealtimeManager = () => RealtimeSubscriptionManager.getInstance();

export default RealtimeSubscriptionManager;
