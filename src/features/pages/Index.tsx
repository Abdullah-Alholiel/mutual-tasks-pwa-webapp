import { AppLayout } from '../../layout/AppLayout';
import { TaskCard } from '../tasks/components/TaskCard';
import { TaskForm } from '../tasks/components/TaskForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
import { getParticipatingUserIds } from '../../lib/tasks/taskCreationUtils';
import { getProjectsWhereCanCreateTasks } from '../../lib/projects/projectUtils';
import { notifyTaskUpdated } from '../../lib/tasks/taskEmailNotifications';
import { normalizeToStartOfDay } from '../../lib/tasks/taskUtils';
import { normalizeId, compareIds } from '../../lib/idUtils';
import { useAuth } from '../auth/useAuth';
import { useProjects } from '../projects/hooks/useProjects';
import {
  useCreateTaskWithStatuses,
  useCreateMultipleTasksWithStatuses,
  type CreateTaskWithStatusesInput,
  useTaskStatuses,
  useCompletionLogs
} from '../tasks/hooks/useTasks';
import { useCreateCompletionLog, useUpdateTaskStatus, useDeleteTask, useUpdateTask } from '../tasks/hooks/useTasks';
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
  const createTaskMutation = useCreateTaskWithStatuses();
  const createMultipleTasksMutation = useCreateMultipleTasksWithStatuses();
  const createCompletionLogMutation = useCreateCompletionLog();
  const updateTaskStatusMutation = useUpdateTaskStatus();
  const deleteTaskMutation = useDeleteTask();
  const updateTaskMutation = useUpdateTask();

  // Global realtime subscriptions are handled by GlobalRealtimeSubscriptions in AppLayout
  // No need to create subscriptions here - they're managed globally

  const { data: taskStatuses = [], isLoading: statusesLoading } = useTaskStatuses();
  const { data: completionLogs = [], isLoading: logsLoading } = useCompletionLogs();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<number | null>(null);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

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
      const project = allProjects.find(p => compareIds(p.id, task.projectId));
      if (!project) return false;

      const userIdNum = normalizeId(user.id);
      const isCreator = compareIds(task.creatorId, userIdNum);

      const isInProject = project.participantRoles?.some(pr => {
        return compareIds(pr.userId, userIdNum) && !pr.removedAt;
      }) || compareIds(project.ownerId, userIdNum) || isCreator;

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

    const userIdNum = normalizeId(user.id);
    const taskIdNum = normalizeId(taskId);
    const myTaskStatus = taskStatuses.find(ts => {
      return compareIds(ts.taskId, taskIdNum) && compareIds(ts.userId, userIdNum);
    });

    let currentTaskStatus = myTaskStatus;

    if (!currentTaskStatus) {
      // If task status doesn't exist, create it if the user is the creator or in project
      try {
        const db = getDatabaseClient();
        currentTaskStatus = await db.taskStatus.getByTaskAndUser(taskIdNum, userIdNum);

        if (!currentTaskStatus) {
          currentTaskStatus = await db.taskStatus.create({
            taskId: taskIdNum,
            userId: userIdNum,
            status: 'active',
            ringColor: undefined,
          });

          // Invalidate task statuses query to reflect new status
          queryClient.invalidateQueries({ queryKey: ['taskStatuses'] });
        }
      } catch (error) {
        console.error('Failed to create/fetch task status:', error);
        toast.error('Task status not found', {
          description: 'Failed to create task status record. Please try again.'
        });
        return;
      }
    }

    // Check if task is recovered
    const isRecovered = currentTaskStatus.recoveredAt !== undefined;
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
        userId: userIdNum,
        taskId: taskIdNum,
        difficultyRating: difficultyRating as 1 | 2 | 3 | 4 | 5 | undefined,
        penaltyApplied,
        xpEarned
      });

      // Update task status to completed
      await updateTaskStatusMutation.mutateAsync({
        id: currentTaskStatus.id,
        data: {
          status: 'completed',
          ringColor: isRecovered ? 'yellow' : (isOnOrBeforeDueDate ? 'green' : 'none')
        }
      });

      // Recalculate and update user stats based on all completion logs
      try {
        const db = getDatabaseClient();
        await db.users.recalculateStats(userIdNum, user.timezone || 'UTC');
        // Invalidate React Query cache for user stats so profile updates
        queryClient.invalidateQueries({ queryKey: ['user', 'current', 'stats', userIdNum] });
        queryClient.invalidateQueries({ queryKey: ['completionLogs', userIdNum] });
      } catch (statsError) {
        // Log error but don't fail the completion - stats update is secondary
        console.error('Failed to update user stats:', statsError);
      }

      // Invalidate task-related queries to ensure data freshness
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskStatuses'] });
      queryClient.invalidateQueries({ queryKey: ['taskStatuses', userIdNum] });

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
      if (!user) return;

      const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      const defaultDueDate = normalizeToStartOfDay(taskData.dueDate ?? new Date());

      const project = allProjects.find(p => p.id === taskData.projectId);
      if (!project) {
        toast.error('Project not found');
        return;
      }

      // Get all participant user IDs (creator + all active project members)
      const participantUserIds = getParticipatingUserIds(project, userId);

      if (taskData.type === 'habit' && taskData.dueDate && taskData.recurrencePattern) {
        // For habits, create multiple tasks
        const startDate = normalizeToStartOfDay(taskData.dueDate);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 28); // 28 days for habits

        const tasksToCreate: CreateTaskWithStatusesInput[] = [];
        let currentDate = new Date(startDate);

        while (currentDate <= endDate) {
          tasksToCreate.push({
            task: {
              projectId: typeof taskData.projectId === 'string' ? parseInt(taskData.projectId) : taskData.projectId,
              creatorId: userId,
              type: taskData.type,
              recurrencePattern: taskData.recurrencePattern,
              title: taskData.title,
              description: taskData.description,
              dueDate: normalizeToStartOfDay(new Date(currentDate))
            },
            participantUserIds,
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
        await createMultipleTasksMutation.mutateAsync(tasksToCreate);

        toast.success(`${tasksToCreate.length} habit tasks created! 🚀`, {
          description: 'Statuses created for all participants'
        });
      } else {
        // One-off task
        await createTaskMutation.mutateAsync({
          task: {
            projectId: typeof taskData.projectId === 'string' ? parseInt(taskData.projectId) : taskData.projectId,
            creatorId: userId,
            type: taskData.type,
            recurrencePattern: taskData.recurrencePattern,
            title: taskData.title,
            description: taskData.description,
            dueDate: defaultDueDate
          },
          participantUserIds,
          dueDate: defaultDueDate
        });

        toast.success('Task created! 🚀', {
          description: 'Statuses created for all participants'
        });
      }

      setShowTaskForm(false);
    } catch (error) {
      toast.error('Failed to create task');
      console.error(error);
    }
  };

  const handleDeleteTask = async (taskId: string | number) => {
    const taskIdNum = typeof taskId === 'string' ? parseInt(taskId) : taskId;
    setTaskToDelete(taskIdNum);
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;

    try {
      await deleteTaskMutation.mutateAsync(taskToDelete);
      // Invalidate queries to refresh dashboard data
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setTaskToDelete(null);
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleUpdateTask = async (taskData: {
    title: string;
    description: string;
    type: 'one_off' | 'habit';
    recurrencePattern?: 'Daily' | 'weekly' | 'custom';
    dueDate?: Date;
  }) => {
    if (!taskToEdit) return;

    try {
      await updateTaskMutation.mutateAsync({
        id: taskToEdit.id,
        data: {
          title: taskData.title,
          description: taskData.description,
          type: taskData.type,
          recurrencePattern: taskData.recurrencePattern,
          dueDate: taskData.dueDate,
        }
      });

      // Invalidate queries to refresh dashboard data
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setTaskToEdit(null);
      setShowTaskForm(false);
      // Send update notification
      if (user) {
        notifyTaskUpdated(
          taskToEdit.id,
          taskToEdit.projectId,
          typeof user.id === 'string' ? parseInt(user.id) : user.id
        ).catch(err => {
          console.error('Failed to send task update notification:', err);
        });
      }

      toast.success('Task updated! ✨');
    } catch (error) {
      console.error('Failed to update task:', error);
      toast.error('Failed to update task');
    }
  };

  const getOnEditTask = (task: Task) => {
    if (!user) return undefined;
    const project = allProjects.find(p => compareIds(p.id, task.projectId));
    if (!project) return undefined;

    const userIdNum = normalizeId(user.id);
    const isCreator = compareIds(task.creatorId, userIdNum);
    const isOwner = compareIds(project.ownerId, userIdNum);
    const isManager = project.participantRoles?.some(pr =>
      compareIds(pr.userId, userIdNum) && (pr.role === 'manager' || pr.role === 'owner') && !pr.removedAt
    );

    if (isOwner || isManager || isCreator) {
      return (t: Task) => {
        setTaskToEdit(t);
        setShowTaskForm(true);
      };
    }
    return undefined;
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
              className="gradient-primary text-white hover:shadow-md hover:shadow-primary/20 rounded-full h-10 px-3.5 text-sm font-semibold transition-all duration-300 hover:translate-y-[-1px] active:translate-y-[0px]"
            >
              <Plus className="w-4 h-4 mr-1.5" />
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
            className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm text-center"
          >
            <div className="text-2xl font-bold text-primary mb-1">
              {needsActionTasks.length}
            </div>
            <div className="text-sm text-muted-foreground">Active</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm text-center"
          >
            <div className="text-2xl font-bold text-status-completed mb-1">
              {completedTasksForToday.length}
            </div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm text-center"
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
            {/* Optimized task container for smooth scrolling */}
            <div
              className="space-y-3"
              style={{
                transform: 'translateZ(0)',
                willChange: 'contents',
              }}
            >
              {needsActionTasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    contain: 'layout style',
                    contentVisibility: 'auto',
                    containIntrinsicSize: '0 180px',
                  }}
                >
                  <TaskCard
                    task={task}
                    completionLogs={completionLogs}
                    onComplete={handleComplete}
                    showRecover={false}
                    onDelete={handleDeleteTask}
                    onEdit={getOnEditTask(task)}
                  />
                </div>
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
            {/* Optimized task container for smooth scrolling */}
            <div
              className="space-y-3 opacity-60"
              style={{
                transform: 'translateZ(0)',
                willChange: 'contents',
              }}
            >
              {completedTasksForToday.map((task) => (
                <div
                  key={task.id}
                  style={{
                    contain: 'layout style',
                    contentVisibility: 'auto',
                    containIntrinsicSize: '0 180px',
                  }}
                >
                  <TaskCard
                    task={task}
                    completionLogs={completionLogs}
                    onDelete={handleDeleteTask}
                    onEdit={getOnEditTask(task)}
                  />
                </div>
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
            {/* Optimized task container for smooth scrolling */}
            <div
              className="space-y-3"
              style={{
                transform: 'translateZ(0)',
                willChange: 'contents',
              }}
            >
              {recoveredTasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    contain: 'layout style',
                    contentVisibility: 'auto',
                    containIntrinsicSize: '0 180px',
                  }}
                >
                  <TaskCard
                    task={task}
                    completionLogs={completionLogs}
                    onComplete={handleComplete}
                    showRecover={false}
                    onDelete={handleDeleteTask}
                    onEdit={getOnEditTask(task)}
                  />
                </div>
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
        onOpenChange={(open) => {
          setShowTaskForm(open);
          if (!open) setTaskToEdit(null);
        }}
        initialTask={taskToEdit || undefined}
        onSubmit={(taskData) => {
          if (taskToEdit) {
            handleUpdateTask(taskData);
          } else {
            handleCreateTask(taskData);
          }
        }}
        projects={projectsWhereCanCreateTasks}
        allowProjectSelection={true}
      />

      {/* Delete Task Confirmation Dialog */}
      <Dialog open={taskToDelete !== null} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Delete task?</DialogTitle>
            <DialogDescription className="pt-2 text-base">
              Are you sure you want to delete this task? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTaskToDelete(null)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDeleteTask}
              className="rounded-xl px-8"
            >
              Delete Task
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Index;
