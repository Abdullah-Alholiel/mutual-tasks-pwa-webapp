// ============================================================================
// GlobalRealtimeSubscriptions - Single Source for All Realtime Subscriptions
// ============================================================================
// This component initializes the UNIFIED realtime subscription once at the
// app level. All task/status/log changes are handled by a single channel.
//
// Purpose:
// - Initialize realtime subscriptions at the app root level
// - Prevent duplicate subscriptions when navigating between pages
// - Ensure proper cleanup when the application unmounts
// - Handle cross-cutting concerns like health monitoring and push notifications
//
// Architecture:
// - Single instance rendered at app level (AppLayout or App)
// - Multiple useEffect hooks for different initialization concerns
// - No UI rendering (returns null) - pure side-effect management
// - All real-time logic delegated to specialized hooks and services
//
// Subscription Flow:
// 1. Health monitoring starts (RealtimeManager)
// 2. User data preloaded (UserPreloadCache)
// 3. Push subscription ensured (OneSignal)
// 4. Unified realtime channel created (useUnifiedRealtime)
// 5. Friend requests realtime created (useFriendRequestsRealtime)
// ============================================================================

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { useUnifiedRealtime } from '@/features/realtime/useUnifiedRealtime';
import { useFriendRequestsRealtime } from '@/features/friends/hooks/useFriendRequestsRealtime';
import { getRealtimeManager } from '@/features/realtime/RealtimeManager';
import { getUserPreloadCache } from '@/features/realtime/UserPreloadCache';
import { ensurePushSubscription } from '@/lib/onesignal/oneSignalService';
import { browserNotificationService } from '@/lib/notifications/browserNotificationService';
import { TASK_KEYS, PROJECT_KEYS, NOTIFICATION_KEYS } from '@/lib/queryKeys';

/**
 * GlobalRealtimeSubscriptions - Root-Level Realtime Manager
 *
 * This component serves as the single source of truth for all real-time
 * subscriptions in the application. It should be rendered once at the app
 * level (typically in AppLayout or App component) and never unmounted
 * during normal operation.
 *
 * Responsibilities:
 * 1. Initialize and manage the unified realtime channel
 * 2. Start health monitoring for connection status
 * 3. Preload user data for real-time access
 * 4. Ensure push notification subscription is linked to user
 * 5. Handle online/offline events for data synchronization
 *
 * @example
 * ```tsx
 * // In App.tsx or AppLayout.tsx
 * function App() {
 *   return (
 *     <>
 *       <GlobalRealtimeSubscriptions />
 *       <Router />
 *     </>
 *   );
 * }
 * ```
 */
export const GlobalRealtimeSubscriptions = () => {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Extract numeric userId from auth state
  // Handles both string and numeric ID types from auth provider
  const userId = user ? (typeof user.id === 'string' ? parseInt(user.id) : user.id) : null;

  // =========================================================================
  // Initialization Effect: Health Monitor, User Preload, Push Subscription
  // =========================================================================
  // Runs once on mount and whenever user/auth state changes
  // Cleans up resources on unmount
  // =========================================================================
  useEffect(() => {
    // Exit early if user is not authenticated
    // Prevents unnecessary initialization and potential errors
    if (!user || !isAuthenticated) return;

    // Start the realtime connection health monitor
    // This periodically checks channel status and auto-reconnects if needed
    const manager = getRealtimeManager();
    manager.startHealthMonitor();

    // Preload current user data into the cache
    // This enables immediate access to user data without additional fetches
    const cache = getUserPreloadCache();
    cache.set(user);

    // Ensure push subscription is active and linked to this user
    // This is critical for push notifications to work correctly
    // Any errors are logged but don't block the application
    ensurePushSubscription(user.id).catch((err) => {
      console.warn('[Push] Subscription setup failed:', err);
    });

    // Cleanup: Stop health monitoring when component unmounts
    // This prevents memory leaks and unnecessary background activity
    return () => {
      manager.stopHealthMonitor();
    };
  }, [user, isAuthenticated]);

  // =========================================================================
  // Browser Notification Setup
  // =========================================================================
  // Check browser notification support and permission status
  // Note: We do NOT request permission proactively - browsers may block
  // automatic requests. Users should opt-in via UI interaction.
  // =========================================================================
  useEffect(() => {
    // Exit early if user is not authenticated
    if (!user || !isAuthenticated) return;

    /**
     * Check and log browser notification support status
     * This helps with debugging why notifications might not appear
     */
    const checkBrowserNotificationSupport = () => {
      // Check if browser supports notifications at all
      if (!browserNotificationService.isSupported()) {
        console.log('[Notifications] Browser notifications not supported');
        return;
      }

      // Log current permission state
      const permission = browserNotificationService.getPermission();

      if (permission === 'denied') {
        console.log('[Notifications] Browser notifications denied - user must enable in browser settings');
      }
    };

    checkBrowserNotificationSupport();
  }, [user, isAuthenticated]);

  // =========================================================================
  // Online/Offline Event Handling
  // =========================================================================
  // When the application comes back online, refetch all data to ensure
  // the UI is up-to-date with the latest server state
  // =========================================================================
  useEffect(() => {
    /**
     * Handle restoration of network connectivity
     * Refetches all realtime data to sync with server
     */
    const handleOnline = () => {
      console.log('[GlobalRealtime] Network restored - refetching data...');

      // Refetch all task and project data
      queryClient.refetchQueries({ queryKey: TASK_KEYS.all });
      queryClient.refetchQueries({ queryKey: PROJECT_KEYS.all });

      // Refetch notifications if user is authenticated
      if (userId) {
        queryClient.refetchQueries({ queryKey: NOTIFICATION_KEYS.all(userId) });
      }
    };

    // Register online event listener
    window.addEventListener('online', handleOnline);

    // Cleanup: Remove event listener on unmount
    return () => window.removeEventListener('online', handleOnline);
  }, [queryClient, userId]);

  // =========================================================================
  // Unified Realtime Subscription
  // =========================================================================
  // This single hook manages ALL real-time updates for tasks, projects,
  // notifications, and other data. It uses a single WebSocket channel
  // to prevent connection conflicts and ensure reliable updates.
  //
  // CRITICAL: userId must be provided for user-specific notification filtering
  // Without it, notifications will be skipped and real-time updates may fail
  // =========================================================================
  useUnifiedRealtime({ userId: userId ?? undefined });

  // =========================================================================
  // Friend Requests Realtime
  // =========================================================================
  // Friend requests are a separate domain with their own subscription
  // This keeps the concerns separate while still using the unified manager
  // =========================================================================
  useFriendRequestsRealtime({
    userId,
    enabled: !!user && isAuthenticated,
  });

  // =========================================================================
  // No UI Rendering
  // =========================================================================
  // This component only manages side effects and subscriptions
  // It returns null to render nothing in the DOM
  // =========================================================================
  return null;
};

export default GlobalRealtimeSubscriptions;
