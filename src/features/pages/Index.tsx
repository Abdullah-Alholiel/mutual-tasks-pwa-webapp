// import { AppLayout } from '../../layout/AppLayout';
import { TaskCard } from '../tasks/components/TaskCard';
import { TaskForm } from '../tasks/components/TaskForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { AnimatePresence, motion } from 'framer-motion';
import { Archive, Calendar, CheckCircle2, Clock, Plus, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { TaskStatCard } from '../../components/TaskStatCard';
import { TaskCalendar } from '../../components/TaskCalendar';
import { useEffect, useMemo, useState } from 'react';
import { toast } from '@/components/ui/sonner';
import type { Task, User, ProjectParticipant, Project } from '../../types';
import {
  getNeedsActionTasks,
  getCompletedTasksForToday,
  getRecoveredTasks,
  getUpcomingTasksForDate,
  getArchivedTasksForDate,
  updateTasksWithStatuses,
} from '../../lib/tasks/taskFilterUtils';
import { recoverTask } from '../../lib/tasks/taskRecoveryUtils';
import { getParticipatingUserIds } from '../../lib/tasks/taskCreationUtils';
import { getProjectsWhereCanCreateTasks } from '../../lib/projects/projectUtils';
import { notifyTaskUpdated } from '../../lib/tasks/taskEmailNotifications';
import { normalizeToStartOfDay, canEditTask, calculateTaskStatusUserStatus } from '../../lib/tasks/taskUtils';
import { normalizeId, compareIds } from '../../lib/idUtils';
import { useAuth } from '../auth/useAuth';
import { useProjects, useCreateProject } from '../projects/hooks/useProjects';
import {
  useCreateTaskWithStatuses,
  useCreateMultipleTasksWithStatuses,
  type CreateTaskWithStatusesInput,
  useTaskStatuses,
  useProjectCompletionLogs
} from '../tasks/hooks/useTasks';
import { useCreateCompletionLog, useUpdateTaskStatus, useDeleteTask, useUpdateTask } from '../tasks/hooks/useTasks';
import { useTodayTasks, useUserTasks } from '../tasks/hooks/useTasks';
import { useIsRestoring, useQueryClient } from '@tanstack/react-query';
import { getDatabaseClient } from '@/db';
import { TASK_CONFIG } from '@/config/appConfig';
import { useNavigate } from 'react-router-dom';
import { ProjectForm } from '../projects/components/ProjectForm';
import { EmptyState } from '@/components/ui/empty-state';
import { useRef } from 'react';
import { useTaskViewModal } from '../tasks/hooks/useTaskViewModal';

// Global realtime subscriptions are handled by GlobalRealtimeSubscriptions in AppLayout

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24
    }
  }
};

interface IndexProps {
  isInternalSlide?: boolean;
  isActive?: boolean;
}

const Index = ({ isInternalSlide: _isInternalSlide }: IndexProps) => {
  const { user, isAuthenticated } = useAuth();
  const isRestoring = useIsRestoring();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: allProjects = [], isLoading: projectsLoading } = useProjects();
  const { data: todayTasksRaw = [], isLoading: tasksLoading } = useTodayTasks();
  const { data: allUserTasks = [], isLoading: _allTasksLoading } = useUserTasks(); // For recovered tasks and date filtering
  const createTaskMutation = useCreateTaskWithStatuses();
  const createMultipleTasksMutation = useCreateMultipleTasksWithStatuses();
  const createCompletionLogMutation = useCreateCompletionLog();
  const updateTaskStatusMutation = useUpdateTaskStatus();
  const deleteTaskMutation = useDeleteTask();
  const updateTaskMutation = useUpdateTask();
  const createProjectMutation = useCreateProject();

  // Calendar date filtering
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  // Global realtime subscriptions are handled by GlobalRealtimeSubscriptions in AppLayout
  // No need to create subscriptions here - they're managed globally

  const { data: taskStatuses = [] } = useTaskStatuses();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<number | null>(null);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const { openTaskViewByTaskId } = useTaskViewModal();
  const createdTaskRef = useRef<{ task: Task; projectId: number } | null>(null);

  const [statusFilter, setStatusFilter] = useState<'active' | 'completed' | 'recovered' | 'upcoming' | 'archived' | null>(null);
  const handleStatusFilter = (status: 'active' | 'completed' | 'recovered' | 'upcoming' | 'archived') => {
    setStatusFilter(prev => prev === status ? null : status);
  };

  // When the user picks a new date, reset the status filter so all sections show
  const handleDateChange = (date: Date | undefined) => {
    setSelectedDate(date);
    setStatusFilter(null);
  };

  // Update tasks with their statuses
  const tasksWithStatuses = useMemo(() =>
    updateTasksWithStatuses(todayTasksRaw, taskStatuses),
    [todayTasksRaw, taskStatuses]
  );

  // Update ALL user tasks with their statuses (for finding recovered tasks and date filtering)
  const allTasksWithStatuses = useMemo(() =>
    updateTasksWithStatuses(allUserTasks, taskStatuses),
    [allUserTasks, taskStatuses]
  );

  // Get all task IDs to fetch completion logs for ALL participants (not just current user)
  const allTaskIds = useMemo(() => {
    return allTasksWithStatuses
      .map(task => typeof task.id === 'string' ? parseInt(task.id) : task.id)
      .filter(id => !isNaN(id));
  }, [allTasksWithStatuses]);

  // Fetch completion logs for all tasks (includes all participants' completions)
  const { data: completionLogs = [] } = useProjectCompletionLogs(allTaskIds);

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

  // side effect: Auto-sync overdue tasks to 'archived' status in DB
  useEffect(() => {
    if (!user || tasksLoading || allTasksWithStatuses.length === 0) return;

    const overdueToUpdate = allTasksWithStatuses.filter(task => {
      const userIdNum = normalizeId(user.id);
      const taskIdNum = normalizeId(task.id);

      const myStatus = taskStatuses.find(ts =>
        compareIds(ts.taskId, taskIdNum) && compareIds(ts.userId, userIdNum)
      );

      // Only sync if DB status is 'active' or 'upcoming'
      // and NOT completed (no completion log)
      if (!myStatus || (myStatus.status !== 'active' && myStatus.status !== 'upcoming')) return false;

      const myCompletion = completionLogs.find(cl =>
        compareIds(cl.taskId, taskIdNum) && compareIds(cl.userId, userIdNum)
      );

      if (myCompletion) return false;

      const computedStatus = calculateTaskStatusUserStatus(myStatus, myCompletion, task);
      return computedStatus === 'archived';
    });

    if (overdueToUpdate.length > 0) {
      console.log(`[Index] 🔄 Auto-archiving ${overdueToUpdate.length} overdue tasks...`);
      overdueToUpdate.forEach(task => {
        const userIdNum = normalizeId(user.id);
        const taskIdNum = normalizeId(task.id);
        const myStatus = taskStatuses.find(ts =>
          compareIds(ts.taskId, taskIdNum) && compareIds(ts.userId, userIdNum)
        )!;

        updateTaskStatusMutation.mutate({
          id: myStatus.id,
          data: {
            status: 'archived',
            archivedAt: new Date(),
            ringColor: 'red' // Overdue tasks should show red ring
          }
        });
      });
    }
  }, [allTasksWithStatuses, user, tasksLoading, taskStatuses, completionLogs]);

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
        currentTaskStatus = await db.taskStatus.getByTaskAndUser(taskIdNum, userIdNum) ?? undefined;

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
    // - Recovered tasks: ALWAYS give fixed RECOVERED_XP
    // - Late tasks (not recovered): give half of base XP
    // - On-time tasks: give full base XP
    const baseXP = TASK_CONFIG.BASE_XP;
    let xpEarned: number;
    let penaltyApplied: boolean;

    if (isRecovered) {
      // Recovered tasks always give fixed XP
      xpEarned = TASK_CONFIG.RECOVERED_XP;
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

      // Note: Data consistency validation is handled by useProjectTaskMutations.ts
      // when completing tasks from the project detail view. For today's view completions,
      // we rely on the same database operations to maintain consistency.

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
      queryClient.invalidateQueries({ queryKey: ['completionLogs', 'tasks'] });

      toast.success('Great job!', {
        description: penaltyApplied
          ? 'Waiting for your partners to complete... (Half XP - Recovered)'
          : 'Waiting for your partners to complete...',
        action: {
          label: "View",
          onClick: () => {
            // Use openTaskViewByTaskId to fetch fresh data after completion
            const viewTaskId = typeof taskId === 'string' ? parseInt(taskId) : taskId;
            openTaskViewByTaskId(viewTaskId);
          }
        }
      });
    } catch (error) {
      toast.error('Failed to complete task');
      console.error(error);
    }
  };

  // Determine if a specific date is selected (not today's default view)
  const isDateSelected = selectedDate !== undefined;
  const isToday = useMemo(() => {
    if (!selectedDate) return true;
    const today = normalizeToStartOfDay(new Date());
    const selected = normalizeToStartOfDay(selectedDate);
    return selected.getTime() === today.getTime();
  }, [selectedDate]);

  // Filter tasks using date-aware utilities for the selected date's view sections
  const needsActionTasks = useMemo(() =>
    user ? getNeedsActionTasks(
      allTasksWithStatuses, taskStatuses, completionLogs, user.id,
      projectsWithRoles, selectedDate
    ) : [],
    [allTasksWithStatuses, taskStatuses, completionLogs, projectsWithRoles, user, selectedDate]
  );

  const completedTasksForToday = useMemo(() =>
    user ? getCompletedTasksForToday(
      allTasksWithStatuses, completionLogs, user.id, selectedDate, taskStatuses
    ) : [],
    [allTasksWithStatuses, completionLogs, user, selectedDate, taskStatuses]
  );

  // Use allTasksWithStatuses for recovered tasks since they have past due dates
  // Recovered tasks show on the recovery date, not the original due date
  const recoveredTasks = useMemo(() =>
    user ? getRecoveredTasks(
      allTasksWithStatuses, taskStatuses, completionLogs, user.id,
      projectsWithRoles, selectedDate
    ) : [],
    [allTasksWithStatuses, taskStatuses, completionLogs, projectsWithRoles, user, selectedDate]
  );

  // Upcoming tasks: tasks due after the selected date
  const upcomingTasks = useMemo(() =>
    user ? getUpcomingTasksForDate(
      allTasksWithStatuses, taskStatuses, completionLogs, user.id,
      projectsWithRoles, selectedDate
    ) : [],
    [allTasksWithStatuses, taskStatuses, completionLogs, projectsWithRoles, user, selectedDate]
  );

  // Archived tasks: past-due tasks that weren't completed or recovered
  const archivedTasks = useMemo(() =>
    user ? getArchivedTasksForDate(
      allTasksWithStatuses, taskStatuses, completionLogs, user.id,
      projectsWithRoles, selectedDate
    ) : [],
    [allTasksWithStatuses, taskStatuses, completionLogs, projectsWithRoles, user, selectedDate]
  );

  // Handle recover for archived tasks (same pattern as project detail page)
  const handleRecover = async (taskId: string | number) => {
    if (!user) return;

    const taskIdNum = typeof taskId === 'string' ? parseInt(taskId) : taskId;
    const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;

    const result = recoverTask(String(taskIdNum), String(userId), allTasksWithStatuses, taskStatuses);

    if (!result || !result.success) {
      toast.error('Cannot recover this task');
      return;
    }

    try {
      const db = getDatabaseClient();

      // Persist task status update to database
      if (result.updatedTaskStatus) {
        await db.taskStatus.updateByTaskAndUser(taskIdNum, userId, {
          status: 'recovered',
          recoveredAt: result.updatedTaskStatus.recoveredAt,
          archivedAt: undefined,
          ringColor: 'yellow',
        });
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskStatuses'] });
      queryClient.invalidateQueries({ queryKey: ['completionLogs', 'tasks'] });

      toast.success('Back on the list! 🔙', {
        description: 'Complete it today to earn XP.',
      });
    } catch (error) {
      console.error('Failed to recover task:', error);
      toast.error('Failed to recover task');
    }
  };

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
      const defaultDueDate = taskData.dueDate ?? new Date();

      const project = allProjects.find(p => p.id === taskData.projectId);
      if (!project) {
        toast.error('Project not found');
        return;
      }

      // Get all participant user IDs (creator + all active project members)
      const participantUserIds = getParticipatingUserIds(project, userId);

      if (taskData.type === 'habit' && taskData.dueDate && taskData.recurrencePattern) {
        // For habits, create multiple tasks
        const startDate = taskData.dueDate;
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 28); // 28 days for habits

        const tasksToCreate: CreateTaskWithStatusesInput[] = [];
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
          tasksToCreate.push({
            task: {
              projectId: typeof taskData.projectId === 'string' ? parseInt(taskData.projectId) : taskData.projectId,
              creatorId: userId,
              type: taskData.type,
              recurrencePattern: taskData.recurrencePattern,
              title: taskData.title,
              description: taskData.description,
              dueDate: new Date(currentDate)
            },
            participantUserIds,
            dueDate: new Date(currentDate)
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
          description: 'Statuses created for all participants',
          action: {
            label: "View",
            onClick: () => {
              // Navigate to project since multiple tasks were created
              const projectId = typeof taskData.projectId === 'string'
                ? parseInt(taskData.projectId)
                : taskData.projectId;
              navigate(`/projects/${projectId}`);
            },
          },
        });
      } else {
        // One-off task
        const creationResult = await createTaskMutation.mutateAsync({
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

        const createdTask = creationResult.task;

        // Store reference for toast action
        createdTaskRef.current = {
          task: {
            ...createdTask,
            id: typeof createdTask.id === 'string' ? parseInt(createdTask.id) : createdTask.id
          },
          projectId: typeof taskData.projectId === 'string' ? parseInt(taskData.projectId) : taskData.projectId
        };

        toast.success('Task created! 🚀', {
          description: 'Statuses created for all participants',
          action: {
            label: "View",
            onClick: () => {
              if (createdTaskRef.current?.task) {
                const taskId = typeof createdTaskRef.current.task.id === 'string'
                  ? parseInt(createdTaskRef.current.task.id)
                  : createdTaskRef.current.task.id;
                openTaskViewByTaskId(taskId);
              }
            },
          },
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

      const updatedTask = taskToEdit; // Capture current task state before clearing
      toast.success('Task updated! ✨', {
        action: {
          label: "View",
          onClick: () => {
            if (updatedTask) {
              const taskId = typeof updatedTask.id === 'string'
                ? parseInt(updatedTask.id)
                : updatedTask.id;
              openTaskViewByTaskId(taskId);
            }
          },
        },
      });
    } catch (error) {
      console.error('Failed to update task:', error);
      toast.error('Failed to update task');
    }
  };

  const createProjectWithParticipants = async (projectData: {
    name: string;
    description: string;
    participants: string[];
    color: string;
    isPublic: boolean;
    icon: string;
  }) => {
    if (!user || !isAuthenticated) {
      toast.error('You must be logged in to create a project');
      return;
    }

    try {
      // Create project with owner ID
      const ownerId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      const newProject = await createProjectMutation.mutateAsync({
        name: projectData.name,
        description: projectData.description,
        ownerId,
        totalTasks: 0,
        isPublic: projectData.isPublic,
        color: projectData.color,
        icon: projectData.icon
      });

      // Add participants if provided
      const updatedParticipants: User[] = [];
      const updatedRoles: ProjectParticipant[] = [];

      // Add owner (current user) to the local state lists
      if (user) {
        updatedParticipants.push(user);
        updatedRoles.push({
          projectId: newProject.id,
          userId: ownerId,
          role: 'owner',
          addedAt: new Date(),
          user: user
        });
      }

      if (projectData.participants.length > 0) {
        const db = getDatabaseClient();
        const projectId = typeof newProject.id === 'string' ? parseInt(newProject.id) : newProject.id;

        // Add participants
        for (const participantIdStr of projectData.participants) {
          const participantId = typeof participantIdStr === 'string' ? parseInt(participantIdStr) : participantIdStr;

          // Check if user exists
          const participantUser = await db.users.getById(participantId);
          if (!participantUser) {
            toast.error(`User with ID ${participantIdStr} not found`);
            continue;
          }

          // Add as participant
          await db.projects.addParticipant(projectId, participantId, 'participant');

          // Add to local lists for UI state
          updatedParticipants.push(participantUser);
          updatedRoles.push({
            projectId: newProject.id,
            userId: participantId,
            role: 'participant',
            addedAt: new Date(),
            user: participantUser
          });
        }
      }

      // Construct updated project object with participants for immediate UI feedback
      const projectWithParticipants = {
        ...newProject,
        participants: updatedParticipants,
        participantRoles: updatedRoles
      };

      // Seed React Query cache so ProjectDetail finds data immediately
      queryClient.setQueryData(['project', String(newProject.id)], projectWithParticipants);
      queryClient.setQueryData(['project', Number(newProject.id)], projectWithParticipants);

      return projectWithParticipants;
    } catch (error) {
      console.error('Failed to create project:', error);
      toast.error('Failed to create project');
      return undefined;
    }
  };

  const handleCreateProject = async (projectData: {
    name: string;
    description: string;
    participants: string[];
    color: string;
    isPublic: boolean;
    icon: string;
  }) => {
    const newProject = await createProjectWithParticipants(projectData);
    if (newProject) {
      setShowProjectForm(false);
      // Navigate to the new project
      navigate(`/projects/${newProject.id}`, { state: { project: newProject } });
    }
  };

  const handleCreateProjectForTask = async (projectData: {
    name: string;
    description: string;
    participants: string[];
    color: string;
    isPublic: boolean;
    icon: string;
  }) => {
    return await createProjectWithParticipants(projectData);
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

    // Only upcoming, active, and recovered tasks can be edited/deleted.
    const myTaskStatus = task.taskStatus?.find(ts => compareIds(ts.userId, user.id));
    const myCompletion = completionLogs.find(log =>
      compareIds(log.taskId, task.id) && compareIds(log.userId, user.id)
    );

    // Check if task is editable
    if (!canEditTask(myTaskStatus, myCompletion, task)) {
      return undefined;
    }

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
  // We no longer block the whole page on loading
  // SWR pattern: show cached data instantly if available
  const isInitialLoading = isRestoring ||
    (tasksLoading && todayTasksRaw.length === 0) ||
    (projectsLoading && allProjects.length === 0);

  if (isInitialLoading) {
    return (
      <div className="space-y-3 p-4 animate-fade-in">
        <div className="h-10 w-40 animate-pulse bg-muted rounded-lg" />
        <div className="h-[72px] w-full animate-pulse bg-muted rounded-2xl" />
        <div className="flex justify-center gap-2">
          <div className="h-7 w-20 animate-pulse bg-muted rounded-full" />
          <div className="h-7 w-24 animate-pulse bg-muted rounded-full" />
          <div className="h-7 w-24 animate-pulse bg-muted rounded-full" />
        </div>
        <div className="space-y-4">
          <div className="h-16 w-full animate-pulse bg-muted rounded-2xl" />
          <div className="h-16 w-full animate-pulse bg-muted rounded-2xl" />
          <div className="h-16 w-full animate-pulse bg-muted rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-2xl font-bold"
            >
              Home
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xs text-muted-foreground flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              {isToday ? 'Today • ' : ''}
              {(selectedDate ?? new Date()).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
              })}
            </motion.p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gradient-primary text-white hover:shadow-md hover:shadow-primary/20 rounded-full h-10 px-4 text-sm font-semibold transition-all duration-300 hover:translate-y-[-1px] active:translate-y-[0px]">
                <Plus className="w-4 h-4 mr-0 sm:mr-1.5" />
                <span className="hidden sm:inline">New</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => setShowTaskForm(true)}>
                New Task
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowProjectForm(true)}>
                New Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mini Calendar */}
        <TaskCalendar
          onDateChange={handleDateChange}
          selectedDate={selectedDate}
        />

        {/* Stats Overview — below calendar, only show tags with count > 0 */}
        <div className="flex items-center justify-center gap-2 w-full flex-wrap">
          {needsActionTasks.length > 0 && (
            <TaskStatCard
              count={needsActionTasks.length}
              label="Active"
              color="text-primary"
              delay={0.3}
              onClick={() => handleStatusFilter('active')}
              isActive={statusFilter === 'active'}
            />
          )}
          {upcomingTasks.length > 0 && (
            <TaskStatCard
              count={upcomingTasks.length}
              label="Upcoming"
              color="text-status-upcoming"
              delay={0.32}
              onClick={() => handleStatusFilter('upcoming')}
              isActive={statusFilter === 'upcoming'}
            />
          )}
          {completedTasksForToday.length > 0 && (
            <TaskStatCard
              count={completedTasksForToday.length}
              label="Completed"
              color="text-status-completed"
              delay={0.35}
              onClick={() => handleStatusFilter('completed')}
              isActive={statusFilter === 'completed'}
            />
          )}
          {recoveredTasks.length > 0 && (
            <TaskStatCard
              count={recoveredTasks.length}
              label="Recovered"
              color="text-status-recovered"
              delay={0.37}
              onClick={() => handleStatusFilter('recovered')}
              isActive={statusFilter === 'recovered'}
            />
          )}
          {archivedTasks.length > 0 && (
            <TaskStatCard
              count={archivedTasks.length}
              label="Archived"
              color="text-status-archived"
              delay={0.4}
              onClick={() => handleStatusFilter('archived')}
              isActive={statusFilter === 'archived'}
            />
          )}
        </div>

        <AnimatePresence mode="popLayout" initial={false}>
          {/* Needs Your Action */}
          {(statusFilter === null || statusFilter === 'active') && needsActionTasks.length > 0 && (
            <motion.div
              key="active-section"
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4 overflow-hidden"
              style={{
                transform: 'translateZ(0)',
                willChange: 'opacity, height'
              }}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold">Needs Your Action</h2>
              </div>
              {/* Optimized task container for smooth scrolling */}
              <motion.div
                className="space-y-3"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                style={{
                  transform: 'translateZ(0)',
                  willChange: 'contents',
                }}
              >
                {needsActionTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    variants={itemVariants}
                    style={{
                      contain: 'layout style',
                      contentVisibility: 'auto',
                      containIntrinsicSize: '0 185px', // Production: 180px active cards
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
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* Another Chance ? */}
          {(statusFilter === null || statusFilter === 'recovered') && recoveredTasks.length > 0 && (
            <motion.div
              layout
              key="recovered-section"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4 overflow-hidden"
              style={{
                transform: 'translateZ(0)',
                willChange: 'opacity, height'
              }}
            >
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-status-recovered" />
                <h2 className="text-xl font-bold">Another Chance?</h2>
              </div>
              {/* Optimized task container for smooth scrolling */}
              <motion.div
                className="space-y-3"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                style={{
                  transform: 'translateZ(0)',
                  willChange: 'contents',
                }}
              >
                {recoveredTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    variants={itemVariants}
                    style={{
                      contain: 'layout style',
                      contentVisibility: 'auto',
                      containIntrinsicSize: '0 185px', // Production: 180px active cards
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
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* Done for the Day */}
          {(statusFilter === null || statusFilter === 'completed') && completedTasksForToday.length > 0 && (
            <motion.div
              layout
              key="completed-section"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4 overflow-hidden"
              style={{
                transform: 'translateZ(0)',
                willChange: 'opacity, height'
              }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-status-completed" />
                <h2 className="text-xl font-bold">Done for the Day</h2>
              </div>
              {/* Optimized task container for smooth scrolling */}
              <motion.div
                className="space-y-3 opacity-60"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                style={{
                  transform: 'translateZ(0)',
                  willChange: 'contents',
                }}
              >
                {completedTasksForToday.map((task) => (
                  <motion.div
                    key={task.id}
                    variants={itemVariants}
                    style={{
                      contain: 'layout style',
                      contentVisibility: 'auto',
                      containIntrinsicSize: '0 145px', // Production: 140px completed cards
                    }}
                  >
                    <TaskCard
                      task={task}
                      completionLogs={completionLogs}
                      onDelete={handleDeleteTask}
                      onEdit={getOnEditTask(task)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* Coming Up */}
          {(statusFilter === null || statusFilter === 'upcoming') && upcomingTasks.length > 0 && (
            <motion.div
              layout
              key="upcoming-section"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4 overflow-hidden"
              style={{
                transform: 'translateZ(0)',
                willChange: 'opacity, height'
              }}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-status-upcoming" />
                <h2 className="text-xl font-bold">Coming Up</h2>
              </div>
              <motion.div
                className="space-y-3 opacity-80"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                style={{
                  transform: 'translateZ(0)',
                  willChange: 'contents',
                }}
              >
                {upcomingTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    variants={itemVariants}
                    style={{
                      contain: 'layout style',
                      contentVisibility: 'auto',
                      containIntrinsicSize: '0 185px',
                    }}
                  >
                    <TaskCard
                      task={task}
                      completionLogs={completionLogs}
                      showRecover={false}
                      onDelete={handleDeleteTask}
                      onEdit={getOnEditTask(task)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* Archived */}
          {(statusFilter === null || statusFilter === 'archived') && archivedTasks.length > 0 && (
            <motion.div
              layout
              key="archived-section"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4 overflow-hidden"
              style={{
                transform: 'translateZ(0)',
                willChange: 'opacity, height'
              }}
            >
              <div className="flex items-center gap-2">
                <Archive className="w-5 h-5 text-status-archived" />
                <h2 className="text-xl font-bold">Left Behind</h2>
              </div>
              <motion.div
                className="space-y-3 opacity-50"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                style={{
                  transform: 'translateZ(0)',
                  willChange: 'contents',
                }}
              >
                {archivedTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    variants={itemVariants}
                    style={{
                      contain: 'layout style',
                      contentVisibility: 'auto',
                      containIntrinsicSize: '0 185px',
                    }}
                  >
                    <TaskCard
                      task={task}
                      completionLogs={completionLogs}
                      showRecover={true}
                      onRecover={handleRecover}
                      onDelete={handleDeleteTask}
                      onEdit={getOnEditTask(task)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* Active Empty State */}
          {statusFilter === 'active' && needsActionTasks.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <EmptyState
                title={isDateSelected && !isToday ? 'No active tasks for this date' : 'No active tasks'}
                description={
                  isDateSelected && !isToday
                    ? `No tasks due on ${(selectedDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Why not create a new challenge? 🚀`
                    : "You're all caught up! Why not create a new challenge and invite a friend? Momentum starts with you! 🚀"
                }
                icon={Sparkles}
                action={{
                  label: "New Task",
                  onClick: () => setShowTaskForm(true),
                  icon: <Plus className="w-4 h-4" />
                }}
              />
            </motion.div>
          )}

          {/* Recovered Empty State */}
          {statusFilter === 'recovered' && recoveredTasks.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <EmptyState
                title={isDateSelected && !isToday ? 'No recovered tasks for this date' : 'No recovered tasks'}
                description={
                  isDateSelected && !isToday
                    ? "No recovered tasks for this date. You're staying on top of your goals! 🔥"
                    : "You're staying on top of your goals! No tasks need recovering. Keep up the great streak! 🔥"
                }
                icon={RotateCcw}
              />
            </motion.div>
          )}

          {/* Upcoming Empty State */}
          {statusFilter === 'upcoming' && upcomingTasks.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <EmptyState
                title="No upcoming tasks"
                description={`No tasks scheduled for ${(selectedDate ?? new Date()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Create a new task to stay productive! 🚀`}
                icon={Clock}
                action={{
                  label: "New Task",
                  onClick: () => setShowTaskForm(true),
                  icon: <Plus className="w-4 h-4" />
                }}
              />
            </motion.div>
          )}

          {/* Archived Empty State */}
          {statusFilter === 'archived' && archivedTasks.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <EmptyState
                title="No archived tasks"
                description="No overdue tasks! You're crushing it! 🌟"
                icon={Archive}
              />
            </motion.div>
          )}

          {/* Completed Empty State */}
          {statusFilter === 'completed' && completedTasksForToday.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <EmptyState
                title={isDateSelected && !isToday ? 'No completed tasks for this date' : 'No completed tasks yet'}
                description={
                  isDateSelected && !isToday
                    ? `No tasks completed on ${(selectedDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`
                    : "Nothing completed yet today. Tackle a small task to get the ball rolling! You got this! 💪"
                }
                icon={CheckCircle2}
              />
            </motion.div>
          )}
        </AnimatePresence>
        {statusFilter === null && needsActionTasks.length === 0 && completedTasksForToday.length === 0 && recoveredTasks.length === 0 && upcomingTasks.length === 0 && archivedTasks.length === 0 && (
          <EmptyState
            title={isDateSelected && !isToday ? 'All clear for this date!' : 'All clear for today!'}
            description={
              isDateSelected && !isToday
                ? `No tasks for ${(selectedDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Ready to create something new?`
                : 'Ready to conquer the day? Start a new task or check out your projects.'
            }
            action={{
              label: "New",
              onClick: () => setShowTaskForm(true),
              icon: <Plus className="w-4 h-4" />
            }}
          />
        )}
      </div >

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
        onCreateProject={handleCreateProjectForTask}
      />

      <ProjectForm
        open={showProjectForm}
        onOpenChange={(open) => {
          setShowProjectForm(open);
        }}
        onSubmit={handleCreateProject}
        currentUser={user!}
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

