// ============================================================================
// useNotifications Hook - Real-Time Notifications with Supabase + React Query
// ============================================================================
// Provides real-time notification updates using the centralized RealtimeManager
// and React Query for global state synchronization.
// ============================================================================

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Notification } from '@/types';
import { getDatabaseClient } from '@/db';
import { handleError } from '@/lib/errorUtils';
import { NOTIFICATION_KEYS } from '@/lib/queryKeys';

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

/**
 * Hook for managing notifications with real-time updates and global state
 */
export const useNotifications = ({
  userId,
  enabled = true,
}: UseNotificationsParams): UseNotificationsReturn => {
  const queryClient = useQueryClient();

  // Queries - with optimized settings for real-time updates
  const {
    data: notifications = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: NOTIFICATION_KEYS.lists(userId!),
    queryFn: async () => {
      if (!userId) return [];
      const db = getDatabaseClient();
      const result = await db.notifications.getByUserId(userId, {
        limit: 100,
        isRead: undefined, // Get both read and unread
      });
      return result;
    },
    enabled: !!userId && enabled,
    // Critical: These settings ensure the query re-renders when cache updates
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't garbage collect - ensures data is always fresh
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true,
  });

  // Calculate unread count from the source of truth
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Realtime updates are now handled globally by useUnifiedRealtime
  // which listens to 'notifications' table and invalidates NOTIFICATION_KEYS.lists

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

export default useNotifications;

