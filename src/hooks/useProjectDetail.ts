import { useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import type { Task, Project, DifficultyRating, TaskStatusEntity, TaskStatus, ProjectParticipant, CompletionLog, User } from '@/types';
import { 
  getProjectTasks, 
  updateTasksWithStatuses
} from '@/lib/taskFilterUtils';
import { calculateProjectProgress } from '@/lib/projectUtils';
import { normalizeToStartOfDay, calculateRingColor, calculateTaskStatusUserStatus } from '@/lib/taskUtils';
import { recoverTask } from '@/lib/taskRecoveryUtils';
import { 
  createTaskStatusesForAllParticipants, 
  validateProjectForTaskCreation 
} from '@/lib/taskCreationUtils';
import { handleError } from '@/lib/errorUtils';
import { findUserByIdentifier, validateHandleFormat } from '@/lib/userUtils';
import { notifyTaskCreated } from '@/lib/taskEmailNotifications';
import { useAuth } from './useAuth';
import { useProject } from './useProjects';
import { useProjectTasks } from './useTasks';
import { getDatabaseClient } from '@/db';

export const useProjectDetail = () => {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
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

  // Fetch project tasks
  const { data: projectTasksFromDb = [], isLoading: tasksLoading } = useProjectTasks(id);
  const [tasks, setTasks] = useState<Task[]>(projectTasksFromDb);
  const [taskStatuses, setTaskStatuses] = useState<TaskStatusEntity[]>([]);
  const [completionLogs, setCompletionLogs] = useState<CompletionLog[]>([]);
  const [projectParticipants, setProjectParticipants] = useState<ProjectParticipant[]>(
    projectParticipantsFromState || (currentProject?.participantRoles || [])
  );

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
        user: currentProject.participants?.find(u => {
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

  const handleRecover = (taskId: number) => {
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
      setTasks(prev =>
        prev.map(t => t.id === taskId ? result.updatedTask! : t)
      );
    }

    // Update task status state
    if (result.updatedTaskStatus && user) {
      const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      setTaskStatuses(prev => {
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
  };

  const handleComplete = (taskId: number, difficultyRating?: number) => {
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

    setCompletionLogs(prev => [...prev, newCompletionLog]);

    setTaskStatuses(prev => {
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

      setTasks(prevTasks =>
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
  };

  const handleCreateTask = (taskData: {
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
    if (!projectWithParticipants) return;

    const newTasks: Task[] = [];
    const newTaskStatuses: TaskStatusEntity[] = [];
    const now = new Date();
    const defaultDueDate = normalizeToStartOfDay(taskData.dueDate ?? new Date());

    if (taskData.type === 'habit' && taskData.dueDate && taskData.recurrencePattern) {
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
      
      // Get all participants from project (once, outside the loop)
      const allParticipants = projectWithParticipants?.participantRoles?.map(pr => {
        const userId = typeof pr.userId === 'string' ? parseInt(pr.userId) : pr.userId;
        return { id: userId } as User;
      }) || [];
      
      const validation = validateProjectForTaskCreation(projectWithParticipants, allParticipants, 2);
      if (!validation.isValid) {
        toast.error('Cannot create task', {
          description: validation.error
        });
        return;
      }

      let currentDate = new Date(startDate);
      let taskIndex = 0;
      let occurrenceCount = 0;
      const maxOccurrences = taskData.customRecurrence?.occurrenceCount || 
        (taskData.recurrencePattern === 'Daily' ? 28 : taskData.recurrencePattern === 'weekly' ? 4 : 999);

      while (currentDate <= endDate && occurrenceCount < maxOccurrences) {
        const taskDueDate = normalizeToStartOfDay(currentDate);

        const taskId = Date.now() + taskIndex;
        const userId = typeof user?.id === 'string' ? parseInt(user.id) : (user?.id || 0);
        const newTask: Task = {
          id: taskId,
          projectId: taskData.projectId,
          creatorId: userId,
          type: taskData.type,
          recurrencePattern: taskData.recurrencePattern,
          title: taskData.title,
          description: taskData.description,
          dueDate: taskDueDate,
          createdAt: now,
          updatedAt: now
        };
        
        const statuses = createTaskStatusesForAllParticipants(
          String(taskId),
          projectWithParticipants,
          allParticipants,
          taskDueDate,
          now
        );
        newTaskStatuses.push(...statuses);

        newTasks.push(newTask);
        taskIndex++;
        occurrenceCount++;
        
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
    } else {
      const taskId = Date.now();
      const userId = typeof user?.id === 'string' ? parseInt(user.id) : (user?.id || 0);
      const newTask: Task = {
        id: taskId,
        projectId: taskData.projectId,
        creatorId: userId,
        type: taskData.type,
        recurrencePattern: taskData.recurrencePattern,
        title: taskData.title,
        description: taskData.description,
        dueDate: defaultDueDate,
        createdAt: now,
        updatedAt: now
      };

      // Get all participants from project
      const allParticipants = projectWithParticipants?.participantRoles?.map(pr => {
        const userId = typeof pr.userId === 'string' ? parseInt(pr.userId) : pr.userId;
        return { id: userId } as User;
      }) || [];
      
      const validation = validateProjectForTaskCreation(projectWithParticipants, allParticipants, 2);
      if (!validation.isValid) {
        toast.error('Cannot create task', {
          description: validation.error
        });
        return;
      }
      
      const statuses = createTaskStatusesForAllParticipants(
        String(taskId),
        projectWithParticipants,
        allParticipants,
        defaultDueDate,
        now
      );
      newTaskStatuses.push(...statuses);

      newTasks.push(newTask);
    }

    setTasks(prev => [...newTasks, ...prev]);
    setTaskStatuses(prev => [...newTaskStatuses, ...prev]);
    
    const toastTitle = newTasks.length > 1
      ? `${newTasks.length} habit tasks created! 🚀`
      : 'Task created! 🚀';

    toast.success(toastTitle, {
      description: 'Persuade your friends to complete this task with you'
    });
    
    // Send email notifications for task creation
    // Note: In production, this should be called after the task is saved to the database
    // For now, we'll send emails for the first task (or the main task for habits)
    const mainTask = newTasks[0];
    if (mainTask && user) {
      const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      const projectId = typeof taskData.projectId === 'string' ? parseInt(taskData.projectId) : taskData.projectId;
      const taskId = typeof mainTask.id === 'string' ? parseInt(mainTask.id) : mainTask.id;
      notifyTaskCreated(taskId, projectId, userId).catch(error => {
        console.error('Failed to send task creation emails:', error);
        // Don't show error to user - email is best effort
      });
    }
    
    setShowTaskForm(false);
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
      
      // Refresh project to get updated participants
      // This will be handled by React Query invalidation in the component

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

  const handleRemoveParticipant = async (userIdToRemove: number) => {
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

      toast.success('Participant removed', {
        description: 'The member has been removed from the project'
      });
    } catch (error) {
      handleError(error, 'handleRemoveParticipant');
    }
  };

  const handleUpdateRole = async (userIdToUpdate: number, newRole: 'owner' | 'manager' | 'participant') => {
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

      toast.success('Role updated', {
        description: `User role changed to ${newRole}`
      });
    } catch (error) {
      handleError(error, 'handleUpdateRole');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      const db = getDatabaseClient();
      await db.tasks.delete(taskId);
      
      setTasks(prev => prev.filter(t => t.id !== taskId));
      setTaskStatuses(prev => prev.filter(ts => {
        const tsTaskId = typeof ts.taskId === 'string' ? parseInt(ts.taskId) : ts.taskId;
        return tsTaskId !== taskId;
      }));
      setCompletionLogs(prev => prev.filter(cl => {
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
    
    // Loading states
    isLoading: projectLoading || tasksLoading,
    
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
  };
};

