// ============================================================================
// useTaskStatusRealtime Hook - Real-time Task Status Updates (Supabase)
// ============================================================================
// Subscribes to Postgres changes on `task_statuses` and invalidates task queries
// so all task views (Today, Project, etc.) reflect multi-user status updates fast.
// ============================================================================

import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSharedSupabaseClientOrUndefined } from '@/lib/supabaseClient';

interface UseTaskStatusRealtimeParams {
  enabled?: boolean;
  /**
   * Subscribe narrowly to these task IDs when provided (recommended).
   * If omitted/empty, we fall back to subscribing by `userId` (less useful for multi-user).
   */
  taskIds?: Array<string | number>;
  /**
   * Optional fallback subscription filter.
   * Note: subscribing by userId only captures *your* status changes, not other users.
   */
  userId?: number | null;
  /**
   * Optional extra query keys to invalidate (beyond the default task + taskStatuses keys).
   */
  extraInvalidateQueryKeys?: unknown[][];
}

export const useTaskStatusRealtime = ({
  enabled = true,
  taskIds,
  userId,
  extraInvalidateQueryKeys = [],
}: UseTaskStatusRealtimeParams) => {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const normalizedTaskIds = useMemo(() => {
    const ids = (taskIds || [])
      .map((id) => (typeof id === 'string' ? parseInt(id) : id))
      .filter((id): id is number => Number.isFinite(id));
    // de-dupe for stable filter strings
    return Array.from(new Set(ids));
  }, [taskIds]);

  useEffect(() => {
    if (!enabled) return;

    const supabase = getSharedSupabaseClientOrUndefined();
    if (!supabase) {
      console.warn('Supabase not configured, real-time task status updates disabled');
      return;
    }

    // Clean up existing subscription if any
    const existingChannel = channelRef.current;
    if (existingChannel) {
      try {
        supabase.removeChannel(existingChannel);
      } catch (err) {
        // Ignore cleanup errors - channel might already be removed
      }
      channelRef.current = null;
    }

    // Prefer task_id IN filter (captures OTHER users completing tasks you can see)
    const hasTaskFilter = normalizedTaskIds.length > 0 && normalizedTaskIds.length <= 100;
    const filter = hasTaskFilter
      ? `task_id=in.(${normalizedTaskIds.join(',')})`
      : userId
        ? `user_id=eq.${userId}`
        : undefined;

    if (!filter) return;

    // Use unique channel name to avoid conflicts
    const baseChannelName = hasTaskFilter 
      ? `task_statuses:tasks:${normalizedTaskIds.join(',')}` 
      : `task_statuses:user:${userId}`;
    const channelName = `${baseChannelName}:${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_statuses',
          filter,
        },
        () => {
          try {
            // Immediately refetch active queries for instant UI updates
            // `tasks` queries include embedded statuses, so refetching tasks is essential.
            Promise.all([
              queryClient.refetchQueries({ queryKey: ['tasks'] }),
              queryClient.refetchQueries({ queryKey: ['taskStatuses'] }),
              queryClient.refetchQueries({ queryKey: ['completionLogs'] }),
              ...extraInvalidateQueryKeys.map((key) => queryClient.refetchQueries({ queryKey: key })),
            ]).catch((err) => {
              // If refetch fails, fall back to invalidation
              console.warn('Real-time refetch failed, falling back to invalidation:', err);
              queryClient.invalidateQueries({ queryKey: ['tasks'] });
              queryClient.invalidateQueries({ queryKey: ['taskStatuses'] });
              queryClient.invalidateQueries({ queryKey: ['completionLogs'] });
              extraInvalidateQueryKeys.forEach((key) => {
                queryClient.invalidateQueries({ queryKey: key });
              });
            });
          } catch (err) {
            console.error('Error processing task status update:', err);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Task status realtime subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          // Only log error, don't attempt cleanup here as it may cause issues
          if (err) {
            console.error('Task status realtime subscription error:', err);
          }
        } else if (status === 'TIMED_OUT') {
          console.warn('Task status realtime subscription timed out');
        } else if (status === 'CLOSED') {
          console.log('Task status realtime subscription closed');
        }
      });

    channelRef.current = channel;

    return () => {
      const channelToRemove = channelRef.current;
      if (channelToRemove) {
        try {
          supabase.removeChannel(channelToRemove);
        } catch (err) {
          // Ignore cleanup errors
        }
        channelRef.current = null;
      }
    };
  }, [enabled, normalizedTaskIds, userId, extraInvalidateQueryKeys, queryClient]);
};


