import { AppLayout } from '../../layout/AppLayout';
import { TaskCard } from '../tasks/components/TaskCard';
import { TaskForm } from '../tasks/components/TaskForm';
import { motion } from 'framer-motion';
import { Calendar, CheckCircle2, Plus, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { InlineLoader } from '../../components/ui/loader';
import { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { Task, TaskStatusEntity, CompletionLog } from '../../types';
import {
  getTodayTasks,
  getNeedsActionTasks,
  getCompletedTasksForToday,
  getRecoveredTasks,
  updateTasksWithStatuses
} from '../../lib/tasks/taskFilterUtils';
import { getProjectsWhereCanCreateTasks } from '../../lib/projects/projectUtils';
import { normalizeToStartOfDay } from '../../lib/tasks/taskUtils';
import { useAuth } from '../auth/useAuth';
import { useProjects } from '../projects/hooks/useProjects';
import { useCreateTask, useTaskStatuses, useCompletionLogs } from '../tasks/hooks/useTasks';
import { useCreateCompletionLog, useUpdateTaskStatus } from '../tasks/hooks/useTasks';
import { useTodayTasks, useUserTasks } from '../tasks/hooks/useTasks';
import { useIsRestoring, useQueryClient } from '@tanstack/react-query';
import { getDatabaseClient } from '@/db';
// Global realtime subscriptions are handled by GlobalRealtimeSubscriptions in AppLayout

interface IndexProps {
  isInternalSlide?: boolean;
  isActive?: boolean;
}

const Index = ({ isInternalSlide, isActive = true }: IndexProps) => {
  const { user, isAuthenticated } = useAuth();
  const isRestoring = useIsRestoring();
  const queryClient = useQueryClient();
  const { data: allProjects = [], isLoading: projectsLoading } = useProjects();
  const { data: todayTasksRaw = [], isLoading: tasksLoading } = useTodayTasks();
  const { data: allUserTasks = [], isLoading: allTasksLoading } = useUserTasks(); // For recovered tasks
  const createTaskMutation = useCreateTask();
  const createCompletionLogMutation = useCreateCompletionLog();
  const updateTaskStatusMutation = useUpdateTaskStatus();

  // Global realtime subscriptions are handled by GlobalRealtimeSubscriptions in AppLayout
  // No need to create subscriptions here - they're managed globally

  const { data: taskStatuses = [], isLoading: statusesLoading } = useTaskStatuses();
  const { data: completionLogs = [], isLoading: logsLoading } = useCompletionLogs();
  const [showTaskForm, setShowTaskForm] = useState(false);

  // Update tasks with their statuses
  const tasksWithStatuses = useMemo(() =>
    updateTasksWithStatuses(todayTasksRaw, taskStatuses),
    [todayTasksRaw, taskStatuses]
  );

  // Update ALL user tasks with their statuses (for finding recovered tasks)
  const allTasksWithStatuses = useMemo(() =>
    updateTasksWithStatuses(allUserTasks, taskStatuses),
    [allUserTasks, taskStatuses]
  );

  // Update projects with participant roles for permission checking
  const projectsWithRoles = useMemo(() =>
    allProjects.map(project => ({
      ...project,
      participantRoles: project.participantRoles || []
    })),
    [allProjects]
  );

  // Get projects where user can create tasks (only owner/manager roles)
  const projectsWhereCanCreateTasks = useMemo(() =>
    user ? getProjectsWhereCanCreateTasks(projectsWithRoles, user.id) : [],
    [projectsWithRoles, user]
  );

  // Filter tasks for today using utility
  const myTasks = useMemo(() => {
    if (!user) return [];
    return getTodayTasks(tasksWithStatuses, user.id).filter(task => {
      // Task should appear if user is in project participants or is creator
      const project = allProjects.find(p => p.id === task.projectId);
      if (!project) return false;

      const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      const creatorId = typeof task.creatorId === 'string' ? parseInt(task.creatorId) : task.creatorId;
      const isCreator = creatorId === userId;

      const isInProject = project.participantRoles?.some(pr => {
        const prUserId = typeof pr.userId === 'string' ? parseInt(pr.userId) : pr.userId;
        return prUserId === userId && !pr.removedAt;
      }) || project.ownerId === userId || isCreator;

      return isInProject;
    });
  }, [tasksWithStatuses, allProjects, user]);

  const handleComplete = async (taskId: string | number, difficultyRating?: number) => {
    if (!user) return;

    const now = new Date();
    // Look in both tasksWithStatuses (today's tasks) and allTasksWithStatuses (for recovered tasks)
    let task = tasksWithStatuses.find(t => {
      const tId = typeof t.id === 'string' ? parseInt(t.id) : t.id;
      const searchId = typeof taskId === 'string' ? parseInt(taskId) : taskId;
      return tId === searchId;
    });

    // If not found in today's tasks, check all tasks (for recovered tasks)
    if (!task) {
      task = allTasksWithStatuses.find(t => {
        const tId = typeof t.id === 'string' ? parseInt(t.id) : t.id;
        const searchId = typeof taskId === 'string' ? parseInt(taskId) : taskId;
        return tId === searchId;
      });
    }

    if (!task) {
      toast.error('Task not found');
      return;
    }

    const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    const taskIdNum = typeof taskId === 'string' ? parseInt(taskId) : taskId;
    const myTaskStatus = taskStatuses.find(ts => {
      const tsTaskId = typeof ts.taskId === 'string' ? parseInt(ts.taskId) : ts.taskId;
      const tsUserId = typeof ts.userId === 'string' ? parseInt(ts.userId) : ts.userId;
      return tsTaskId === taskIdNum && tsUserId === userId;
    });

    if (!myTaskStatus) {
      toast.error('Task status not found');
      return;
    }

    // Check if task is recovered
    const isRecovered = myTaskStatus.recoveredAt !== undefined;
    const taskDueDate = task.dueDate;
    
    // Normalize dates to start of day for accurate comparison
    // Tasks completed on the due date should get full XP
    const normalizedNow = normalizeToStartOfDay(now);
    const normalizedDueDate = normalizeToStartOfDay(new Date(taskDueDate));
    const isOnOrBeforeDueDate = normalizedNow.getTime() <= normalizedDueDate.getTime();

    // For non-recovered tasks, check if late (completed after due date)
    // Late means completed on a day AFTER the due date (not on the due date itself)
    const isLate = !isRecovered && !isOnOrBeforeDueDate;

    // Calculate XP (baseXP is fixed, not dependent on difficulty):
    // - Recovered tasks: ALWAYS give fixed 100 XP
    // - Late tasks (not recovered): give half of base XP (100 XP)
    // - On-time tasks: give full base XP (200 XP)
    const baseXP = 200; // Fixed base XP, not dependent on difficulty
    let xpEarned: number;
    let penaltyApplied: boolean;

    if (isRecovered) {
      // Recovered tasks always give fixed 100 XP
      xpEarned = 100;
      penaltyApplied = true;
    } else if (isLate) {
      // Late tasks (not recovered) give half XP
      xpEarned = Math.floor(baseXP / 2);
      penaltyApplied = true;
    } else {
      // On-time tasks give full XP
      xpEarned = baseXP;
      penaltyApplied = false;
    }

    try {
      // Create completion log
      await createCompletionLogMutation.mutateAsync({
        userId: userId,
        taskId: taskIdNum,
        difficultyRating: difficultyRating as 1 | 2 | 3 | 4 | 5 | undefined,
        penaltyApplied,
        xpEarned
      });

      // Update task status to completed
      await updateTaskStatusMutation.mutateAsync({
        id: myTaskStatus.id,
        data: {
          status: 'completed',
          ringColor: isRecovered ? 'yellow' : (isOnOrBeforeDueDate ? 'green' : 'none')
        }
      });

      // Recalculate and update user stats based on all completion logs
      try {
        const db = getDatabaseClient();
        await db.users.recalculateStats(userId, user.timezone || 'UTC');
        // Invalidate React Query cache for user stats so profile updates
        queryClient.invalidateQueries({ queryKey: ['user', 'current', 'stats', userId] });
        queryClient.invalidateQueries({ queryKey: ['completionLogs', userId] });
      } catch (statsError) {
        // Log error but don't fail the completion - stats update is secondary
        console.error('Failed to update user stats:', statsError);
      }

      // Invalidate task-related queries to ensure data freshness
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskStatuses'] });
      queryClient.invalidateQueries({ queryKey: ['taskStatuses', userId] });

      toast.success('Great job! 💪', {
        description: penaltyApplied
          ? 'Waiting for your partner to complete... (Half XP - Recovered)'
          : 'Waiting for your partner to complete...'
      });
    } catch (error) {
      toast.error('Failed to complete task');
      console.error(error);
    }
  };

  // Filter tasks using utilities for today's view sections
  const needsActionTasks = useMemo(() =>
    user ? getNeedsActionTasks(myTasks, taskStatuses, completionLogs, user.id, projectsWithRoles) : [],
    [myTasks, taskStatuses, completionLogs, projectsWithRoles, user]
  );

  const completedTasksForToday = useMemo(() =>
    user ? getCompletedTasksForToday(allTasksWithStatuses, taskStatuses, completionLogs, user.id) : [],
    [allTasksWithStatuses, taskStatuses, completionLogs, user]
  );

  // Use allTasksWithStatuses for recovered tasks since they have past due dates (not in today's tasks)
  const recoveredTasks = useMemo(() =>
    user ? getRecoveredTasks(allTasksWithStatuses, taskStatuses, completionLogs, user.id, projectsWithRoles) : [],
    [allTasksWithStatuses, taskStatuses, completionLogs, projectsWithRoles, user]
  );

  const handleCreateTask = async (taskData: {
    title: string;
    description: string;
    projectId: string | number;
    type: 'one_off' | 'habit';
    recurrencePattern?: 'Daily' | 'weekly' | 'custom';
    dueDate?: Date;
    customRecurrence?: {
      frequency: 'days' | 'weeks' | 'months';
      interval: number;
      daysOfWeek: number[];
      endType: 'date' | 'count';
      endDate?: Date;
      occurrenceCount: number;
    };
  }) => {
    try {
      const defaultDueDate = normalizeToStartOfDay(taskData.dueDate ?? new Date());

      if (taskData.type === 'habit' && taskData.dueDate && taskData.recurrencePattern) {
        // For habits, create multiple tasks
        // Note: This is simplified - in a real app you might want to create a recurrence entity
        const startDate = normalizeToStartOfDay(taskData.dueDate);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 28); // 28 days for habits

        const tasksToCreate: Array<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>> = [];
        let currentDate = new Date(startDate);

        while (currentDate <= endDate) {
          tasksToCreate.push({
            projectId: typeof taskData.projectId === 'string' ? parseInt(taskData.projectId) : taskData.projectId,
            creatorId: typeof user!.id === 'string' ? parseInt(user!.id) : user!.id,
            type: taskData.type,
            recurrencePattern: taskData.recurrencePattern,
            title: taskData.title,
            description: taskData.description,
            dueDate: normalizeToStartOfDay(new Date(currentDate))
          });

          if (taskData.recurrencePattern === 'Daily') {
            currentDate.setDate(currentDate.getDate() + 1);
          } else if (taskData.recurrencePattern === 'weekly') {
            currentDate.setDate(currentDate.getDate() + 7);
          } else {
            break;
          }
        }

        // Create all habit tasks
        await Promise.all(tasksToCreate.map(task => createTaskMutation.mutateAsync(task)));

        toast.success(`${tasksToCreate.length} habit tasks created! 🚀`, {
          description: 'Your friend has been notified to accept'
        });
      } else {
        // One-off task
        await createTaskMutation.mutateAsync({
          projectId: typeof taskData.projectId === 'string' ? parseInt(taskData.projectId) : taskData.projectId,
          creatorId: typeof user!.id === 'string' ? parseInt(user!.id) : user!.id,
          type: taskData.type,
          recurrencePattern: taskData.recurrencePattern,
          title: taskData.title,
          description: taskData.description,
          dueDate: defaultDueDate
        });

        toast.success('Task initiated! 🚀', {
          description: 'Your friend has been notified to accept'
        });
      }

      setShowTaskForm(false);
    } catch (error) {
      toast.error('Failed to create task');
      console.error(error);
    }
  };

  // We no longer block the whole page on loading
  // SWR pattern: show cached data instantly if available
  const isInitialLoading = (tasksLoading || projectsLoading || statusesLoading || logsLoading || isRestoring) &&
    (todayTasksRaw.length === 0 && allProjects.length === 0);

  if (isInitialLoading) {
    return (
      <div className="space-y-8 p-4">
        <div className="h-20 w-full animate-pulse bg-muted rounded-2xl" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-24 animate-pulse bg-muted rounded-2xl" />
          <div className="h-24 animate-pulse bg-muted rounded-2xl" />
          <div className="h-24 animate-pulse bg-muted rounded-2xl" />
        </div>
        <div className="space-y-4">
          <div className="h-32 w-full animate-pulse bg-muted rounded-2xl" />
          <div className="h-32 w-full animate-pulse bg-muted rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-3xl font-bold mb-2"
            >
              Today's Tasks
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="text-muted-foreground flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
              })}
            </motion.p>
          </div>

          {projectsWhereCanCreateTasks.length > 0 && (
            <Button
              onClick={() => setShowTaskForm(true)}
              className="gradient-primary text-white hover:opacity-90"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Task
            </Button>
          )}
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm"
          >
            <div className="text-2xl font-bold text-primary mb-1">
              {needsActionTasks.length}
            </div>
            <div className="text-sm text-muted-foreground">Needs Action</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm"
          >
            <div className="text-2xl font-bold text-status-completed mb-1">
              {completedTasksForToday.length}
            </div>
            <div className="text-sm text-muted-foreground">Done</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm"
          >
            <div className="text-2xl font-bold text-muted-foreground mb-1">
              {recoveredTasks.length}
            </div>
            <div className="text-sm text-muted-foreground">Recovered</div>
          </motion.div>
        </div>

        {/* Needs Your Action */}
        {needsActionTasks.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              <h2 className="text-xl font-semibold">Needs Your Action</h2>
            </div>
            <div className="space-y-3">
              {needsActionTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  completionLogs={completionLogs}
                  onComplete={handleComplete}
                  showRecover={false}
                />
              ))}
            </div>
          </div>
        )}

        {/* Done for the Day */}
        {completedTasksForToday.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-accent" />
              <h2 className="text-xl font-semibold">Done for the Day</h2>
            </div>
            <div className="space-y-3 opacity-60">
              {completedTasksForToday.map((task) => (
                <TaskCard key={task.id} task={task} completionLogs={completionLogs} />
              ))}
            </div>
          </div>
        )}

        {/* Another Chance? */}
        {recoveredTasks.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-accent" />
              <h2 className="text-xl font-semibold">Another Chance?</h2>
            </div>
            <div className="space-y-3">
              {recoveredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  completionLogs={completionLogs}
                  onComplete={handleComplete}
                  showRecover={false}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {needsActionTasks.length === 0 && completedTasksForToday.length === 0 && recoveredTasks.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">All clear for today!</h3>
            <p className="text-muted-foreground mb-6">
              Start a new task or check out your projects
            </p>
            {projectsWhereCanCreateTasks.length > 0 && (
              <Button
                onClick={() => setShowTaskForm(true)}
                className="gradient-primary text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Task
              </Button>
            )}
          </motion.div>
        )}
      </div>

      <TaskForm
        open={showTaskForm}
        onOpenChange={setShowTaskForm}
        onSubmit={handleCreateTask}
        projects={projectsWhereCanCreateTasks}
        allowProjectSelection={true}
      />
    </>
  );
};

export default Index;
