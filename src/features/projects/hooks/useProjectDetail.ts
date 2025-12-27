import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import type {
  Task,
  Project,
  DifficultyRating,
  TaskStatusEntity,
  TaskStatus,
  ProjectParticipant,
  CompletionLog,
  User,
  ProjectRole
} from '@/types';
import {
  getProjectTasks,
  updateTasksWithStatuses
} from '@/lib/tasks/taskFilterUtils';
import { calculateProjectProgress } from '@/lib/projects/projectUtils';
import { normalizeToStartOfDay, calculateRingColor, calculateTaskStatusUserStatus } from '@/lib/tasks/taskUtils';
import { recoverTask } from '../../../lib/tasks/taskRecoveryUtils';
import { validateProjectForTaskCreation } from '@/lib/tasks/taskCreationUtils';
import { handleError } from '@/lib/errorUtils';
import { findUserByIdentifier, validateHandleFormat } from '@/lib/userUtils';
import { notifyTaskCreated } from '@/lib/tasks/taskEmailNotifications';
import { useAuth } from '../../auth/useAuth';
import { useProject } from './useProjects';
import { 
  useProjectTasks, 
  useProjectCompletionLogs,
  useCreateTaskWithStatuses,
  useCreateMultipleTasksWithStatuses,
  type CreateTaskWithStatusesInput
} from '../../tasks/hooks/useTasks';
import { getDatabaseClient } from '@/db';
import { useQueryClient } from '@tanstack/react-query';

export const useProjectDetail = () => {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const projectFromState = location.state?.project as Project | undefined;
  const projectParticipantsFromState = location.state?.projectParticipants as ProjectParticipant[] | undefined;

  // Fetch project from database
  const { data: projectFromDb, isLoading: projectLoading } = useProject(id);
  const currentProject = projectFromState || projectFromDb;

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [showEditProjectForm, setShowEditProjectForm] = useState(false);
  const [showLeaveProjectDialog, setShowLeaveProjectDialog] = useState(false);
  const [showDeleteProjectDialog, setShowDeleteProjectDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [memberIdentifier, setMemberIdentifier] = useState('');

  // Fetch project tasks from database
  const { data: projectTasksFromDb = [], isLoading: tasksLoading, isFetched: tasksFetched } = useProjectTasks(id);
  
  // Local state for optimistic updates (initialized from React Query data)
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const [localTaskStatuses, setLocalTaskStatuses] = useState<TaskStatusEntity[]>([]);
  const [localCompletionLogs, setLocalCompletionLogs] = useState<CompletionLog[]>([]);
  const [projectParticipants, setProjectParticipants] = useState<ProjectParticipant[]>(
    projectParticipantsFromState || (currentProject?.participantRoles || [])
  );
  
  // Extract task IDs for fetching completion logs
  const taskIdsForLogs = useMemo(() => 
    projectTasksFromDb.map(t => typeof t.id === 'string' ? parseInt(t.id) : t.id),
    [projectTasksFromDb]
  );
  
  // Fetch completion logs for all project tasks
  const { data: completionLogsFromDb = [], isLoading: completionLogsLoading } = useProjectCompletionLogs(taskIdsForLogs);
  
  // Mutations for creating tasks in the database
  const createTaskMutation = useCreateTaskWithStatuses();
  const createMultipleTasksMutation = useCreateMultipleTasksWithStatuses();
  
  // Sync tasks from database to local state when React Query data changes
  // This ensures tasks persist across page refreshes
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
  // Fall back to database data on initial load
  const tasks = localTasks.length > 0 ? localTasks : projectTasksFromDb;
  const taskStatuses = localTaskStatuses;
  const completionLogs = localCompletionLogs.length > 0 ? localCompletionLogs : completionLogsFromDb;

  // Sync project participants with database data whenever it updates
  useEffect(() => {
    // If we have data from the database, it is the source of truth
    if (projectFromDb?.participantRoles) {
      setProjectParticipants(projectFromDb.participantRoles);
    }
    // Otherwise, if we have data from state (navigation), use it as initial fallback
    else if (projectParticipantsFromState && projectParticipants.length === 0) {
      setProjectParticipants(projectParticipantsFromState);
    }
  }, [projectFromDb?.participantRoles]);

  // Get project participants with user data
  const participants = useMemo(() => {
    if (!currentProject?.participantRoles) return [];
    return projectParticipants
      .filter(pp => {
        const projectId = typeof currentProject.id === 'string' ? parseInt(currentProject.id) : currentProject.id;
        const ppProjectId = typeof pp.projectId === 'string' ? parseInt(pp.projectId) : pp.projectId;
        return ppProjectId === projectId && !pp.removedAt;
      })
      .map(pp => ({
        ...pp,
        user: pp.user || currentProject.participants?.find(u => {
          const uId = typeof u.id === 'string' ? parseInt(u.id) : u.id;
          const ppUserId = typeof pp.userId === 'string' ? parseInt(pp.userId) : pp.userId;
          return uId === ppUserId;
        })
      }));
  }, [projectParticipants, currentProject]);

  // Update project with participants
  const projectWithParticipants: Project | undefined = useMemo(() => {
    if (!currentProject) return undefined;
    return {
      ...currentProject,
      participants: participants.map(p => p.user).filter((u): u is User => u !== undefined),
      participantRoles: participants
    };
  }, [currentProject, participants]);

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

  // Helper to get task status for a user
  const getTaskStatusForUser = (taskId: number, userId: number): TaskStatusEntity | undefined => {
    return taskStatuses.find(ts => ts.taskId === taskId && ts.userId === userId);
  };

  // User-specific categorization to avoid duplicates across sections
  const {
    activeTasks,
    upcomingTasks,
    completedTasks,
    archivedTasks,
  } = useMemo(() => {
    const active: Task[] = [];
    const upcoming: Task[] = [];
    const completed: Task[] = [];
    const archived: Task[] = [];
    const addUnique = (list: Task[], task: Task) => {
      if (!list.some(t => t.id === task.id)) list.push(task);
    };

    if (!user) return { activeTasks: [], upcomingTasks: [], completedTasks: [], archivedTasks: [] };

    const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    projectTasks.forEach(task => {
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

    return { activeTasks: active, upcomingTasks: upcoming, completedTasks: completed, archivedTasks: archived };
  }, [projectTasks, taskStatuses, completionLogs]);

  // Habits: all habit tasks in the project (all participants see all habit tasks)
  const habitTasks = useMemo(() =>
    projectTasks.filter(t => t.type === 'habit'),
    [projectTasks]
  );

  const activeSectionTasks = activeTasks;
  const upcomingSectionTasks = upcomingTasks;
  const completedSectionTasks = completedTasks;
  const archivedSectionTasks = archivedTasks;

  const hasAnyAllTabContent = useMemo(() =>
    Boolean(
      activeSectionTasks.length ||
      upcomingSectionTasks.length ||
      completedSectionTasks.length ||
      archivedSectionTasks.length
    ),
    [activeSectionTasks, upcomingSectionTasks, completedSectionTasks, archivedSectionTasks]
  );

  const handleRecover = useCallback((taskId: number) => {
    if (!user) return;

    // Use centralized recovery utility - single source of truth
    const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    const result = recoverTask(String(taskId), String(userId), tasks, taskStatuses);

    if (!result || !result.success) {
      handleError('Task not found or cannot be recovered', 'handleRecover');
      return;
    }

    // Update task state
    if (result.updatedTask) {
      setLocalTasks(prev =>
        prev.map(t => t.id === taskId ? result.updatedTask! : t)
      );
    }

    // Update task status state
    if (result.updatedTaskStatus && user) {
      const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      setLocalTaskStatuses(prev => {
        const existingIndex = prev.findIndex(ts => {
          const tsTaskId = typeof ts.taskId === 'string' ? parseInt(ts.taskId) : ts.taskId;
          const tsUserId = typeof ts.userId === 'string' ? parseInt(ts.userId) : ts.userId;
          return tsTaskId === taskId && tsUserId === userId;
        });

        if (existingIndex >= 0) {
          // Update existing task status
          return prev.map((ts, index) =>
            index === existingIndex ? result.updatedTaskStatus! : ts
          );
        } else {
          // Add new task status (edge case)
          return [...prev, result.updatedTaskStatus];
        }
      });
    }

    toast.success('Task recovered! 💪', {
      description: 'Complete it to earn half XP'
    });
  }, [user, tasks, taskStatuses]);

  const handleComplete = useCallback((taskId: number, difficultyRating?: number) => {
    if (!user) return;

    const now = new Date();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    const myTaskStatus = getTaskStatusForUser(taskId, userId);
    if (!myTaskStatus) return;

    const isRecovered = myTaskStatus.recoveredAt !== undefined;
    const taskDueDate = task.dueDate;
    const isBeforeDueDate = now <= taskDueDate;
    const penaltyApplied = isRecovered && !isBeforeDueDate;

    const baseXP = (difficultyRating || 3) * 100;
    const xpEarned = penaltyApplied ? Math.floor(baseXP / 2) : baseXP;

    // Determine timing status (local type for calculation only)
    const nowDate = new Date(now);
    nowDate.setHours(0, 0, 0, 0);
    const dueDate = new Date(taskDueDate);
    dueDate.setHours(0, 0, 0, 0);

    let timingStatus: 'early' | 'on_time' | 'late' = 'on_time';
    if (nowDate < dueDate) {
      timingStatus = 'early';
    } else if (nowDate > dueDate) {
      timingStatus = 'late';
    } else {
      const dueDateEnd = new Date(taskDueDate);
      dueDateEnd.setHours(23, 59, 59, 999);
      if (now > dueDateEnd) {
        timingStatus = 'late';
      } else {
        timingStatus = 'on_time';
      }
    }
    const newCompletionLog: CompletionLog = {
      id: Date.now(),
      userId: userId,
      taskId: taskId,
      difficultyRating: difficultyRating as DifficultyRating | undefined,
      penaltyApplied,
      xpEarned,
      createdAt: now
    };

    const ringColor = calculateRingColor(newCompletionLog, myTaskStatus, task);

    setLocalCompletionLogs(prev => [...prev, newCompletionLog]);

    setLocalTaskStatuses(prev => {
      const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      const updated = prev.map(ts => {
        const tsTaskId = typeof ts.taskId === 'string' ? parseInt(ts.taskId) : ts.taskId;
        const tsUserId = typeof ts.userId === 'string' ? parseInt(ts.userId) : ts.userId;
        if (tsTaskId === taskId && tsUserId === userId) {
          return {
            ...ts,
            status: 'completed' as TaskStatus,
            ringColor,
            updatedAt: now
          };
        }
        return ts;
      });

      const allStatuses = updated.filter(ts => {
        const tsTaskId = typeof ts.taskId === 'string' ? parseInt(ts.taskId) : ts.taskId;
        return tsTaskId === taskId;
      });
      const allCompleted = allStatuses.every(ts => {
        const tsUserId = typeof ts.userId === 'string' ? parseInt(ts.userId) : ts.userId;
        return tsUserId === userId || ts.status === 'completed';
      });

      setLocalTasks(prevTasks =>
        prevTasks.map(t => {
          if (t.id === taskId) {
            // General task status only includes 'active' and 'upcoming'
            // We don't set it to 'completed' - that's tracked via completion logs
            return {
              ...t,
              completedAt: allCompleted ? now : undefined,
              updatedAt: now
            };
          }
          return t;
        })
      );

      if (allCompleted) {
        toast.success('Amazing work! 🎉', {
          description: 'Task completed by everyone!'
        });
      } else {
        toast.success('Great job! 💪', {
          description: penaltyApplied
            ? 'Waiting for your partner to complete... (Half XP - Recovered)'
            : 'Waiting for your partner to complete...'
        });
      }

      return updated;
    });

    // Project progress is calculated on-the-fly, no need to update local state
  }, [user, tasks, taskStatuses]);

  const handleCreateTask = async (taskData: {
    title: string;
    description: string;
    projectId: number;
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
    if (!projectWithParticipants || !user) return;

    const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    const defaultDueDate = normalizeToStartOfDay(taskData.dueDate ?? new Date());

    // Get all participant user IDs
    const participantUserIds = projectWithParticipants?.participantRoles
      ?.filter(pr => !pr.removedAt)
      ?.map(pr => typeof pr.userId === 'string' ? parseInt(pr.userId) : pr.userId) || [];

    // Validate project for task creation
    const allParticipants = participantUserIds.map(id => ({ id } as User));
    const validation = validateProjectForTaskCreation(projectWithParticipants, allParticipants, 2);
    if (!validation.isValid) {
      toast.error('Cannot create task', {
        description: validation.error
      });
      return;
    }

    try {
      if (taskData.type === 'habit' && taskData.dueDate && taskData.recurrencePattern) {
        // Handle habit tasks (multiple recurring tasks)
        const startDate = normalizeToStartOfDay(taskData.dueDate);
        let endDate: Date;

        if (taskData.recurrencePattern === 'custom' && taskData.customRecurrence) {
          if (taskData.customRecurrence.endType === 'date' && taskData.customRecurrence.endDate) {
            endDate = new Date(taskData.customRecurrence.endDate);
            endDate.setHours(23, 59, 59, 999);
          } else {
            endDate = new Date(startDate);
            const maxOccurrences = taskData.customRecurrence.occurrenceCount || 10;
            endDate.setDate(endDate.getDate() + (maxOccurrences * 30));
          }
        } else {
          endDate = new Date(startDate);
          if (taskData.recurrencePattern === 'Daily') {
            endDate.setDate(endDate.getDate() + 28);
          } else if (taskData.recurrencePattern === 'weekly') {
            endDate.setDate(endDate.getDate() + 28);
          }
          endDate.setHours(23, 59, 59, 999);
        }

        // Build array of tasks to create
        const tasksToCreate: CreateTaskWithStatusesInput[] = [];
        let currentDate = new Date(startDate);
        let occurrenceCount = 0;
        const maxOccurrences = taskData.customRecurrence?.occurrenceCount ||
          (taskData.recurrencePattern === 'Daily' ? 28 : taskData.recurrencePattern === 'weekly' ? 4 : 999);

        while (currentDate <= endDate && occurrenceCount < maxOccurrences) {
          const taskDueDate = normalizeToStartOfDay(currentDate);

          tasksToCreate.push({
            task: {
              projectId: taskData.projectId,
              creatorId: userId,
              type: taskData.type,
              recurrencePattern: taskData.recurrencePattern,
              title: taskData.title,
              description: taskData.description,
              dueDate: taskDueDate,
            },
            participantUserIds,
            dueDate: taskDueDate,
          });

          occurrenceCount++;

          // Advance to next occurrence
          if (taskData.recurrencePattern === 'Daily') {
            currentDate.setDate(currentDate.getDate() + 1);
          } else if (taskData.recurrencePattern === 'weekly') {
            currentDate.setDate(currentDate.getDate() + 7);
          } else if (taskData.recurrencePattern === 'custom' && taskData.customRecurrence) {
            const { frequency, interval } = taskData.customRecurrence;
            if (frequency === 'days') {
              currentDate.setDate(currentDate.getDate() + interval);
            } else if (frequency === 'weeks') {
              currentDate.setDate(currentDate.getDate() + (interval * 7));
            } else if (frequency === 'months') {
              currentDate.setMonth(currentDate.getMonth() + interval);
            }
          }
        }

        // Create all habit tasks in the database
        const results = await createMultipleTasksMutation.mutateAsync(tasksToCreate);

        toast.success(`${results.length} habit tasks created! 🚀`, {
          description: 'Persuade your friends to complete these tasks with you'
        });

        // Send email notification for the first task
        if (results.length > 0) {
          const mainTask = results[0].task;
          notifyTaskCreated(mainTask.id, mainTask.projectId, userId).catch(error => {
            console.error('Failed to send task creation emails:', error);
          });
        }
      } else {
        // Handle single one-off task
        const result = await createTaskMutation.mutateAsync({
          task: {
            projectId: taskData.projectId,
            creatorId: userId,
            type: taskData.type,
            recurrencePattern: taskData.recurrencePattern,
            title: taskData.title,
            description: taskData.description,
            dueDate: defaultDueDate,
          },
          participantUserIds,
          dueDate: defaultDueDate,
        });

        toast.success('Task created! 🚀', {
          description: 'Persuade your friends to complete this task with you'
        });

        // Send email notification
        notifyTaskCreated(result.task.id, result.task.projectId, userId).catch(error => {
          console.error('Failed to send task creation emails:', error);
        });
      }

      setShowTaskForm(false);
    } catch (error) {
      handleError(error, 'handleCreateTask');
      toast.error('Failed to create task', {
        description: 'Please try again'
      });
    }
  };

  const handleAddMember = async () => {
    if (!currentProject || !user) return;

    if (!memberIdentifier.trim()) {
      toast.error('Please enter a handle');
      return;
    }

    const handleValidation = validateHandleFormat(memberIdentifier);
    if (!handleValidation.isValid) {
      toast.error(handleValidation.error || 'Invalid handle format');
      return;
    }

    try {
      const userToAdd = await findUserByIdentifier(memberIdentifier);

      if (!userToAdd) {
        toast.error('User not found', {
          description: 'No user with this handle exists in the system'
        });
        return;
      }

      const userIdToAdd = typeof userToAdd.id === 'string' ? parseInt(userToAdd.id) : userToAdd.id;
      const projectId = typeof currentProject.id === 'string' ? parseInt(currentProject.id) : currentProject.id;

      if (participants.some(p => {
        const pUserId = typeof p.userId === 'string' ? parseInt(p.userId) : p.userId;
        return pUserId === userIdToAdd;
      })) {
        toast.error('User already in project', {
          description: 'This user is already a member of this project'
        });
        return;
      }

      const now = new Date();
      const db = getDatabaseClient();

      // Add participant to database
      const addedParticipant = await db.projects.addParticipant(projectId, userIdToAdd, 'participant');

      const newParticipant: ProjectParticipant = {
        projectId: projectId,
        userId: userIdToAdd,
        role: 'participant',
        addedAt: now,
        removedAt: undefined
      };

      setProjectParticipants(prev => [...prev, newParticipant]);

      // Invalidate query to get real data from DB including the User object
      queryClient.invalidateQueries({ queryKey: ['project', id] });

      toast.success('Member added! 🎉', {
        description: `${userToAdd.name} (${userToAdd.handle}) has been added to the project`
      });

      setMemberIdentifier('');
      setShowAddMemberForm(false);
    } catch (error) {
      handleError(error, 'handleAddMember');
    }
  };


  const handleEditProject = async (projectData: { name: string; description: string }) => {
    if (!currentProject) return;

    try {
      const db = getDatabaseClient();
      const projectId = typeof currentProject.id === 'string' ? parseInt(currentProject.id) : currentProject.id;
      await db.projects.update(projectId, {
        name: projectData.name,
        description: projectData.description
      });

      toast.success('Project updated', {
        description: 'Project settings have been saved'
      });
      setShowEditProjectForm(false);
    } catch (error) {
      handleError(error, 'handleEditProject');
    }
  };

  const handleLeaveProject = async () => {
    if (!currentProject || !user) return;

    const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    const projectId = typeof currentProject.id === 'string' ? parseInt(currentProject.id) : currentProject.id;
    const ownerId = typeof currentProject.ownerId === 'string' ? parseInt(currentProject.ownerId) : currentProject.ownerId;

    // Owner cannot leave project
    if (ownerId === userId) {
      toast.error('Cannot leave project', {
        description: 'Project owner cannot leave the project'
      });
      setShowLeaveProjectDialog(false);
      return;
    }

    try {
      const db = getDatabaseClient();
      await db.projects.removeParticipant(projectId, userId);

      const now = new Date();
      const updatedParticipants = projectParticipants.map(pp => {
        const ppProjectId = typeof pp.projectId === 'string' ? parseInt(pp.projectId) : pp.projectId;
        const ppUserId = typeof pp.userId === 'string' ? parseInt(pp.userId) : pp.userId;
        if (ppProjectId === projectId && ppUserId === userId) {
          return {
            ...pp,
            removedAt: now
          };
        }
        return pp;
      });

      setProjectParticipants(updatedParticipants);

      // Invalidate query to sync with DB
      queryClient.invalidateQueries({ queryKey: ['project', id] });

      toast.success('Left project', {
        description: 'You have been removed from this project'
      });

      setShowLeaveProjectDialog(false);
      navigate('/projects');
    } catch (error) {
      handleError(error, 'handleLeaveProject');
    }
  };

  const handleDeleteProject = async () => {
    if (!currentProject) return;

    try {
      const db = getDatabaseClient();
      const projectId = typeof currentProject.id === 'string' ? parseInt(currentProject.id) : currentProject.id;
      await db.projects.delete(projectId);

      toast.success('Project deleted', {
        description: 'The project and all its data have been permanently removed'
      });

      setShowDeleteProjectDialog(false);
      setShowEditProjectForm(false);
      navigate('/projects');
    } catch (error) {
      handleError(error, 'handleDeleteProject');
    }
  };

  const handleRemoveParticipant = useCallback(async (userIdToRemove: number) => {
    if (!currentProject || !user) return;

    try {
      const db = getDatabaseClient();
      const projectId = typeof currentProject.id === 'string' ? parseInt(currentProject.id) : currentProject.id;
      await db.projects.removeParticipant(projectId, userIdToRemove);

      const now = new Date();
      setProjectParticipants(prev =>
        prev.map(pp => {
          const ppProjectId = typeof pp.projectId === 'string' ? parseInt(pp.projectId) : pp.projectId;
          const ppUserId = typeof pp.userId === 'string' ? parseInt(pp.userId) : pp.userId;
          if (ppProjectId === projectId && ppUserId === userIdToRemove) {
            return {
              ...pp,
              removedAt: now
            };
          }
          return pp;
        })
      );

      // Invalidate query to sync with DB
      queryClient.invalidateQueries({ queryKey: ['project', id] });

      toast.success('Participant removed', {
        description: 'The member has been removed from the project'
      });
    } catch (error) {
      handleError(error, 'handleRemoveParticipant');
    }
  }, [currentProject, user, id, queryClient]);

  const handleUpdateRole = useCallback(async (userIdToUpdate: number, newRole: ProjectRole) => {
    if (!currentProject) return;

    try {
      const db = getDatabaseClient();
      const projectId = typeof currentProject.id === 'string' ? parseInt(currentProject.id) : currentProject.id;
      await db.projects.updateParticipantRole(projectId, userIdToUpdate, newRole);

      setProjectParticipants(prev =>
        prev.map(pp => {
          const ppProjectId = typeof pp.projectId === 'string' ? parseInt(pp.projectId) : pp.projectId;
          const ppUserId = typeof pp.userId === 'string' ? parseInt(pp.userId) : pp.userId;
          if (ppProjectId === projectId && ppUserId === userIdToUpdate) {
            return {
              ...pp,
              role: newRole
            };
          }
          return pp;
        })
      );

      // Invalidate query to sync with DB
      queryClient.invalidateQueries({ queryKey: ['project', id] });

      toast.success('Role updated', {
        description: `User role changed to ${newRole}`
      });
    } catch (error) {
      handleError(error, 'handleUpdateRole');
    }
  }, [currentProject, id, queryClient]);

  const handleDeleteTask = async (taskId: number) => {
    try {
      const db = getDatabaseClient();
      await db.tasks.delete(taskId);

      setLocalTasks(prev => prev.filter(t => t.id !== taskId));
      setLocalTaskStatuses(prev => prev.filter(ts => {
        const tsTaskId = typeof ts.taskId === 'string' ? parseInt(ts.taskId) : ts.taskId;
        return tsTaskId !== taskId;
      }));
      setLocalCompletionLogs(prev => prev.filter(cl => {
        const clTaskId = typeof cl.taskId === 'string' ? parseInt(cl.taskId) : cl.taskId;
        return clTaskId !== taskId;
      }));

      toast.success('Task deleted', {
        description: 'The task has been removed from the project'
      });
    } catch (error) {
      handleError(error, 'handleDeleteTask');
    }
  };

  const isOwner = useMemo(() => {
    if (!currentProject || !user) return false;
    const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    const ownerId = typeof currentProject.ownerId === 'string' ? parseInt(currentProject.ownerId) : currentProject.ownerId;
    return ownerId === userId;
  }, [currentProject, user]);

  const isManager = useMemo(() => {
    if (!user) return false;
    const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    return participants.some(p => {
      const pUserId = typeof p.userId === 'string' ? parseInt(p.userId) : p.userId;
      return pUserId === userId && p.role === 'manager';
    });
  }, [participants, user]);

  const canManage = isOwner || isManager;
  const canLeave = useMemo(() => {
    if (!currentProject || !user) return false;
    const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    const ownerId = typeof currentProject.ownerId === 'string' ? parseInt(currentProject.ownerId) : currentProject.ownerId;
    return ownerId !== userId;
  }, [currentProject, user]);

  return {
    // Project data
    project: projectWithParticipants,
    currentProject,
    participants,
    progress,
    completedCount,
    totalTasks,

    // Loading states - ensure we don't show empty UI while data is being fetched
    isLoading: projectLoading || tasksLoading || (tasksFetched && projectTasksFromDb.length > 0 && tasks.length === 0),

    // Task lists
    activeTasks,
    upcomingTasks,
    completedTasks,
    habitTasks,
    archivedTasks,
    projectTasks,

    // Section tasks (with deduplication)
    activeSectionTasks,
    upcomingSectionTasks,
    completedSectionTasks,
    archivedSectionTasks,
    hasAnyAllTabContent,

    // State
    showTaskForm,
    setShowTaskForm,
    showAddMemberForm,
    setShowAddMemberForm,
    showEditProjectForm,
    setShowEditProjectForm,
    showLeaveProjectDialog,
    setShowLeaveProjectDialog,
    showDeleteProjectDialog,
    setShowDeleteProjectDialog,
    showMembersDialog,
    setShowMembersDialog,
    memberIdentifier,
    setMemberIdentifier,

    // Handlers
    handleRecover,
    handleComplete,
    handleCreateTask,
    handleAddMember,
    handleRemoveParticipant,
    handleUpdateRole,
    handleDeleteTask,
    handleEditProject,
    handleLeaveProject,
    handleDeleteProject,

    // Permissions
    isOwner,
    isManager,
    canManage,
    canLeave,

    // Navigation
    navigate,

    // Data
    completionLogs,
    
    // Mutation states (for loading indicators)
    isCreatingTask: createTaskMutation.isPending || createMultipleTasksMutation.isPending,
  };
};

