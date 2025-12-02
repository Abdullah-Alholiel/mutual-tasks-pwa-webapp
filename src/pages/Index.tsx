import { AppLayout } from '@/components/layout/AppLayout';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskForm } from '@/components/tasks/TaskForm';
import { getTodayTasks, mockTasks, mockProjects, mockUsers, currentUser, mapTaskStatusForUI, mockTaskStatuses, mockCompletionLogs } from '@/lib/mockData';
import { motion } from 'framer-motion';
import { Calendar, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';
import { Task, Project, DifficultyRating, TaskStatusEntity, TaskStatusUserStatus, TimingStatus, RingColor } from '@/types';

const Index = () => {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [taskStatuses, setTaskStatuses] = useState<TaskStatusEntity[]>(mockTaskStatuses);
  const [completionLogs, setCompletionLogs] = useState(mockCompletionLogs);
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [showTaskForm, setShowTaskForm] = useState(false);

  // Get today's tasks for current user
  const todayTasks = getTodayTasks(currentUser.id);

  // Helper to get task status for a user
  const getTaskStatusForUser = (taskId: string, userId: string): TaskStatusEntity | undefined => {
    return taskStatuses.find(ts => ts.taskId === taskId && ts.userId === userId);
  };

  // Helper to update task with statuses
  const updateTaskWithStatuses = (task: Task): Task => {
    return {
      ...task,
      taskStatuses: taskStatuses.filter(ts => ts.taskId === task.id)
    };
  };


  const handleRecover = (taskId: string) => {
    const now = new Date();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Update task status from 'archived' to 'active'
    setTaskStatuses(prev =>
      prev.map(ts => {
        if (ts.taskId === taskId && ts.userId === currentUser.id && ts.status === 'archived') {
          return {
            ...ts,
            status: 'active' as TaskStatusUserStatus,
            recoveredAt: now,
            archivedAt: undefined,
            ringColor: 'yellow', // Yellow ring for recovered tasks
            timingStatus: 'late',
            updatedAt: now
          };
        }
        return ts;
      })
    );

    // Update task status to active
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

    // Check if task is recovered (completed after due date)
    const isRecovered = myTaskStatus.recoveredAt !== undefined;
    const isBeforeDueDate = now <= myTaskStatus.effectiveDueDate;
    const penaltyApplied = isRecovered && !isBeforeDueDate;

    // Calculate XP (base: difficulty * 100, half if penalty applied)
    const baseXP = (difficultyRating || 3) * 100;
    const xpEarned = penaltyApplied ? Math.floor(baseXP / 2) : baseXP;

    // Determine timing status
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

    // Create completion log
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

  // Filter tasks for today - tasks should appear for all project participants
  const myTasks = tasks
    .map(updateTaskWithStatuses)
    .filter(task => {
      const dueDate = new Date(task.originalDueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);
      const isToday = dueDate.getTime() === today.getTime();
      
      if (!isToday) return false;
      
      // Get project participants
      const project = projects.find(p => p.id === task.projectId);
      const projectParticipants = project?.participants || project?.participantRoles?.map(pr => {
        const user = mockUsers.find(u => u.id === pr.userId);
        return user;
      }).filter(Boolean) || [];
      
      // Task should appear if user is in project participants or is creator
      const isInProject = projectParticipants.some(p => 
        (typeof p === 'object' && 'id' in p ? p.id : p) === currentUser.id
      ) || task.creatorId === currentUser.id;
      
      return isInProject;
    });

  // Needs Your Action: tasks where user status is active but not completed
  const pendingTasks = myTasks.filter(task => {
    const myStatus = getTaskStatusForUser(task.id, currentUser.id);
    const myCompletion = completionLogs.some(cl => cl.taskId === task.id && cl.userId === currentUser.id);
    // Active tasks that are not completed, including recovered tasks
    return (myStatus?.status === 'active' || myStatus?.recoveredAt) && 
           !myCompletion && 
           task.status !== 'completed' &&
           !myStatus?.archivedAt; // Exclude tasks that are still archived
  });
  
  // Done for the Day: completed tasks
  const completedTasks = myTasks.filter(task => {
    const myCompletion = completionLogs.some(cl => cl.taskId === task.id && cl.userId === currentUser.id);
    return myCompletion || task.status === 'completed';
  });
  
  // Another Chance?: archived tasks (not recovered, not completed)
  const archivedTasks = myTasks.filter(task => {
    const myStatus = getTaskStatusForUser(task.id, currentUser.id);
    const myCompletion = completionLogs.some(cl => cl.taskId === task.id && cl.userId === currentUser.id);
    // Only show if archived, not recovered, and not completed
    return (myStatus?.status === 'archived' || task.status === 'archived') && 
           !myStatus?.recoveredAt && 
           !myCompletion;
  });

  const handleCreateProject = (projectData: {
    name: string;
    description: string;
    participants: string[];
    color: string;
    isPublic: boolean;
  }): Project => {
    const participantUsers = [currentUser, ...projectData.participants.map(id => mockUsers.find(u => u.id === id)!).filter(Boolean)];
    
    const newProject: Project = {
      id: `p${Date.now()}`,
      name: projectData.name,
      description: projectData.description,
      ownerId: currentUser.id,
      totalTasks: 0,
      isPublic: projectData.isPublic,
      createdAt: new Date(),
      updatedAt: new Date(),
      color: projectData.color,
      participants: participantUsers,
      completedTasks: 0,
      progress: 0
    };

    setProjects(prev => [newProject, ...prev]);
    toast.success('Project created! 🎉');
    return newProject;
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
      // Generate recurring tasks
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
        const project = projects.find(p => p.id === taskData.projectId);
        const projectParticipants = project?.participants || project?.participantRoles?.map(pr => {
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

        // Move to next occurrence
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
      // One-off task
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
      const project = projects.find(p => p.id === taskData.projectId);
      const projectParticipants = project?.participants || project?.participantRoles?.map(pr => {
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
    
    // Update project totalTasks
    setProjects(prev =>
      prev.map(project => {
        if (project.id === taskData.projectId) {
          const projectTasks = [...newTasks, ...tasks].filter(t => t.projectId === project.id);
          return {
            ...project,
            totalTasks: projectTasks.length,
            updatedAt: new Date()
          };
        }
        return project;
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

  return (
    <AppLayout>
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

          <Button
            onClick={() => setShowTaskForm(true)}
            className="gradient-primary text-white hover:opacity-90"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
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
              {pendingTasks.length}
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
              {completedTasks.length}
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
              {archivedTasks.length}
            </div>
            <div className="text-sm text-muted-foreground">Archived</div>
          </motion.div>
        </div>

        {/* Needs Your Action */}
        {pendingTasks.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              <h2 className="text-xl font-semibold">Needs Your Action</h2>
            </div>
            <div className="space-y-3">
              {pendingTasks.map((task) => (
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

        {/* Done for the Day */}
        {completedTasks.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Done for the Day</h2>
            <div className="space-y-3 opacity-60">
              {completedTasks.map((task) => (
                <TaskCard key={task.id} task={task} completionLogs={completionLogs} />
              ))}
            </div>
          </div>
        )}

        {/* Another Chance? */}
        {archivedTasks.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Another Chance ?</h2>
            <div className="space-y-3">
              {archivedTasks.map((task) => (
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

        {/* Empty state */}
        {myTasks.length === 0 && (
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
            <Button
              onClick={() => setShowTaskForm(true)}
              className="gradient-primary text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Task
            </Button>
          </motion.div>
        )}
      </div>

      <TaskForm
        open={showTaskForm}
        onOpenChange={setShowTaskForm}
        onSubmit={handleCreateTask}
        projects={projects}
        allowProjectSelection={true}
        onCreateProject={handleCreateProject}
      />
    </AppLayout>
  );
};

export default Index;
