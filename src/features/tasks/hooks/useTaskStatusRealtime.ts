// ============================================================================
// useTaskStatusRealtime Hook - Real-time Task Status Updates (Supabase)
// ============================================================================
// Subscribes to Postgres changes on `task_statuses` and invalidates task queries
// so all task views (Today, Project, etc.) reflect multi-user status updates fast.
// ============================================================================

import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOptimisticSubscription } from '@/hooks/useOptimisticSubscription';
import { transformTaskStatusRow, toNumberId, type TaskStatusRow } from '@/db/transformers';
import type { Task, TaskStatusEntity } from '@/types';

interface UseTaskStatusRealtimeParams {
  enabled?: boolean;
  taskIds?: Array<string | number>;
  userId?: number | null;
  extraInvalidateQueryKeys?: unknown[][];
}

export const useTaskStatusRealtime = ({
  enabled = true,
  taskIds,
  userId,
  extraInvalidateQueryKeys = [],
}: UseTaskStatusRealtimeParams) => {
  const queryClient = useQueryClient();

  const normalizedTaskIds = useMemo(() => {
    const ids = (taskIds || [])
      .map((id) => (typeof id === 'string' ? parseInt(id) : id))
      .filter((id): id is number => Number.isFinite(id));
    return Array.from(new Set(ids));
  }, [taskIds]);

  const hasTaskFilter = normalizedTaskIds.length > 0 && normalizedTaskIds.length <= 100;
  // If no taskIds and no userId provided, we can't subscribe safely (unless we want ALL stats?)
  // Original logic required userId if no taskIds. 
  // We'll use 0 as fallback if needed but usually userId is provided.
  const effectiveUserId = userId ?? 0;
  const subscriptionEnabled = enabled && (hasTaskFilter || !!userId);

  // 1. Optimistic Update for 'taskStatuses' (Standalone Status Entities)
  useOptimisticSubscription<TaskStatusEntity[]>({
    channelName: 'tasks', // Mapped to 'task_statuses' table in RealtimeManager
    queryKey: ['taskStatuses'],
    userId: effectiveUserId,
    enabled: subscriptionEnabled,
    filter: { taskIds: hasTaskFilter ? normalizedTaskIds : undefined },
    invalidateDelay: 1000,
    updater: (oldData = [], payload) => {
      const row = payload.new as TaskStatusRow;
      const oldRow = payload.old as { id: string };

      switch (payload.eventType) {
        case 'INSERT':
          return [...oldData, transformTaskStatusRow(row)];
        case 'UPDATE':
          return oldData.map(item => item.id === toNumberId(row.id) ? transformTaskStatusRow(row) : item);
        case 'DELETE':
          return oldData.filter(item => item.id !== toNumberId(oldRow.id));
        default:
          return oldData;
      }
    },
    // Side Effect: Invalidate completion logs and extras
    sideEffect: () => {
      queryClient.invalidateQueries({ queryKey: ['completionLogs'] });
      extraInvalidateQueryKeys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
    }
  });

  // 2. Optimistic Update for 'tasks' (Embedded Statuses)
  // When a status changes, we need to find the task and update its 'taskStatus' array
  useOptimisticSubscription<Task[]>({
    channelName: 'tasks',
    queryKey: ['tasks'],
    userId: effectiveUserId,
    enabled: subscriptionEnabled,
    filter: { taskIds: hasTaskFilter ? normalizedTaskIds : undefined },
    invalidateDelay: 1000,
    updater: (oldTasks = [], payload) => {
      const row = payload.new as TaskStatusRow;
      const oldRow = payload.old as { id: string };
      const statusId = payload.eventType === 'DELETE' ? toNumberId(oldRow.id) : toNumberId(row.id);
      const targetTaskId = payload.eventType === 'DELETE' ? undefined : toNumberId(row.task_id); // DELETE payload might not have task_id

      // For DELETE, we might not know which task it belonged to unless we search
      // Optimistic DELETE for nested items is tricky without parent ID.
      // If generic DELETE, we iterate all tasks.

      return oldTasks.map(task => {
        // If INSERT/UPDATE, check match
        if (targetTaskId && task.id === targetTaskId) {
          const currentStatuses = task.taskStatus || [];
          let newStatuses = [...currentStatuses];

          if (payload.eventType === 'INSERT') {
            newStatuses.push(transformTaskStatusRow(row));
          } else if (payload.eventType === 'UPDATE') {
            newStatuses = newStatuses.map(s => s.id === statusId ? transformTaskStatusRow(row) : s);
          }
          return { ...task, taskStatus: newStatuses };
        }

        // If DELETE, remove from any task having this status
        if (payload.eventType === 'DELETE') {
          if (task.taskStatus?.some(s => s.id === statusId)) {
            return {
              ...task,
              taskStatus: task.taskStatus.filter(s => s.id !== statusId)
            };
          }
        }

        return task;
      });
    }
  });
};


