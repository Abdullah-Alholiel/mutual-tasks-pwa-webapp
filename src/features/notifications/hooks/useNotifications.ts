// ============================================================================
// useNotifications Hook - Real-Time Notifications with Supabase + React Query
// ============================================================================
// Provides real-time notification updates using the centralized RealtimeManager
// and React Query for global state synchronization.
// ============================================================================

import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Notification } from '@/types';
import { getDatabaseClient } from '@/db';
import { handleError } from '@/lib/errorUtils';
import { getRealtimeManager } from '@/features/realtime/RealtimeManager';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { transformNotificationRow, type NotificationRow } from '@/db/transformers';

interface UseNotificationsParams {
  userId: number | null | undefined;
  enabled?: boolean;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteAll: () => Promise<void>;
  deleteList: (ids: number[]) => Promise<void>;
  refetch: () => Promise<void>;
}

// Query keys
export const NOTIFICATION_KEYS = {
  all: (userId: number) => ['notifications', userId] as const,
  lists: (userId: number) => [...NOTIFICATION_KEYS.all(userId), 'list'] as const,
};

/**
 * Hook for managing notifications with real-time updates and global state
 */
export const useNotifications = ({
  userId,
  enabled = true,
}: UseNotificationsParams): UseNotificationsReturn => {
  const queryClient = useQueryClient();

  // Queries
  const {
    data: notifications = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: NOTIFICATION_KEYS.lists(userId!),
    queryFn: async () => {
      if (!userId) return [];
      const db = getDatabaseClient();
      return await db.notifications.getByUserId(userId, {
        limit: 100,
        isRead: undefined, // Get both read and unread
      });
    },
    enabled: !!userId && enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes (updates handled by realtime/mutations)
  });

  // Calculate unread count from the source of truth
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Handle realtime notification updates
  const handleNotificationChange = useCallback((
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>
  ) => {
    try {
      if (payload.eventType === 'INSERT' && payload.new) {
        const newNotification = transformNotificationRow(payload.new as NotificationRow);
        showBrowserNotification(newNotification);
      }

      // Small delay to allow DB to be consistent, then invalidate
      setTimeout(() => {
        if (userId) {
          // Invalidate to force a refetch across all components
          queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.lists(userId) });
        }
      }, 100);
    } catch (err) {
      console.error('Error processing notification update:', err);
    }
  }, [userId, queryClient]);

  // Set up real-time subscription using RealtimeManager
  useEffect(() => {
    if (!userId || !enabled) return;

    const manager = getRealtimeManager();
    const unsubscribe = manager.subscribe(
      'notifications',
      userId,
      handleNotificationChange
    );

    return unsubscribe;
  }, [userId, enabled, handleNotificationChange]);

  // Mutations

  // Mark a notification as read
  const { mutateAsync: markAsRead } = useMutation({
    mutationFn: async (notificationId: number) => {
      const db = getDatabaseClient();
      await db.notifications.markAsRead(notificationId);
    },
    onMutate: async (notificationId) => {
      if (!userId) return;
      await queryClient.cancelQueries({ queryKey: NOTIFICATION_KEYS.lists(userId) });

      const previousNotifications = queryClient.getQueryData<Notification[]>(NOTIFICATION_KEYS.lists(userId));

      if (previousNotifications) {
        queryClient.setQueryData<Notification[]>(
          NOTIFICATION_KEYS.lists(userId),
          previousNotifications.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
        );
      }

      return { previousNotifications };
    },
    onError: (err, newTodo, context) => {
      if (userId && context?.previousNotifications) {
        queryClient.setQueryData(NOTIFICATION_KEYS.lists(userId), context.previousNotifications);
      }
      handleError(err, 'markNotificationRead');
    },
    onSettled: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.lists(userId) });
      }
    },
  });

  // Mark all notifications as read
  const { mutateAsync: markAllAsRead } = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const db = getDatabaseClient();
      await db.notifications.markAllAsRead(userId);
    },
    onMutate: async () => {
      if (!userId) return;
      await queryClient.cancelQueries({ queryKey: NOTIFICATION_KEYS.lists(userId) });

      const previousNotifications = queryClient.getQueryData<Notification[]>(NOTIFICATION_KEYS.lists(userId));

      if (previousNotifications) {
        queryClient.setQueryData<Notification[]>(
          NOTIFICATION_KEYS.lists(userId),
          previousNotifications.map(n => ({ ...n, isRead: true }))
        );
      }

      return { previousNotifications };
    },
    onError: (err, variables, context) => {
      if (userId && context?.previousNotifications) {
        queryClient.setQueryData(NOTIFICATION_KEYS.lists(userId), context.previousNotifications);
      }
      handleError(err, 'markAllNotificationsRead');
    },
    onSettled: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.lists(userId) });
      }
    },
  });

  // Delete all notifications for current user
  const { mutateAsync: deleteAll } = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const db = getDatabaseClient();
      await db.notifications.deleteByUserId(userId);
    },
    onMutate: async () => {
      if (!userId) return;
      await queryClient.cancelQueries({ queryKey: NOTIFICATION_KEYS.lists(userId) });

      const previousNotifications = queryClient.getQueryData<Notification[]>(NOTIFICATION_KEYS.lists(userId));

      // Optimistically clear the list
      queryClient.setQueryData<Notification[]>(NOTIFICATION_KEYS.lists(userId), []);

      return { previousNotifications };
    },
    onError: (err, variables, context) => {
      if (userId && context?.previousNotifications) {
        queryClient.setQueryData(NOTIFICATION_KEYS.lists(userId), context.previousNotifications);
      }
      handleError(err, 'deleteAllNotifications');
    },
    onSettled: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.lists(userId) });
      }
    },
  });

  // Delete a list of notifications
  const { mutateAsync: deleteList } = useMutation({
    mutationFn: async (ids: number[]) => {
      if (!userId || ids.length === 0) return;
      const db = getDatabaseClient();
      await db.notifications.deleteMany(ids);
    },
    onMutate: async (ids) => {
      if (!userId) return;
      await queryClient.cancelQueries({ queryKey: NOTIFICATION_KEYS.lists(userId) });

      const previousNotifications = queryClient.getQueryData<Notification[]>(NOTIFICATION_KEYS.lists(userId));

      if (previousNotifications) {
        queryClient.setQueryData<Notification[]>(
          NOTIFICATION_KEYS.lists(userId),
          previousNotifications.filter(n => !ids.includes(n.id))
        );
      }

      return { previousNotifications };
    },
    onError: (err, variables, context) => {
      if (userId && context?.previousNotifications) {
        queryClient.setQueryData(NOTIFICATION_KEYS.lists(userId), context.previousNotifications);
      }
      handleError(err, 'deleteNotificationList');
    },
    onSettled: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.lists(userId) });
      }
    },
  });

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: async (id) => { await markAsRead(id); },
    markAllAsRead: async () => { await markAllAsRead(); },
    deleteAll: async () => { await deleteAll(); },
    deleteList: async (ids) => { await deleteList(ids); },
    refetch: async () => { await refetch(); },
  };
};


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

export default useNotifications;

