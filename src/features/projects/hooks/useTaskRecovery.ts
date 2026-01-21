// ============================================================================
// useTaskRecovery - Task Recovery Logic
// ============================================================================
// Handles task recovery operations with database persistence and UI updates.
// Extracted from useProjectTaskMutations for better modularity.
// ============================================================================

import { useCallback } from 'react';
import type { Task, TaskStatusEntity, User } from '@/types';
import { handleError } from '@/lib/errorUtils';
import { recoverTask } from '@/lib/tasks/taskRecoveryUtils';
import { notifyTaskRecovered } from '@/lib/tasks/taskEmailNotifications';
import { getDatabaseClient } from '@/db';

interface UseTaskRecoveryParams {
    user: User | null;
    tasks: Task[];
    taskStatuses: TaskStatusEntity[];
    setLocalTasks: (tasks: Task[] | ((prev: Task[]) => Task[])) => void;
    setLocalTaskStatuses: (statuses: TaskStatusEntity[] | ((prev: TaskStatusEntity[]) => TaskStatusEntity[])) => void;
}

export function useTaskRecovery({
    user,
    tasks,
    taskStatuses,
    setLocalTasks,
    setLocalTaskStatuses,
}: UseTaskRecoveryParams) {
    const handleRecover = useCallback(async (taskId: number) => {
        if (!user) return;

        const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
        const result = recoverTask(String(taskId), String(userId), tasks, taskStatuses);

        if (!result || !result.success) {
            handleError('Task not found or cannot be recovered', 'handleRecover');
            return;
        }

        try {
            const db = getDatabaseClient();

            // Persist task status update to database with ring color
            if (result.updatedTaskStatus) {
                await db.taskStatus.updateByTaskAndUser(taskId, userId, {
                    status: 'recovered',
                    recoveredAt: result.updatedTaskStatus.recoveredAt,
                    archivedAt: undefined, // Clear archivedAt
                    ringColor: 'yellow', // Yellow ring for recovered tasks
                });
            }

            // Update local task state immediately for instant UI feedback
            // Also update the embedded taskStatus array so TaskCard sees the change
            if (result.updatedTask && result.updatedTaskStatus) {
                setLocalTasks(prev =>
                    prev.map(t => {
                        if (t.id === taskId) {
                            // Update the task and its embedded taskStatus array
                            const updatedTaskStatuses = (t.taskStatus || []).map(ts => {
                                const tsUserId = typeof ts.userId === 'string' ? parseInt(ts.userId) : ts.userId;
                                if (tsUserId === userId) {
                                    return result.updatedTaskStatus!;
                                }
                                return ts;
                            });

                            return {
                                ...t,
                                taskStatus: updatedTaskStatuses,
                                ringColor: 'yellow',
                            };
                        }
                        return t;
                    })
                );

                setLocalTaskStatuses(prev =>
                    prev.map(ts => {
                        const tsUserId = typeof ts.userId === 'string' ? parseInt(ts.userId) : ts.userId;
                        if (ts.taskId === taskId && tsUserId === userId) {
                            return result.updatedTaskStatus!;
                        }
                        return ts;
                    })
                );
            }

            // Send email notification for recovered task
            if (result.updatedTask) {
                const db = getDatabaseClient();
                const project = await db.projects.getById(result.updatedTask.projectId);
                if (project) {
                    await notifyTaskRecovered(
                        result.updatedTask.id,
                        typeof project.id === 'string' ? parseInt(project.id) : project.id,
                        userId
                    );
                }
            }
        } catch (error) {
            handleError(error, 'handleRecover');
        }
    }, [user, tasks, taskStatuses, setLocalTasks, setLocalTaskStatuses]);

    return { handleRecover };
}

export default useTaskRecovery;
