// ============================================================================
// GlobalRealtimeSubscriptions - Single Source for All Realtime Subscriptions
// ============================================================================
// This component initializes the UNIFIED realtime subscription once at the
// app level. All task/status/log changes are handled by a single channel.
// ============================================================================

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { useUnifiedRealtime } from '@/features/realtime/useUnifiedRealtime';
import { useFriendRequestsRealtime } from '@/features/friends/hooks/useFriendRequestsRealtime';
import { getRealtimeManager } from '@/features/realtime/RealtimeManager';
import { getUserPreloadCache } from '@/features/realtime/UserPreloadCache';

/**
 * Global realtime subscriptions component
 * Should be rendered once at the app level (in AppLayout or App)
 */
export const GlobalRealtimeSubscriptions = () => {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const userId = user ? (typeof user.id === 'string' ? parseInt(user.id) : user.id) : null;

  // Start health monitor and preload current user when authenticated
  useEffect(() => {
    if (!user || !isAuthenticated) return;

    console.log('👤 [GlobalRealtime] User authenticated:', user.id);

    // Start health monitoring
    const manager = getRealtimeManager();
    manager.startHealthMonitor();

    // Preload current user into cache
    const cache = getUserPreloadCache();
    cache.set(user);

    // Debug: Log realtime status periodically
    const interval = setInterval(() => {
      console.log('📊 [GlobalRealtime] Status check at:', new Date().toISOString());
    }, 60000); // Every minute

    return () => {
      manager.stopHealthMonitor();
      clearInterval(interval);
    };
  }, [user, isAuthenticated]);

  // Force refetch on reconnect
  useEffect(() => {
    const handleOnline = () => {
      console.log('🔄 [GlobalRealtime] Online detected - forcing sync...');
      queryClient.refetchQueries({ queryKey: ['tasks'] });
      queryClient.refetchQueries({ queryKey: ['projects'] });
      queryClient.refetchQueries({ queryKey: ['notifications'] });
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [queryClient]);

  // ========================================================================
  // UNIFIED REALTIME - Single channel for ALL task/status/log changes
  // ========================================================================
  // This ONE hook handles all task-related realtime updates.
  // No more conflicting subscriptions!
  useUnifiedRealtime();

  // ========================================================================
  // FRIEND REQUESTS - Separate domain, keep its own subscription
  // ========================================================================
  useFriendRequestsRealtime({
    userId,
    enabled: !!user && isAuthenticated,
  });

  // Notifications subscription is handled by individual useNotifications hooks
  // The RealtimeManager singleton ensures only one channel exists per user

  // This component doesn't render anything - it just manages subscriptions
  return null;
};

