import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskForm } from '@/components/tasks/TaskForm';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getProjectById, mockTasks, currentUser, mockProjects, mapTaskStatusForUI, mockTaskStatuses, mockCompletionLogs, mockProjectParticipants, mockUsers } from '@/lib/mockData';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Users, TrendingUp, Clock, CheckCircle2, Sparkles, Repeat, UserPlus, Settings, Trash2 } from 'lucide-react';
import { Task, Project, DifficultyRating, TaskStatusEntity, TaskStatusUserStatus, TimingStatus, ProjectRole, RingColor } from '@/types';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const projectFromState = location.state?.project as Project | undefined;
  const projectFromData = getProjectById(id || '');
  const project = projectFromState || projectFromData;
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [showEditProjectForm, setShowEditProjectForm] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [tasks, setTasks] = useState(mockTasks);
  const [taskStatuses, setTaskStatuses] = useState(mockTaskStatuses);
  const [completionLogs, setCompletionLogs] = useState(mockCompletionLogs);
  const [projects, setProjects] = useState(mockProjects);
  const [projectParticipants, setProjectParticipants] = useState(mockProjectParticipants);

  if (!project) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <h2 className="text-2xl font-bold mb-4">Project not found</h2>
          <Button onClick={() => navigate('/projects')}>Back to Projects</Button>
        </div>
      </AppLayout>
    );
  }

  // Get updated project from state if available
  const currentProject = projects.find(p => p.id === project.id) || project;
  
  // Get project participants
  const participants = projectParticipants
    .filter(pp => pp.projectId === currentProject.id && !pp.removedAt)
    .map(pp => ({
      ...pp,
      user: mockUsers.find(u => u.id === pp.userId)
    }));

  // Update project with participants
  const projectWithParticipants: Project = {
    ...currentProject,
    participants: participants.map(p => p.user).filter(Boolean) as typeof mockUsers,
    participantRoles: participants
  };

  // Helper to update task with statuses
  const updateTaskWithStatuses = (task: Task): Task => {
    return {
      ...task,
      taskStatuses: taskStatuses.filter(ts => ts.taskId === task.id)
    };
  };

  const projectTasks = tasks
    .filter(t => t.projectId === currentProject.id)
    .map(updateTaskWithStatuses);
  
  // Calculate progress dynamically from tasks - count tasks where current user has completed
  const totalTasks = projectTasks.length;
  const completedCount = projectTasks.filter(t => {
    const userCompletion = completionLogs.some(cl => cl.taskId === t.id && cl.userId === currentUser.id);
    return userCompletion;
  }).length;
  
  const progress = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

  // Needs Action: tasks where user status is active but not completed, and due date is today or past
  // Includes recovered tasks (recoveredAt is set but not completed)
  const needsActionTasks = projectTasks.filter(t => {
    const myStatus = t.taskStatuses?.find(ts => ts.userId === currentUser.id);
    const myCompletion = completionLogs.some(cl => cl.taskId === t.id && cl.userId === currentUser.id);
    const dueDate = new Date(t.originalDueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    const isDueTodayOrPast = dueDate.getTime() <= today.getTime();
    
    // Active tasks (including recovered) that are not completed and not archived
    return (myStatus?.status === 'active' || myStatus?.recoveredAt) && 
           !myCompletion && 
           t.status !== 'completed' && 
           isDueTodayOrPast && 
           !myStatus.archivedAt;
  });
  
  // Active: tasks that are active (not completed, not archived) and due in future
  const activeTasks = projectTasks.filter(t => {
    const myStatus = t.taskStatuses?.find(ts => ts.userId === currentUser.id);
    const myCompletion = completionLogs.some(cl => cl.taskId === t.id && cl.userId === currentUser.id);
    const dueDate = new Date(t.originalDueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    const isDueFuture = dueDate.getTime() > today.getTime();
    
    return t.status === 'active' && myStatus?.status === 'active' && !myCompletion && !myStatus.archivedAt && isDueFuture;
  });
  
  // Completed: tasks that are completed by current user
  const completedTasks = projectTasks.filter(t => {
    const myCompletion = completionLogs.some(cl => cl.taskId === t.id && cl.userId === currentUser.id);
    return myCompletion;
  });
  
  // Upcoming: tasks with status 'upcoming' or due in future
  const upcomingTasks = projectTasks.filter(t => {
    const dueDate = new Date(t.originalDueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    return t.status === 'upcoming' || dueDate.getTime() > today.getTime();
  });
  
  // Habits: tasks that are habits
  const habitTasks = projectTasks.filter(t => t.type === 'habit');
  
  // Archived: tasks that are archived (archivedAt is not null) and NOT recovered, NOT completed
  const archivedTasks = projectTasks.filter(t => {
    const myStatus = t.taskStatuses?.find(ts => ts.userId === currentUser.id);
    const myCompletion = completionLogs.some(cl => cl.taskId === t.id && cl.userId === currentUser.id);
    
    // Only show if archived, not recovered, and not completed
    return (myStatus?.status === 'archived' || 
            (myStatus?.archivedAt !== undefined && myStatus.archivedAt !== null)) && 
           !myStatus?.recoveredAt && 
           !myCompletion;
  });

  // Helper to get task status for a user
  const getTaskStatusForUser = (taskId: string, userId: string): TaskStatusEntity | undefined => {
    return taskStatuses.find(ts => ts.taskId === taskId && ts.userId === userId);
  };


  const handleRecover = (taskId: string) => {
    const now = new Date();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    setTaskStatuses(prev =>
      prev.map(ts => {
        if (ts.taskId === taskId && ts.userId === currentUser.id && ts.status === 'archived') {
        return {
            ...ts,
            status: 'active' as TaskStatusUserStatus,
            recoveredAt: now,
            archivedAt: undefined,
            ringColor: 'yellow',
            timingStatus: 'late',
            updatedAt: now
          };
        }
        return ts;
      })
    );

    setTasks(prev =>
      prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            status: 'active' as Task['status'],
            updatedAt: now
          };
        }
        return t;
      })
    );

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

    let timingStatus: TimingStatus = 'on_time';
    if (now < myTaskStatus.effectiveDueDate) {
      timingStatus = 'early';
    } else if (now > myTaskStatus.effectiveDueDate) {
      timingStatus = 'late';
    }

    // Determine ring color based on rules:
    // Green: completed on time/early (isLate: false) AND not recovered
    // Yellow: recovered task (recoveredCompletion: true) - always yellow when recovered
    // None: late completion but not recovered
    let ringColor: RingColor = 'none';
    if (isRecovered || myTaskStatus.recoveredAt) {
      ringColor = 'yellow'; // Recovered task always yellow, even when completed
    } else if (timingStatus === 'on_time' || timingStatus === 'early') {
      ringColor = 'green'; // Completed on time
    } else {
      ringColor = 'none'; // Late but not recovered
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

    setCompletionLogs(prev => [...prev, newCompletionLog]);

    // Update task status to 'completed' and ensure ringColor is set
    setTaskStatuses(prev => {
      const updated = prev.map(ts => {
        if (ts.taskId === taskId && ts.userId === currentUser.id) {
          return {
            ...ts,
            status: 'completed' as TaskStatusUserStatus,
            ringColor, // Ensure ringColor is set (green for on-time, yellow for recovered)
            timingStatus,
            updatedAt: now
          };
        }
        return ts;
      });

      // Check if all participants have completed (use updated taskStatuses)
      const allStatuses = updated.filter(ts => ts.taskId === taskId);
      const allCompleted = allStatuses.every(ts => 
        ts.userId === currentUser.id || ts.status === 'completed'
      );

      // Update task status based on all participants' completion
      setTasks(prevTasks =>
        prevTasks.map(t => {
          if (t.id === taskId) {
            return {
              ...t,
              status: allCompleted ? 'completed' : 'active',
              completedAt: allCompleted ? now : undefined,
              updatedAt: now
            };
          }
          return t;
        })
      );

      // Show toast
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
    
    // Update project progress
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

  // Helper to build task status entity
  const buildTaskStatus = (
    taskId: string,
    userId: string,
    status: TaskStatusUserStatus,
    dueDate: Date,
    timestamp: Date
  ): TaskStatusEntity => ({
    id: `${taskId}-${userId}`,
    taskId,
    userId,
    status,
    effectiveDueDate: new Date(dueDate),
    initiatedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  const handleCreateTask = (taskData: {
    title: string;
    description: string;
    assigneeId: string;
    projectId: string;
    type: 'one_off' | 'habit';
    recurrencePattern?: 'daily' | 'weekly' | 'custom';
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
    const newTasks: Task[] = [];
    const newTaskStatuses: TaskStatusEntity[] = [];
    const now = new Date();
    const defaultDueDate = taskData.dueDate ? new Date(taskData.dueDate) : new Date();
    defaultDueDate.setSeconds(0, 0);

    if (taskData.type === 'habit' && taskData.dueDate && taskData.recurrencePattern) {
      const startDate = new Date(taskData.dueDate);
      startDate.setHours(
        taskData.dueDate.getHours(),
        taskData.dueDate.getMinutes(),
        0,
        0
      );
      
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
        if (taskData.recurrencePattern === 'daily') {
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
        (taskData.recurrencePattern === 'daily' ? 28 : taskData.recurrencePattern === 'weekly' ? 4 : 999);

      while (currentDate <= endDate && occurrenceCount < maxOccurrences) {
        const taskDueDate = new Date(currentDate);
        taskDueDate.setHours(
          taskData.dueDate.getHours(),
          taskData.dueDate.getMinutes(),
          0,
          0
        );

        const taskId = `t${Date.now()}-${taskIndex}`;
        const newTask: Task = {
          id: taskId,
          projectId: taskData.projectId,
          creatorId: currentUser.id,
          type: taskData.type,
          recurrencePattern: taskData.recurrencePattern,
          title: taskData.title,
          description: taskData.description,
          originalDueDate: taskDueDate,
          status: 'active',
          initiatedAt: now,
          createdAt: now,
          updatedAt: now
        };

        // Get all project participants to create task statuses for all
        const projectParticipants = projectWithParticipants.participants || projectWithParticipants.participantRoles?.map(pr => {
          const user = mockUsers.find(u => u.id === pr.userId);
          return user;
        }).filter(Boolean) || [];
        
        // Create task status for all participants (avoid duplicates)
        const participantIds = new Set<string>();
        projectParticipants.forEach(p => {
          const userId = typeof p === 'object' && 'id' in p ? p.id : p;
          if (userId && !participantIds.has(userId)) {
            participantIds.add(userId);
            newTaskStatuses.push(
              buildTaskStatus(taskId, userId, 'active', taskDueDate, now)
            );
          }
        });
        
        // Ensure at least 2 participants (task requirement)
        if (participantIds.size < 2) {
          toast.error('Task requires at least 2 participants', {
            description: 'Add more members to the project first'
          });
          return;
        }

        newTasks.push(newTask);
        taskIndex++;
        occurrenceCount++;
        
        if (taskData.recurrencePattern === 'daily') {
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
        originalDueDate: defaultDueDate,
        status: 'active',
        initiatedAt: now,
        createdAt: now,
        updatedAt: now
      };

      // Get all project participants to create task statuses for all
      const projectParticipants = projectWithParticipants.participants || projectWithParticipants.participantRoles?.map(pr => {
        const user = mockUsers.find(u => u.id === pr.userId);
        return user;
      }).filter(Boolean) || [];
      
      // Create task status for all participants (avoid duplicates)
      const participantIds = new Set<string>();
      projectParticipants.forEach(p => {
        const userId = typeof p === 'object' && 'id' in p ? p.id : p;
        if (userId && !participantIds.has(userId)) {
          participantIds.add(userId);
          newTaskStatuses.push(
            buildTaskStatus(taskId, userId, 'active', defaultDueDate, now)
          );
        }
      });
      
      // Ensure at least 2 participants (task requirement)
      if (participantIds.size < 2) {
        toast.error('Task requires at least 2 participants', {
          description: 'Add more members to the project first'
        });
        return;
      }

      newTasks.push(newTask);
    }

    setTasks(prev => [...newTasks, ...prev]);
    setTaskStatuses(prev => [...newTaskStatuses, ...prev]);
    
    // Update project totalTasks and recalculate progress
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
      description: 'Waiting for your friend to accept'
    });
    setShowTaskForm(false);
  };

  const handleAddMember = () => {
    if (!memberEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    const userToAdd = mockUsers.find(u => u.email.toLowerCase() === memberEmail.toLowerCase().trim());
    
    if (!userToAdd) {
      toast.error('User not found', {
        description: 'No user with this email exists in the system'
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
      role: 'participant' as ProjectRole,
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
      description: `${userToAdd.name} has been added to the project`
    });
    
    setMemberEmail('');
    setShowAddMemberForm(false);
  };

  const handleRemoveParticipant = (userId: string) => {
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

  const handleUpdateRole = (userId: string, newRole: ProjectRole) => {
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

  const isOwner = currentProject.ownerId === currentUser.id;
  const isManager = participants.some(p => p.userId === currentUser.id && p.role === 'manager');
  const canManage = isOwner || isManager;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/projects')}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${projectWithParticipants.color}15` }}
              >
                {projectWithParticipants.icon ? (
                  <span className="text-2xl">{projectWithParticipants.icon}</span>
                ) : (
                  <TrendingUp className="w-6 h-6" style={{ color: projectWithParticipants.color }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold break-words">{projectWithParticipants.name}</h1>
                <p className="text-muted-foreground">{projectWithParticipants.description}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canManage && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowEditProjectForm(true)}
              >
                <Settings className="w-4 h-4" />
              </Button>
            )}
            {canManage && (
          <Button
            onClick={() => setShowTaskForm(true)}
                className="gradient-primary text-white hover:opacity-90"
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">New Task</span>
          </Button>
            )}
          </div>
        </div>

        {/* Stats Card */}
        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Progress */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Progress</span>
                <span className="text-sm font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-3" />
              <div className="text-xs text-muted-foreground">
                {completedCount} of {totalTasks} tasks completed
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{needsActionTasks.length}</div>
                <div className="text-xs text-muted-foreground">Needs Action</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{activeTasks.length}</div>
                <div className="text-xs text-muted-foreground">Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-status-completed">{completedTasks.length}</div>
                <div className="text-xs text-muted-foreground">Done</div>
              </div>
            </div>

            {/* Participants */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Team Members</span>
                </div>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddMemberForm(true)}
                    className="h-8"
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                )}
              </div>
              {projectWithParticipants.participants && projectWithParticipants.participants.length > 0 && (
                <div className="space-y-2">
                  {participants.map((participant) => {
                    const user = participant.user;
                    if (!user) return null;
                    
                    return (
                      <div key={participant.userId} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-8 h-8 ring-2 ring-background border border-border">
                            <AvatarImage src={user.avatar} alt={user.name} />
                            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{user.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{user.handle}</div>
                </div>
                        </div>
                        {/* Show role badge for all users, but only owner can change it */}
                        {isOwner && participant.userId !== currentUser.id ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8">
                                <Badge variant="outline">{participant.role}</Badge>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleUpdateRole(participant.userId, 'manager')}>
                                Set as Manager
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleUpdateRole(participant.userId, 'participant')}>
                                Set as Participant
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleRemoveParticipant(participant.userId)}
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <Badge variant="outline">{participant.role}</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Tasks Tabs */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="habits">
              <Repeat className="w-4 h-4 mr-1" />
              Habits
            </TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-6">
            {needsActionTasks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">Needs Action</h3>
                </div>
                <div className="space-y-3">
                  {needsActionTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      completionLogs={completionLogs}
                      onComplete={handleComplete}
                      onRecover={handleRecover}
                    />
                  ))}
                </div>
              </div>
            )}

            {completedTasks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-status-completed" />
                  <h3 className="text-lg font-semibold">Mission Accomplished</h3>
                </div>
                <div className="space-y-3 opacity-60">
                  {completedTasks.map(task => (
                    <TaskCard key={task.id} task={task} completionLogs={completionLogs} />
                  ))}
                </div>
              </div>
            )}

            {archivedTasks.length > 0 && (
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">Another chance ?</h3>
                </div>
                <div className="space-y-3">
                  {archivedTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                      completionLogs={completionLogs}
                      onRecover={handleRecover}
                    />
                  ))}
                </div>
            </div>
            )}

            {projectTasks.length === 0 && (
              <EmptyState onCreateTask={() => setShowTaskForm(true)} />
            )}
          </TabsContent>

          <TabsContent value="active">
            <div className="space-y-3">
              {activeTasks.length > 0 ? (
                activeTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    completionLogs={completionLogs}
                    onComplete={handleComplete}
                    onRecover={handleRecover}
                  />
                ))
              ) : (
                <div className="text-center py-12">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No active tasks</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="completed">
            <div className="space-y-3 opacity-60">
              {completedTasks.length > 0 ? (
                completedTasks.map(task => (
                  <TaskCard key={task.id} task={task} />
                ))
              ) : (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No completed tasks yet</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="upcoming">
            <div className="space-y-3">
              {upcomingTasks.length > 0 ? (
                upcomingTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    completionLogs={completionLogs}
                  />
                ))
              ) : (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No upcoming tasks</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="habits">
            <div className="space-y-3">
              {habitTasks.length > 0 ? (
                habitTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    completionLogs={completionLogs}
                    onComplete={handleComplete}
                    onRecover={handleRecover}
                  />
                ))
              ) : (
                <div className="text-center py-12">
                  <Repeat className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">No habit tasks yet</p>
                  {canManage && (
                  <Button onClick={() => setShowTaskForm(true)} variant="outline">
                    Create Habit Task
                  </Button>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="archived">
            <div className="space-y-3">
              {archivedTasks.length > 0 ? (
                archivedTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onRecover={handleRecover}
                  />
                ))
              ) : (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No archived tasks</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <TaskForm
        open={showTaskForm}
        onOpenChange={setShowTaskForm}
        onSubmit={handleCreateTask}
        project={projectWithParticipants}
      />

      {/* Add Member Dialog */}
      <Dialog open={showAddMemberForm} onOpenChange={setShowAddMemberForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Add a new member to this project by entering their email address
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddMember();
                  }
                }}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddMemberForm(false);
                  setMemberEmail('');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddMember}
                disabled={!memberEmail.trim()}
                className="flex-1 gradient-primary text-white"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Member
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={showEditProjectForm} onOpenChange={setShowEditProjectForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update project name and description
            </DialogDescription>
          </DialogHeader>

          <EditProjectForm
            project={projectWithParticipants}
            onSave={handleEditProject}
            onCancel={() => setShowEditProjectForm(false)}
          />
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

const EmptyState = ({ onCreateTask }: { onCreateTask: () => void }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="text-center py-16"
  >
    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
      <Sparkles className="w-10 h-10 text-muted-foreground" />
    </div>
    <h3 className="text-xl font-semibold mb-2">No tasks yet</h3>
    <p className="text-muted-foreground mb-6">
      Create your first task to start building momentum together
    </p>
    <Button onClick={onCreateTask} className="gradient-primary text-white">
      <Plus className="w-4 h-4 mr-2" />
      Create First Task
    </Button>
  </motion.div>
);

const EditProjectForm = ({ 
  project, 
  onSave, 
  onCancel 
}: { 
  project: Project; 
  onSave: (data: { name: string; description: string }) => void;
  onCancel: () => void;
}) => {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name: name.trim(), description: description.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="name">Project Name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1 gradient-primary text-white"
        >
          Save Changes
        </Button>
      </div>
    </form>
  );
};

export default ProjectDetail;
