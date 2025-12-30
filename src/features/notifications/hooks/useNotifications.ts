// ============================================================================
// useNotifications Hook - Real-Time Notifications with Supabase
// ============================================================================
// Provides real-time notification updates using Supabase subscriptions
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Notification } from '@/types';
import { getDatabaseClient } from '@/db';
import { handleError } from '@/lib/errorUtils';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSharedSupabaseClientOrUndefined } from '@/lib/supabaseClient';
import { toNumberId, transformNotificationRow, type NotificationRow } from '@/db/transformers';

// Module-level subscription tracking to prevent duplicates
const activeNotificationSubscriptions = new Map<number, RealtimeChannel>();
const notificationStateCallbacks = new Map<number, Set<() => void>>();

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
  refetch: () => Promise<void>;
}

/**
 * Hook for managing notifications with real-time updates
 */
export const useNotifications = ({
  userId,
  enabled = true,
}: UseNotificationsParams): UseNotificationsReturn => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const queryClient = useQueryClient();

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Load notifications from database
  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const db = getDatabaseClient();
      const userNotifications = await db.notifications.getByUserId(userId, {
        limit: 100,
        isRead: undefined, // Get both read and unread
      });
      setNotifications(userNotifications);
    } catch (error) {
      handleError(error, 'loadNotifications');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Set up real-time subscription (singleton pattern - one subscription per userId)
  useEffect(() => {
    if (!userId || !enabled) return;

    const supabase = getSharedSupabaseClientOrUndefined();
    if (!supabase) {
      console.warn('Supabase not configured, real-time notifications disabled');
      return;
    }

    // Register this component's refetch function to receive updates
    // When notifications change, all registered components will refetch
    const refetchFn = () => {
      loadNotifications();
    };
    
    if (!notificationStateCallbacks.has(userId)) {
      notificationStateCallbacks.set(userId, new Set());
    }
    notificationStateCallbacks.get(userId)!.add(refetchFn);

    // Check if subscription already exists for this userId
    let existingChannel = activeNotificationSubscriptions.get(userId);
    
    if (!existingChannel) {
      // Create new subscription
      const channelName = `notifications:${userId}:${Date.now()}`;
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            try {
              if (payload.eventType === 'INSERT' && payload.new) {
                const newNotification = transformNotificationRow(payload.new as NotificationRow);
                showBrowserNotification(newNotification);
              }
              
              // Notify all registered callbacks to refetch their notifications
              const callbacks = notificationStateCallbacks.get(userId);
              if (callbacks) {
                // Use a small delay to allow DB to be consistent
                setTimeout(() => {
                  callbacks.forEach(refetchCallback => {
                    refetchCallback();
                  });
                }, 100);
              }
            } catch (err) {
              console.error('Error processing notification update:', err);
            }
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('Notifications realtime subscription active');
          } else if (status === 'CHANNEL_ERROR') {
            if (err) {
              console.error('Notifications realtime subscription error:', err);
            }
          } else if (status === 'TIMED_OUT') {
            console.warn('Notifications realtime subscription timed out');
          } else if (status === 'CLOSED') {
            console.log('Notifications realtime subscription closed');
            activeNotificationSubscriptions.delete(userId);
          }
        });

      activeNotificationSubscriptions.set(userId, channel);
      existingChannel = channel;
    }

    channelRef.current = existingChannel;

    // Load initial notifications
    loadNotifications();

    return () => {
      // Unregister this component's refetch function
      const callbacks = notificationStateCallbacks.get(userId);
      if (callbacks) {
        callbacks.delete(refetchFn);
        if (callbacks.size === 0) {
          notificationStateCallbacks.delete(userId);
          // Only remove subscription if no callbacks remain
          const channelToRemove = activeNotificationSubscriptions.get(userId);
          if (channelToRemove) {
            try {
              supabase.removeChannel(channelToRemove);
            } catch (err) {
              // Ignore cleanup errors
            }
            activeNotificationSubscriptions.delete(userId);
          }
        }
      }
      channelRef.current = null;
    };
  }, [userId, enabled, loadNotifications]);

  // Mark a notification as read
  const markAsRead = useCallback(async (notificationId: number) => {
    // Optimistic update
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );

    try {
      const db = getDatabaseClient();
      await db.notifications.markAsRead(notificationId);
    } catch (error) {
      // Revert optimistic update
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: false } : n)
      );
      handleError(error, 'markNotificationRead');
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!userId) return;

    // Optimistic update
    const previousNotifications = notifications;
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));

    try {
      const db = getDatabaseClient();
      await db.notifications.markAllAsRead(userId);
    } catch (error) {
      // Revert optimistic update
      setNotifications(previousNotifications);
      handleError(error, 'markAllNotificationsRead');
    }
  }, [userId, notifications]);

  // Refetch notifications
  const refetch = useCallback(async () => {
    await loadNotifications();
  }, [loadNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refetch,
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

