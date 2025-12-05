import { useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import type { Task, Project, DifficultyRating, TaskStatusEntity, TaskStatusUserStatus, TimingStatus, ProjectParticipant, CompletionLog } from '@/types';
import { getProjectById, mockTasks, currentUser, mockProjects, mockTaskStatuses, mockCompletionLogs, mockProjectParticipants, mockUsers } from '@/lib/mockData';
import { 
  getProjectTasks, 
  updateTasksWithStatuses
} from '@/lib/taskFilterUtils';
import { calculateProjectProgress, leaveProject, canLeaveProject } from '@/lib/projectUtils';
import { normalizeToStartOfDay, calculateRingColor, calculateTaskStatusUserStatus } from '@/lib/taskUtils';
import { recoverTask } from '@/lib/taskRecoveryUtils';
import { 
  createTaskStatusesForAllParticipants, 
  validateProjectForTaskCreation 
} from '@/lib/taskCreationUtils';
import { handleError } from '@/lib/errorUtils';
import { findUserByIdentifier, validateHandleFormat } from '@/lib/userUtils';

export const useProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const projectFromState = location.state?.project as Project | undefined;
  const projectParticipantsFromState = location.state?.projectParticipants as ProjectParticipant[] | undefined;
  const projectFromData = getProjectById(id || '');
  const project = projectFromState || projectFromData;

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [showEditProjectForm, setShowEditProjectForm] = useState(false);
  const [showLeaveProjectDialog, setShowLeaveProjectDialog] = useState(false);
  const [showDeleteProjectDialog, setShowDeleteProjectDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [memberIdentifier, setMemberIdentifier] = useState('');
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [taskStatuses, setTaskStatuses] = useState<TaskStatusEntity[]>(mockTaskStatuses);
  const [completionLogs, setCompletionLogs] = useState<CompletionLog[]>(mockCompletionLogs);
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [projectParticipants, setProjectParticipants] = useState<ProjectParticipant[]>(
    projectParticipantsFromState || mockProjectParticipants
  );

  // Get updated project from state if available
  const currentProject = useMemo(() => 
    projects.find(p => p.id === project?.id) || project,
    [projects, project]
  );

  // Get project participants
  const participants = useMemo(() => 
    projectParticipants
      .filter(pp => pp.projectId === currentProject?.id && !pp.removedAt)
      .map(pp => ({
        ...pp,
        user: mockUsers.find(u => u.id === pp.userId)
      })),
    [projectParticipants, currentProject]
  );

  // Update project with participants
  const projectWithParticipants: Project | undefined = useMemo(() => {
    if (!currentProject) return undefined;
    return {
      ...currentProject,
      participants: participants.map(p => p.user).filter(Boolean) as typeof mockUsers,
      participantRoles: participants
    };
  }, [currentProject, participants]);

  // Get project tasks using utility - show ALL tasks in the project
  const projectTasksRaw = useMemo(() => 
    currentProject ? getProjectTasks(tasks, currentProject.id) : [],
    [tasks, currentProject]
  );
  
  const projectTasks = useMemo(() => 
    updateTasksWithStatuses(projectTasksRaw, taskStatuses),
    [projectTasksRaw, taskStatuses]
  );

  // Calculate progress using utility
  const { progress, completedTasks: completedCount, totalTasks } = useMemo(() => 
    currentProject 
      ? calculateProjectProgress(currentProject, tasks, completionLogs, currentUser.id)
      : { progress: 0, completedTasks: 0, totalTasks: 0 },
    [currentProject, tasks, completionLogs]
  );

  // Helper to get task status for a user
  const getTaskStatusForUser = (taskId: string, userId: string): TaskStatusEntity | undefined => {
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

    projectTasks.forEach(task => {
      const myStatus = taskStatuses.find(ts => ts.taskId === task.id && ts.userId === currentUser.id);
      const myCompletion = completionLogs.find(cl => cl.taskId === task.id && cl.userId === currentUser.id);
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

  const handleRecover = (taskId: string) => {
    // Use centralized recovery utility - single source of truth
    const result = recoverTask(taskId, currentUser.id, tasks, taskStatuses);
    
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
    if (result.updatedTaskStatus) {
      setTaskStatuses(prev => {
        const existingIndex = prev.findIndex(
          ts => ts.taskId === taskId && ts.userId === currentUser.id
        );
        
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

  const handleComplete = (taskId: string, difficultyRating?: number) => {
    const now = new Date();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const myTaskStatus = getTaskStatusForUser(taskId, currentUser.id);
    if (!myTaskStatus) return;

    const isRecovered = myTaskStatus.recoveredAt !== undefined;
    const isBeforeDueDate = now <= myTaskStatus.effectiveDueDate;
    const penaltyApplied = isRecovered && !isBeforeDueDate;

    const baseXP = (difficultyRating || 3) * 100;
    const xpEarned = penaltyApplied ? Math.floor(baseXP / 2) : baseXP;

    // Determine timing status
    const nowDate = new Date(now);
    nowDate.setHours(0, 0, 0, 0);
    const dueDate = new Date(myTaskStatus.effectiveDueDate);
    dueDate.setHours(0, 0, 0, 0);
    
    let timingStatus: TimingStatus = 'on_time';
    if (nowDate < dueDate) {
      timingStatus = 'early';
    } else if (nowDate > dueDate) {
      timingStatus = 'late';
    } else {
      const dueDateEnd = new Date(myTaskStatus.effectiveDueDate);
      dueDateEnd.setHours(23, 59, 59, 999);
      if (now > dueDateEnd) {
        timingStatus = 'late';
      } else {
        timingStatus = 'on_time';
      }
    }

    const newCompletionLog = {
      id: `cl-${Date.now()}`,
      userId: currentUser.id,
      taskId: taskId,
      completedAt: now,
      difficultyRating: difficultyRating as DifficultyRating | undefined,
      timingStatus,
      recoveredCompletion: isRecovered,
      penaltyApplied,
      xpEarned,
      createdAt: now
    };

    const ringColor = calculateRingColor(newCompletionLog, myTaskStatus, task);

    setCompletionLogs(prev => [...prev, newCompletionLog]);

    setTaskStatuses(prev => {
      const updated = prev.map(ts => {
        if (ts.taskId === taskId && ts.userId === currentUser.id) {
          return {
            ...ts,
            status: 'completed' as TaskStatusUserStatus,
            ringColor,
            timingStatus,
            updatedAt: now
          };
        }
        return ts;
      });

      const allStatuses = updated.filter(ts => ts.taskId === taskId);
      const allCompleted = allStatuses.every(ts => 
        ts.userId === currentUser.id || ts.status === 'completed'
      );

      setTasks(prevTasks =>
        prevTasks.map(t => {
          if (t.id === taskId) {
            // General task status only includes 'active' and 'upcoming'
            // We don't set it to 'completed' - that's tracked via completion logs
            return {
              ...t,
              status: 'active' as Task['status'],
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
    
    setProjects(prev =>
      prev.map(p => {
        if (p.id === task.projectId) {
          const projectTasks = tasks.filter(t => t.projectId === p.id);
          const userCompletedCount = projectTasks.filter(t => 
            [...completionLogs, newCompletionLog].some(cl => cl.taskId === t.id && cl.userId === currentUser.id)
          ).length;
          return {
            ...p,
            completedTasks: userCompletedCount,
            progress: projectTasks.length > 0 ? (userCompletedCount / projectTasks.length) * 100 : 0,
            updatedAt: now
          };
        }
        return p;
      })
    );
  };

  const handleCreateTask = (taskData: {
    title: string;
    description: string;
    projectId: string;
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
      
      let currentDate = new Date(startDate);
      let taskIndex = 0;
      let occurrenceCount = 0;
      const maxOccurrences = taskData.customRecurrence?.occurrenceCount || 
        (taskData.recurrencePattern === 'Daily' ? 28 : taskData.recurrencePattern === 'weekly' ? 4 : 999);

      while (currentDate <= endDate && occurrenceCount < maxOccurrences) {
        const taskDueDate = normalizeToStartOfDay(currentDate);

        const taskId = `t${Date.now()}-${taskIndex}`;
        const newTask: Task = {
          id: taskId,
          projectId: taskData.projectId,
          creatorId: currentUser.id,
          type: taskData.type,
          recurrencePattern: taskData.recurrencePattern,
          title: taskData.title,
          description: taskData.description,
          dueDate: taskDueDate,
          status: 'active',
          createdAt: now,
          updatedAt: now
        };

        const validation = validateProjectForTaskCreation(projectWithParticipants, mockUsers, 2);
        if (!validation.isValid) {
          toast.error('Cannot create task', {
            description: validation.error
          });
          return;
        }
        
        const statuses = createTaskStatusesForAllParticipants(
          taskId,
          projectWithParticipants,
          mockUsers,
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
      const taskId = `t${Date.now()}`;
      const newTask: Task = {
        id: taskId,
        projectId: taskData.projectId,
        creatorId: currentUser.id,
        type: taskData.type,
        recurrencePattern: taskData.recurrencePattern,
        title: taskData.title,
        description: taskData.description,
        dueDate: defaultDueDate,
        status: 'active',
        createdAt: now,
        updatedAt: now
      };

      const validation = validateProjectForTaskCreation(projectWithParticipants, mockUsers, 2);
      if (!validation.isValid) {
        toast.error('Cannot create task', {
          description: validation.error
        });
        return;
      }
      
      const statuses = createTaskStatusesForAllParticipants(
        taskId,
        projectWithParticipants,
        mockUsers,
        defaultDueDate,
        now
      );
      newTaskStatuses.push(...statuses);

      newTasks.push(newTask);
    }

    setTasks(prev => [...newTasks, ...prev]);
    setTaskStatuses(prev => [...newTaskStatuses, ...prev]);
    
    setProjects(prev =>
      prev.map(p => {
        if (p.id === taskData.projectId) {
          const projectTasks = [...newTasks, ...tasks].filter(t => t.projectId === p.id);
          const userCompletedCount = projectTasks.filter(t => 
            completionLogs.some(cl => cl.taskId === t.id && cl.userId === currentUser.id)
          ).length;
          return {
            ...p,
            totalTasks: projectTasks.length,
            completedTasks: userCompletedCount,
            progress: projectTasks.length > 0 ? (userCompletedCount / projectTasks.length) * 100 : 0,
            updatedAt: new Date()
          };
        }
        return p;
      })
    );
    
    const toastTitle = newTasks.length > 1
      ? `${newTasks.length} habit tasks created! 🚀`
      : 'Task initiated! 🚀';

    toast.success(toastTitle, {
      description: 'Your friend has been notified. to accept'
    });
    setShowTaskForm(false);
  };

  const handleAddMember = () => {
    if (!currentProject) return;

    if (!memberIdentifier.trim()) {
      toast.error('Please enter a handle');
      return;
    }

    const handleValidation = validateHandleFormat(memberIdentifier);
    if (!handleValidation.isValid) {
      toast.error(handleValidation.error || 'Invalid handle format');
      return;
    }

    const userToAdd = findUserByIdentifier(memberIdentifier);
    
    if (!userToAdd) {
      toast.error('User not found', {
        description: 'No user with this handle exists in the system'
      });
      return;
    }

    if (participants.some(p => p.userId === userToAdd.id)) {
      toast.error('User already in project', {
        description: 'This user is already a member of this project'
      });
      return;
    }

    const now = new Date();
    const newParticipant = {
      projectId: currentProject.id,
      userId: userToAdd.id,
      role: 'participant' as const,
      addedAt: now,
      removedAt: undefined,
      user: userToAdd
    };

    setProjectParticipants(prev => [...prev, newParticipant]);

    setProjects(prev =>
      prev.map(p => {
        if (p.id === currentProject.id) {
          const updatedParticipants = p.participants 
            ? [...p.participants, userToAdd]
            : [userToAdd];
          
          return {
            ...p,
            participants: updatedParticipants,
            updatedAt: new Date()
          };
        }
        return p;
      })
    );

    toast.success('Member added! 🎉', {
      description: `${userToAdd.name} (${userToAdd.handle}) has been added to the project`
    });
    
    setMemberIdentifier('');
    setShowAddMemberForm(false);
  };

  const handleRemoveParticipant = (userId: string) => {
    if (!currentProject) return;

    const now = new Date();
    
    setProjectParticipants(prev =>
      prev.map(pp => {
        if (pp.projectId === currentProject.id && pp.userId === userId) {
          return {
            ...pp,
            removedAt: now
          };
        }
        return pp;
      })
    );

    setProjects(prev =>
      prev.map(p => {
        if (p.id === currentProject.id) {
          return {
            ...p,
            participants: p.participants?.filter(u => u.id !== userId),
            updatedAt: new Date()
          };
        }
        return p;
      })
    );

    toast.success('Participant removed', {
      description: 'The member has been removed from the project'
    });
  };

  const handleUpdateRole = (userId: string, newRole: 'owner' | 'manager' | 'participant') => {
    if (!currentProject) return;

    setProjectParticipants(prev =>
      prev.map(pp => {
        if (pp.projectId === currentProject.id && pp.userId === userId) {
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
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setTaskStatuses(prev => prev.filter(ts => ts.taskId !== taskId));
    setCompletionLogs(prev => prev.filter(cl => cl.taskId !== taskId));
    
    toast.success('Task deleted', {
      description: 'The task has been removed from the project'
    });
  };

  const handleEditProject = (projectData: { name: string; description: string }) => {
    if (!currentProject) return;

    setProjects(prev =>
      prev.map(p => {
        if (p.id === currentProject.id) {
          return {
            ...p,
            name: projectData.name,
            description: projectData.description,
            updatedAt: new Date()
          };
        }
        return p;
      })
    );

    toast.success('Project updated', {
      description: 'Project settings have been saved'
    });
    setShowEditProjectForm(false);
  };

  const handleLeaveProject = () => {
    if (!currentProject) return;

    const result = leaveProject(
      currentProject.id,
      currentUser.id,
      projectParticipants,
      currentProject.ownerId
    );

    if (!result.success) {
      toast.error('Cannot leave project', {
        description: result.error || 'Unable to leave project at this time'
      });
      setShowLeaveProjectDialog(false);
      return;
    }

    setProjectParticipants(result.updatedParticipants);

    setProjects(prev =>
      prev.map(p => {
        if (p.id === currentProject.id) {
          return {
            ...p,
            participants: p.participants?.filter(u => u.id !== currentUser.id),
            updatedAt: new Date()
          };
        }
        return p;
      })
    );

    toast.success('Left project', {
      description: 'You have been removed from this project'
    });

    setShowLeaveProjectDialog(false);
    navigate('/projects');
  };

  const handleDeleteProject = () => {
    if (!currentProject) return;

    setProjects(prev => prev.filter(p => p.id !== currentProject.id));
    setTasks(prev => prev.filter(t => t.projectId !== currentProject.id));
    
    const projectTaskIds = tasks.filter(t => t.projectId === currentProject.id).map(t => t.id);
    setTaskStatuses(prev => prev.filter(ts => !projectTaskIds.includes(ts.taskId)));
    setCompletionLogs(prev => prev.filter(cl => !projectTaskIds.includes(cl.taskId)));
    setProjectParticipants(prev => prev.filter(pp => pp.projectId !== currentProject.id));
    
    toast.success('Project deleted', {
      description: 'The project and all its data have been permanently removed'
    });
    
    setShowDeleteProjectDialog(false);
    setShowEditProjectForm(false);
    navigate('/projects');
  };

  const isOwner = currentProject?.ownerId === currentUser.id;
  const isManager = participants.some(p => p.userId === currentUser.id && p.role === 'manager');
  const canManage = isOwner || isManager;
  const canLeave = currentProject ? canLeaveProject(currentUser.id, currentProject.ownerId, projectParticipants, currentProject.id) : false;

  return {
    // Project data
    project: projectWithParticipants,
    currentProject,
    participants,
    progress,
    completedCount,
    totalTasks,
    
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

