// ============================================================================
// useProjectTaskCategories - Task Categorization Logic
// ============================================================================

import { useMemo } from 'react';
import type { Task, TaskStatusEntity, CompletionLog, Project, User } from '@/types';
import { getProjectTasks, updateTasksWithStatuses } from '@/lib/tasks/taskFilterUtils';
import { calculateProjectProgress } from '@/lib/projects/projectUtils';
import { calculateTaskStatusUserStatus } from '@/lib/tasks/taskUtils';
import type { CategorizedTasks, HabitSeries } from './types';

interface UseProjectTaskCategoriesParams {
  tasks: Task[];
  taskStatuses: TaskStatusEntity[];
  completionLogs: CompletionLog[];
  currentProject: Project | undefined;
  user: User | null;
}

/**
 * Hook for categorizing tasks into active, upcoming, completed, archived, and habits
 */
export const useProjectTaskCategories = ({
  tasks,
  taskStatuses,
  completionLogs,
  currentProject,
  user,
}: UseProjectTaskCategoriesParams): CategorizedTasks & {
  progress: number;
  completedCount: number;
  totalTasks: number;
  completedHabitSeries: HabitSeries[];
  upcomingHabitSeries: HabitSeries[];
  archivedHabitSeries: HabitSeries[];
} => {
  // Get project tasks using utility - show ALL tasks in the project
  const projectTasksRaw = useMemo(() =>
    currentProject ? getProjectTasks(tasks, String(currentProject.id)) : [],
    [tasks, currentProject]
  );

  const projectTasks = useMemo(() =>
    updateTasksWithStatuses(projectTasksRaw, taskStatuses),
    [projectTasksRaw, taskStatuses]
  );

  // Calculate progress using utility
  const { progress, completedTasks: completedCount, totalTasks } = useMemo(() => {
    if (!currentProject || !user) {
      return { progress: 0, completedTasks: 0, totalTasks: 0 };
    }
    const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    return calculateProjectProgress(currentProject, tasks, completionLogs, String(userId));
  }, [currentProject, tasks, completionLogs, user]);

  // User-specific categorization to avoid duplicates across sections
  // This categorization now STRICTLY includes only ONE-OFF tasks for the sections
  const categorizedTasks = useMemo(() => {
    const active: Task[] = [];
    const upcoming: Task[] = [];
    const completed: Task[] = [];
    const archived: Task[] = [];

    const addUnique = (list: Task[], task: Task) => {
      if (!list.some(t => t.id === task.id)) list.push(task);
    };

    if (!user) {
      return {
        activeTasks: [],
        upcomingTasks: [],
        completedTasks: [],
        archivedTasks: []
      };
    }

    const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;

    projectTasks.forEach(task => {
      // Habit tasks are handled separately in habitTasks
      if (task.type === 'habit') {
        return;
      }

      const myStatus = taskStatuses.find(ts => {
        const tsUserId = typeof ts.userId === 'string' ? parseInt(ts.userId) : ts.userId;
        const taskId = typeof task.id === 'string' ? parseInt(task.id) : task.id;
        const tsTaskId = typeof ts.taskId === 'string' ? parseInt(ts.taskId) : ts.taskId;
        return tsTaskId === taskId && tsUserId === userId;
      });

      const myCompletion = completionLogs.find(cl => {
        const clUserId = typeof cl.userId === 'string' ? parseInt(cl.userId) : cl.userId;
        const taskId = typeof task.id === 'string' ? parseInt(task.id) : task.id;
        const clTaskId = typeof cl.taskId === 'string' ? parseInt(cl.taskId) : cl.taskId;
        return clTaskId === taskId && clUserId === userId;
      });

      const userStatus = calculateTaskStatusUserStatus(myStatus, myCompletion, task);

      if (myCompletion) {
        addUnique(completed, task);
        return;
      }

      switch (userStatus) {
        case 'recovered':
        case 'active':
          addUnique(active, task);
          break;
        case 'upcoming':
          addUnique(upcoming, task);
          break;
        case 'archived':
          addUnique(archived, task);
          break;
        default:
          addUnique(active, task);
      }
    });

    return {
      activeTasks: active,
      upcomingTasks: upcoming,
      completedTasks: completed,
      archivedTasks: archived
    };
  }, [projectTasks, taskStatuses, completionLogs, user]);

  // Helper function to group habit tasks into series
  const groupHabitsBySeries = (tasksToGroup: Task[]) => {
    const seriesMap = new Map<string, HabitSeries>();

    tasksToGroup.forEach(task => {
      const seriesKey = `${task.title}|${task.description || ''}`;

      if (!seriesMap.has(seriesKey)) {
        seriesMap.set(seriesKey, {
          title: task.title,
          description: task.description,
          recurrencePattern: task.recurrencePattern,
          tasks: [],
        });
      }

      seriesMap.get(seriesKey)!.tasks.push(task);
    });

    seriesMap.forEach(series => {
      series.tasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    });

    return Array.from(seriesMap.values());
  };

  // Habits: group habit tasks by their series and status
  const { habitTasks, completedHabitSeries, upcomingHabitSeries, archivedHabitSeries } = useMemo(() => {
    const habits = projectTasks.filter(t => t.type === 'habit');

    if (!user) {
      return {
        habitTasks: groupHabitsBySeries(habits),
        completedHabitSeries: [],
        upcomingHabitSeries: [],
        archivedHabitSeries: []
      };
    }

    const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;

    // Filter habits by status for different tabs
    const completedHabits = habits.filter(task =>
      completionLogs.some(cl => {
        const clUserId = typeof cl.userId === 'string' ? parseInt(cl.userId) : cl.userId;
        const taskId = typeof task.id === 'string' ? parseInt(task.id) : task.id;
        const clTaskId = typeof cl.taskId === 'string' ? parseInt(cl.taskId) : cl.taskId;
        return clTaskId === taskId && clUserId === userId;
      })
    );

    const archivedHabits = habits.filter(task => {
      const myStatus = taskStatuses.find(ts => {
        const tsUserId = typeof ts.userId === 'string' ? parseInt(ts.userId) : ts.userId;
        const taskId = typeof task.id === 'string' ? parseInt(task.id) : task.id;
        const tsTaskId = typeof ts.taskId === 'string' ? parseInt(ts.taskId) : ts.taskId;
        return tsTaskId === taskId && tsUserId === userId;
      });
      return myStatus?.status === 'archived';
    });

    const upcomingHabits = habits.filter(task => {
      // Check if not completed and not archived
      const isCompleted = completionLogs.some(cl => {
        const clUserId = typeof cl.userId === 'string' ? parseInt(cl.userId) : cl.userId;
        const taskId = typeof task.id === 'string' ? parseInt(task.id) : task.id;
        const clTaskId = typeof cl.taskId === 'string' ? parseInt(cl.taskId) : cl.taskId;
        return clTaskId === taskId && clUserId === userId;
      });
      if (isCompleted) return false;

      const myStatus = taskStatuses.find(ts => {
        const tsUserId = typeof ts.userId === 'string' ? parseInt(ts.userId) : ts.userId;
        const taskId = typeof task.id === 'string' ? parseInt(task.id) : task.id;
        const tsTaskId = typeof ts.taskId === 'string' ? parseInt(ts.taskId) : ts.taskId;
        return tsTaskId === taskId && tsUserId === userId;
      });
      return myStatus?.status !== 'archived';
    });

    return {
      habitTasks: groupHabitsBySeries(habits),
      completedHabitSeries: groupHabitsBySeries(completedHabits),
      upcomingHabitSeries: groupHabitsBySeries(upcomingHabits),
      archivedHabitSeries: groupHabitsBySeries(archivedHabits)
    };
  }, [projectTasks, user, completionLogs, taskStatuses]);

  const hasAnyAllTabContent = useMemo(() =>
    Boolean(
      categorizedTasks.activeTasks.length ||
      categorizedTasks.upcomingTasks.length ||
      categorizedTasks.completedTasks.length ||
      categorizedTasks.archivedTasks.length
    ),
    [categorizedTasks]
  );

  return {
    ...categorizedTasks,
    habitTasks,
    completedHabitSeries,
    upcomingHabitSeries,
    archivedHabitSeries,
    projectTasks,
    hasAnyAllTabContent,
    progress,
    completedCount,
    totalTasks,
  };
};
