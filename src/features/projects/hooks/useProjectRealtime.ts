// ============================================================================
// useProjectRealtime Hook - Real-Time Project Updates with Supabase
// ============================================================================
// Provides real-time project updates with optimistic caching
// ============================================================================

import { useQueryClient } from '@tanstack/react-query';
import { useOptimisticSubscription } from '@/hooks/useOptimisticSubscription';
import { toNumberId, type TaskRow } from '@/db/transformers';
import type { Project, Task } from '@/types';

interface UseProjectRealtimeParams {
  userId: number | null | undefined;
  enabled?: boolean;
}

/**
 * Hook for subscribing to real-time project list updates
 */
export const useProjectRealtime = ({
  userId,
  enabled = true,
}: UseProjectRealtimeParams) => {
  const queryClient = useQueryClient();

  // Optimistic update for project list is limited because 'project_participants' 
  // doesn't contain project data (name, icon). So we rely on invalidation.
  useOptimisticSubscription({
    channelName: 'projects',
    queryKey: ['projects'],
    userId,
    enabled,
    updater: (oldData) => oldData, // No optimistic update possible for list items just from ID
    invalidateDelay: 500,
    sideEffect: () => {
      // Also invalidate public/stats variants
      queryClient.invalidateQueries({ queryKey: ['projects', 'public'] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'with-stats'] });
    }
  });
};

/**
 * Hook for subscribing to a specific project's updates (Tasks + Participants)
 */
export const useProjectDetailRealtime = (projectId: string | number | undefined, userId?: number | null) => {
  const queryClient = useQueryClient();
  const projectIdNum = typeof projectId === 'string' ? parseInt(projectId) : projectId;

  const enabled = !!projectId;
  const channelName = (`project-detail:${projectId}`) as any; // Cast to SubscriptionType

  // 1. Optimistic Tasks Update
  useOptimisticSubscription<Task[]>({
    channelName,
    queryKey: ['tasks', 'project', projectIdNum],
    userId,
    enabled,
    filter: { projectId },
    invalidateDelay: 1000,
    updater: (oldTasks = [], payload) => {
      if (payload.table !== 'tasks') return oldTasks;

      const row = payload.new as TaskRow;
      const oldRow = payload.old as { id: string };

      switch (payload.eventType) {
        case 'INSERT':
          // Can't optimistically insert because we miss assignee/reporter joins
          return oldTasks;
        case 'UPDATE':
          // Partial update if we match ID
          return oldTasks.map(t => t.id === toNumberId(row.id) ? {
            ...t,
            title: row.title,
            description: row.description || undefined,
            // Note regarding status: Status is joined from task_statuses.
            // A generic task UPDATE usually doesn't change status directly (status is separate table).
            // But if backend triggers update 'updated_at', we reflect it.
          } : t);
        case 'DELETE':
          return oldTasks.filter(t => t.id !== toNumberId(oldRow.id));
        default:
          return oldTasks;
      }
    }
  });

  // 2. Optimistic Project (Participants) Update
  useOptimisticSubscription<Project>({
    channelName,
    queryKey: ['project', projectId], // AND simple ID?
    userId,
    enabled,
    filter: { projectId },
    invalidateDelay: 1000,
    updater: (oldProject, payload) => {
      if (!oldProject) return undefined;
      if (payload.table !== 'project_participants') return oldProject;

      const oldRow = payload.old as { user_id: string };

      // Optimistic DELETE (Remove member)
      if (payload.eventType === 'DELETE') {
        const removedUserId = toNumberId(oldRow.user_id);
        return {
          ...oldProject,
          participants: oldProject.participants?.filter(p => p.id !== removedUserId),
          participantRoles: oldProject.participantRoles?.filter(p => p.userId !== removedUserId)
        };
      }

      // INSERT/UPDATE requires joined user data, rely on refetch
      return oldProject;
    },
    sideEffect: () => {
      // Invalidate string variant of ID just in case and taskStatuses
      queryClient.invalidateQueries({ queryKey: ['project', String(projectId)] });
      queryClient.invalidateQueries({ queryKey: ['taskStatuses'] });
    }
  });
};

export default useProjectRealtime;
