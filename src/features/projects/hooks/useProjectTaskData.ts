// ============================================================================
// useProjectTaskData - Task Data Fetching and State Sync
// ============================================================================

import { useState, useMemo, useEffect } from 'react';
import type { Task, TaskStatusEntity, CompletionLog } from '@/types';
import { useProjectTasks, useProjectCompletionLogs } from '../../tasks/hooks/useTasks';
import type { ProjectTaskState } from './types';
// Global realtime subscriptions are handled by GlobalRealtimeSubscriptions in AppLayout

interface UseProjectTaskDataParams {
  projectId: string | undefined;
}

interface UseProjectTaskDataReturn extends ProjectTaskState {
  isLoading: boolean;
  isFetched: boolean;
  projectTasksFromDb: Task[];
}

/**
 * Hook for fetching and managing task data state
 */
export const useProjectTaskData = ({
  projectId,
}: UseProjectTaskDataParams): UseProjectTaskDataReturn => {
  // Fetch project tasks from database
  const {
    data: projectTasksFromDb = [],
    isLoading: tasksLoading,
    isFetched: tasksFetched
  } = useProjectTasks(projectId);

  // Local state for optimistic updates
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const [localTaskStatuses, setLocalTaskStatuses] = useState<TaskStatusEntity[]>([]);
  const [localCompletionLogs, setLocalCompletionLogs] = useState<CompletionLog[]>([]);

  // Extract task IDs for fetching completion logs
  const taskIdsForLogs = useMemo(() =>
    projectTasksFromDb.map(t => typeof t.id === 'string' ? parseInt(t.id) : t.id),
    [projectTasksFromDb]
  );

  // Global realtime subscriptions are handled by GlobalRealtimeSubscriptions in AppLayout
  // Task status updates are automatically reflected via the global subscription

  // Fetch completion logs for all project tasks
  const {
    data: completionLogsFromDb = [],
    isLoading: completionLogsLoading
  } = useProjectCompletionLogs(taskIdsForLogs);

  // Sync tasks from database to local state when React Query data changes
  useEffect(() => {
    if (projectTasksFromDb.length > 0) {
      setLocalTasks(projectTasksFromDb);

      // Extract task statuses from the fetched tasks
      const allStatuses: TaskStatusEntity[] = [];
      projectTasksFromDb.forEach(task => {
        if (task.taskStatus && Array.isArray(task.taskStatus)) {
          allStatuses.push(...task.taskStatus);
        }
      });
      setLocalTaskStatuses(allStatuses);
    }
  }, [projectTasksFromDb]);

  // Sync completion logs from database to local state
  useEffect(() => {
    if (completionLogsFromDb.length > 0) {
      setLocalCompletionLogs(completionLogsFromDb);
    }
  }, [completionLogsFromDb]);

  // Merged data: use local state for UI (includes optimistic updates)
  const tasks = localTasks.length > 0 ? localTasks : projectTasksFromDb;
  const taskStatuses = localTaskStatuses;
  const completionLogs = localCompletionLogs.length > 0 ? localCompletionLogs : completionLogsFromDb;

  // Combined loading state
  const isLoading = tasksLoading || (tasksFetched && projectTasksFromDb.length > 0 && tasks.length === 0);

  return {
    tasks,
    taskStatuses,
    completionLogs,
    setLocalTasks,
    setLocalTaskStatuses,
    setLocalCompletionLogs,
    isLoading,
    isFetched: tasksFetched,
    projectTasksFromDb,
  };
};

