// ============================================================================
// GlobalRealtimeSubscriptions - Single Source for All Realtime Subscriptions
// ============================================================================
// This component initializes all realtime subscriptions once at the app level
// to prevent duplicate subscriptions when navigating between pages.
// ============================================================================

import { useAuth } from '@/features/auth/useAuth';
import { useProjectRealtime } from '@/features/projects/hooks/useProjectRealtime';
import { useTaskStatusRealtime } from '@/features/tasks/hooks/useTaskStatusRealtime';
import { useNotifications } from '@/features/notifications/hooks/useNotifications';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

/**
 * Global realtime subscriptions component
 * Should be rendered once at the app level (in AppLayout or App)
 */
export const GlobalRealtimeSubscriptions = () => {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const userId = user ? (typeof user.id === 'string' ? parseInt(user.id) : user.id) : null;

  // Global project realtime subscription (for all projects the user is part of)
  useProjectRealtime({
    userId,
    enabled: !!user && isAuthenticated,
  });

  // Global task status realtime subscription (watches all task statuses)
  // This ensures we see updates for any task status changes across the app
  useTaskStatusRealtime({
    enabled: !!user && isAuthenticated,
    userId: userId ?? undefined,
    // Don't specify taskIds - we want to watch all task status changes globally
  });

  // Global notifications subscription is managed by DesktopNav/MobileNav
  // They use useNotifications hook which handles deduplication internally

  // This component doesn't render anything - it just manages subscriptions
  return null;
};

