// ============================================================================
// useProjectRealtime Hook - Real-Time Project Updates with Supabase
// ============================================================================
// Provides real-time project updates when members are added/removed
// ============================================================================

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSharedSupabaseClientOrUndefined } from '@/lib/supabaseClient';


interface UseProjectRealtimeParams {
  userId: number | null | undefined;
  enabled?: boolean;
}

/**
 * Hook for subscribing to real-time project updates
 * Automatically invalidates project queries when:
 * - User is added to a project
 * - User is removed from a project
 * - Project is updated
 */
export const useProjectRealtime = ({
  userId,
  enabled = true,
}: UseProjectRealtimeParams) => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const queryClient = useQueryClient();

  // Invalidate project-related queries
  const invalidateProjects = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['projects', 'public'] });
    queryClient.invalidateQueries({ queryKey: ['projects', 'with-stats'] });
  }, [queryClient]);

  useEffect(() => {
    if (!userId || !enabled) return;

    const supabase = getSharedSupabaseClientOrUndefined();
    if (!supabase) {
      console.warn('Supabase not configured, real-time project updates disabled');
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

    // Use unique channel name to avoid conflicts
    const channelName = `project_participants:${userId}:${Date.now()}`;
    // Subscribe to project_participants changes for this user
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'project_participants',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          try {
            // User was added to a project - refetch immediately for instant UI updates
            console.log('User added to project:', payload);
            const projectId = payload.new?.project_id;
            Promise.all([
              queryClient.refetchQueries({ queryKey: ['projects'] }),
              queryClient.refetchQueries({ queryKey: ['projects', 'public'] }),
              queryClient.refetchQueries({ queryKey: ['projects', 'with-stats'] }),
              ...(projectId ? [
                queryClient.refetchQueries({ queryKey: ['project', projectId] }),
                queryClient.refetchQueries({ queryKey: ['project', String(projectId)] }),
              ] : []),
            ]).catch((err) => {
              console.warn('Real-time refetch failed, falling back to invalidation:', err);
              invalidateProjects();
              if (projectId) {
                queryClient.invalidateQueries({ queryKey: ['project', projectId] });
                queryClient.invalidateQueries({ queryKey: ['project', String(projectId)] });
              }
            });
          } catch (err) {
            console.error('Error processing participant INSERT:', err);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'project_participants',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          try {
            // Participant info updated (e.g., role change) - refetch immediately
            console.log('Participant updated:', payload);
            const projectId = payload.new?.project_id;
            Promise.all([
              queryClient.refetchQueries({ queryKey: ['projects'] }),
              queryClient.refetchQueries({ queryKey: ['projects', 'public'] }),
              queryClient.refetchQueries({ queryKey: ['projects', 'with-stats'] }),
              ...(projectId ? [
                queryClient.refetchQueries({ queryKey: ['project', projectId] }),
                queryClient.refetchQueries({ queryKey: ['project', String(projectId)] }),
              ] : []),
            ]).catch((err) => {
              console.warn('Real-time refetch failed, falling back to invalidation:', err);
              invalidateProjects();
              if (projectId) {
                queryClient.invalidateQueries({ queryKey: ['project', projectId] });
                queryClient.invalidateQueries({ queryKey: ['project', String(projectId)] });
              }
            });
          } catch (err) {
            console.error('Error processing participant UPDATE:', err);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'project_participants',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          try {
            // User was removed from a project - refetch immediately
            console.log('User removed from project:', payload);
            const projectId = (payload.old as any)?.project_id;
            Promise.all([
              queryClient.refetchQueries({ queryKey: ['projects'] }),
              queryClient.refetchQueries({ queryKey: ['projects', 'public'] }),
              queryClient.refetchQueries({ queryKey: ['projects', 'with-stats'] }),
              ...(projectId ? [
                queryClient.refetchQueries({ queryKey: ['project', projectId] }),
                queryClient.refetchQueries({ queryKey: ['project', String(projectId)] }),
              ] : []),
            ]).catch((err) => {
              console.warn('Real-time refetch failed, falling back to invalidation:', err);
              invalidateProjects();
              if (projectId) {
                queryClient.invalidateQueries({ queryKey: ['project', projectId] });
                queryClient.invalidateQueries({ queryKey: ['project', String(projectId)] });
              }
            });
          } catch (err) {
            console.error('Error processing participant DELETE:', err);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Project realtime subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          // Only log error, don't attempt cleanup here as it may cause issues
          if (err) {
            console.error('Project realtime subscription error:', err);
          }
        } else if (status === 'TIMED_OUT') {
          console.warn('Project realtime subscription timed out');
        } else if (status === 'CLOSED') {
          console.log('Project realtime subscription closed');
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
  }, [userId, enabled, invalidateProjects, queryClient]);
};

/**
 * Hook for subscribing to a specific project's updates
 */
export const useProjectDetailRealtime = (projectId: string | number | undefined) => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!projectId) return;

    const supabase = getSharedSupabaseClientOrUndefined();
    if (!supabase) {
      return;
    }
    const projectIdStr = String(projectId);

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

    // Use unique channel name to avoid conflicts
    const channelName = `project:${projectIdStr}:${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_participants',
          filter: `project_id=eq.${projectIdStr}`,
        },
        (payload) => {
          try {
            // Project participants changed - refetch immediately
            console.log('Project participants changed:', payload);
            Promise.all([
              queryClient.refetchQueries({ queryKey: ['project', projectId] }),
              queryClient.refetchQueries({ queryKey: ['project', projectIdStr] }),
              queryClient.refetchQueries({ queryKey: ['projects'] }),
            ]).catch((err) => {
              console.warn('Real-time refetch failed, falling back to invalidation:', err);
              queryClient.invalidateQueries({ queryKey: ['project', projectId] });
              queryClient.invalidateQueries({ queryKey: ['project', projectIdStr] });
              queryClient.invalidateQueries({ queryKey: ['projects'] });
            });
          } catch (err) {
            console.error('Error processing project participant update:', err);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${projectIdStr}`,
        },
        (payload) => {
          try {
            // Tasks changed - refetch immediately
            console.log('Project tasks changed:', payload);
            Promise.all([
              queryClient.refetchQueries({ queryKey: ['tasks', 'project', Number(projectId)] }),
              queryClient.refetchQueries({ queryKey: ['project', projectId] }),
              queryClient.refetchQueries({ queryKey: ['taskStatuses'] }),
            ]).catch((err) => {
              console.warn('Real-time refetch failed, falling back to invalidation:', err);
              queryClient.invalidateQueries({ queryKey: ['tasks', 'project', Number(projectId)] });
              queryClient.invalidateQueries({ queryKey: ['project', projectId] });
              queryClient.invalidateQueries({ queryKey: ['taskStatuses'] });
            });
          } catch (err) {
            console.error('Error processing project task update:', err);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Project detail realtime subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          // Only log error, don't attempt cleanup here as it may cause issues
          if (err) {
            console.error('Project detail realtime subscription error:', err);
          }
        } else if (status === 'TIMED_OUT') {
          console.warn('Project detail realtime subscription timed out');
        } else if (status === 'CLOSED') {
          console.log('Project detail realtime subscription closed');
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
  }, [projectId, queryClient]);
};

export default useProjectRealtime;

