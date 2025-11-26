import { AppLayout } from '@/components/layout/AppLayout';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskForm } from '@/components/tasks/TaskForm';
import { getTodayTasks, mockTasks, mockProjects, mockUsers, currentUser, mapTaskStatusForUI } from '@/lib/mockData';
import { motion } from 'framer-motion';
import { Calendar, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';
import { Task, Project, DifficultyRating } from '@/types';

const Index = () => {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [showTaskForm, setShowTaskForm] = useState(false);
  // Get today's tasks for current user
  const todayTasks = getTodayTasks(currentUser.id);

  const handleAccept = (taskId: string) => {
    setTasks(prev =>
      prev.map(task => {
        if (task.id === taskId) {
          // If accepting a time proposal, update the due date
          if (task.status === 'time_proposed' && task.proposedDueDate) {
            return {
              ...task,
              status: 'accepted' as const,
              acceptedAt: new Date(),
              dueDate: task.proposedDueDate,
              proposedDueDate: undefined,
              proposedByUserId: undefined
            };
          }
          return { ...task, status: 'accepted' as const, acceptedAt: new Date() };
        }
        return task;
      })
    );
    toast.success('Task accepted! Let\'s do this together 🎯');
  };

  const handleDecline = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
    toast('Task declined');
  };

  const handleProposeTime = (taskId: string, proposedDate: Date) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === taskId
          ? {
              ...task,
              status: 'time_proposed' as const,
              proposedDueDate: proposedDate,
              proposedByUserId: currentUser.id
            }
          : task
      )
    );
    toast.success('Time proposed! ⏰', {
      description: 'Waiting for response...'
    });
  };

  const handleComplete = (taskId: string, difficultyRating?: number) => {
    setTasks(prev => {
      let allCompleted = false;
      
      const updatedTasks = prev.map(task => {
        if (task.id === taskId) {
          const updatedCompletions = {
            ...task.completions,
            [currentUser.id]: {
              completed: true,
              completedAt: new Date(),
              difficultyRating: difficultyRating as DifficultyRating | undefined
            }
          };

          // Check if all users have completed the task
          const allUsers = [task.creatorId, task.assigneeId];
          allCompleted = allUsers.every(userId => 
            updatedCompletions[userId]?.completed === true
          );

          return {
            ...task,
            status: allCompleted ? ('completed' as const) : task.status,
            completedAt: allCompleted ? new Date() : task.completedAt,
            completions: updatedCompletions
          };
        }
        return task;
      });
      
      // Show toast based on the updated state
      if (allCompleted) {
        toast.success('Amazing work! 🎉', {
          description: 'Task completed by everyone!'
        });
      } else {
        toast.success('Great job! 💪', {
          description: 'Waiting for your partner to complete...'
        });
      }
      
      return updatedTasks;
    });
  };

  // myTasks should use the tasks from state (which includes newly created ones)
  // Filter to show tasks where current user is creator or assignee
  const myTasks = tasks.filter(task => {
    // Check if task is due today
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    if (!dueDate) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    const isToday = dueDate.getTime() === today.getTime();
    
    if (!isToday) return false;
    
    // Check if current user is creator or assignee
    return task.creatorId === currentUser.id || task.assigneeId === currentUser.id;
  });

  const pendingTasks = myTasks.filter(task => {
    const uiStatus = mapTaskStatusForUI(task.status);
    return uiStatus === 'pending';
  });
  
  const activeTasks = myTasks.filter(task => {
    const uiStatus = mapTaskStatusForUI(task.status);
    return uiStatus === 'accepted';
  });
  
  const completedTasks = myTasks.filter(task => {
    const uiStatus = mapTaskStatusForUI(task.status);
    return uiStatus === 'completed';
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
      participantIds: [currentUser.id, ...projectData.participants],
      totalTasksPlanned: 0,
      isPublic: projectData.isPublic,
      createdAt: new Date(),
      updatedAt: new Date(),
      color: projectData.color,
      // Populated for UI
      participants: participantUsers,
      completedTasks: 0,
      progress: 0
    };

    setProjects(prev => [newProject, ...prev]);
    toast.success('Project created! 🎉');
    return newProject;
  };

  const handleCreateTask = (taskData: {
    title: string;
    description: string;
    assigneeId: string;
    projectId: string;
    type: 'one_off' | 'recurring';
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

    if (taskData.type === 'recurring' && taskData.dueDate && taskData.recurrencePattern) {
      // Generate recurring tasks based on pattern
      const startDate = new Date(taskData.dueDate);
      // Preserve the time from the original due date
      startDate.setHours(
        taskData.dueDate.getHours(),
        taskData.dueDate.getMinutes(),
        0,
        0
      );
      
      let endDate: Date;
      if (taskData.recurrencePattern === 'custom' && taskData.customRecurrence) {
        // Use custom recurrence end condition
        if (taskData.customRecurrence.endType === 'date' && taskData.customRecurrence.endDate) {
          endDate = new Date(taskData.customRecurrence.endDate);
          endDate.setHours(23, 59, 59, 999);
        } else {
          // Calculate end date based on occurrence count
          endDate = new Date(startDate);
          const maxOccurrences = taskData.customRecurrence.occurrenceCount || 10;
          // Estimate end date (will be refined in loop)
          endDate.setDate(endDate.getDate() + (maxOccurrences * 30));
        }
      } else {
        // For daily/weekly, generate tasks for a reasonable period (4 weeks)
        endDate = new Date(startDate);
        if (taskData.recurrencePattern === 'daily') {
          endDate.setDate(endDate.getDate() + 28); // 4 weeks
        } else if (taskData.recurrencePattern === 'weekly') {
          endDate.setDate(endDate.getDate() + 28); // 4 weeks
        }
        endDate.setHours(23, 59, 59, 999);
      }
      
      let currentDate = new Date(startDate);
      let taskIndex = 0;
      let occurrenceCount = 0;
      const maxOccurrences = taskData.customRecurrence?.occurrenceCount || (taskData.recurrencePattern === 'daily' ? 28 : taskData.recurrencePattern === 'weekly' ? 4 : 999);

      while (currentDate <= endDate && occurrenceCount < maxOccurrences) {
        const taskDueDate = new Date(currentDate);
        // Preserve the time from the original due date
        taskDueDate.setHours(
          taskData.dueDate.getHours(),
          taskData.dueDate.getMinutes(),
          0,
          0
        );

        const newTask: Task = {
          id: `t${Date.now()}-${taskIndex}`,
          projectId: taskData.projectId,
          creatorId: currentUser.id,
          assigneeId: taskData.assigneeId,
          type: taskData.type,
          recurrencePattern: taskData.recurrencePattern,
          title: taskData.title,
          description: taskData.description,
          status: 'pending_acceptance',
          initiatedAt: new Date(),
          dueDate: taskDueDate,
          initiatedByUserId: currentUser.id,
          isMirrorCompletionVisible: true,
          createdAt: new Date(),
          completions: {
            [currentUser.id]: { completed: false },
            [taskData.assigneeId]: { completed: false }
          }
        };

        newTasks.push(newTask);
        taskIndex++;
        occurrenceCount++;

        // Move to next occurrence
        if (taskData.recurrencePattern === 'daily') {
          currentDate.setDate(currentDate.getDate() + 1);
        } else if (taskData.recurrencePattern === 'weekly') {
          currentDate.setDate(currentDate.getDate() + 7);
        } else if (taskData.recurrencePattern === 'custom' && taskData.customRecurrence) {
          // Handle custom recurrence
          const { frequency, interval, daysOfWeek } = taskData.customRecurrence;
          
          if (frequency === 'days') {
            currentDate.setDate(currentDate.getDate() + interval);
          } else if (frequency === 'weeks') {
            if (daysOfWeek.length > 0) {
              // Find next occurrence on specified days
              const searchStartDate = new Date(currentDate);
              let found = false;
              let attempts = 0;
              while (!found && attempts < 14) {
                currentDate.setDate(currentDate.getDate() + 1);
                const dayOfWeek = currentDate.getDay();
                if (daysOfWeek.includes(dayOfWeek)) {
                  found = true;
                }
                attempts++;
              }
              // If no matching day found in 2 weeks, advance by interval weeks from search start
              if (!found) {
                currentDate = new Date(searchStartDate);
                currentDate.setDate(currentDate.getDate() + (interval * 7));
              }
            } else {
              currentDate.setDate(currentDate.getDate() + (interval * 7));
            }
          } else if (frequency === 'months') {
            currentDate.setMonth(currentDate.getMonth() + interval);
          }
          
          // Check if we've exceeded the end date
          if (taskData.customRecurrence.endType === 'date' && taskData.customRecurrence.endDate) {
            if (currentDate > taskData.customRecurrence.endDate) {
              break;
            }
          }
        } else {
          // Default to daily
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    } else {
      // One-off task
      const newTask: Task = {
        id: `t${Date.now()}`,
        projectId: taskData.projectId,
        creatorId: currentUser.id,
        assigneeId: taskData.assigneeId,
        type: taskData.type,
        recurrencePattern: taskData.recurrencePattern,
        title: taskData.title,
        description: taskData.description,
        status: 'pending_acceptance',
        initiatedAt: new Date(),
        dueDate: taskData.dueDate,
        initiatedByUserId: currentUser.id,
        isMirrorCompletionVisible: true,
        createdAt: new Date(),
        completions: {
          [currentUser.id]: { completed: false },
          [taskData.assigneeId]: { completed: false }
        }
      };
      newTasks.push(newTask);
    }

    setTasks(prev => {
      const updatedTasks = [...newTasks, ...prev];
      
      // Update project progress using the updated tasks
      if (taskData.projectId) {
        setProjects(projectPrev =>
          projectPrev.map(project => {
            if (project.id === taskData.projectId) {
              const currentTasks = updatedTasks.filter(t => t.projectId === project.id);
              const newTotalTasks = currentTasks.length;
              const completedCount = currentTasks.filter(t => {
                const uiStatus = mapTaskStatusForUI(t.status);
                return uiStatus === 'completed';
              }).length;
              
              return {
                ...project,
                totalTasksPlanned: newTotalTasks,
                completedTasks: completedCount,
                progress: newTotalTasks > 0 ? completedCount / newTotalTasks : 0
              };
            }
            return project;
          })
        );
      }
      
      return updatedTasks;
    });
    
    toast.success(
      newTasks.length > 1 
        ? `${newTasks.length} recurring tasks created! 🚀`
        : 'Task initiated! 🚀',
      {
        description: newTasks.length > 1 
          ? 'Waiting for your friend to accept'
          : 'Waiting for your friend to accept'
      }
    );
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
            <div className="text-2xl font-bold text-status-pending mb-1">
              {pendingTasks.length}
            </div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm"
          >
            <div className="text-2xl font-bold text-status-accepted mb-1">
              {activeTasks.length}
            </div>
            <div className="text-sm text-muted-foreground">Active</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm"
          >
            <div className="text-2xl font-bold text-status-completed mb-1">
              {completedTasks.length}
            </div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </motion.div>
        </div>

        {/* Tasks requiring acceptance */}
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
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                  onProposeTime={handleProposeTime}
                />
              ))}
            </div>
          </div>
        )}

        {/* Active tasks */}
        {activeTasks.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">In Progress</h2>
            <div className="space-y-3">
              {activeTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={handleComplete}
                />
              ))}
            </div>
          </div>
        )}

        {/* Completed tasks */}
        {completedTasks.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Completed</h2>
            <div className="space-y-3 opacity-60">
              {completedTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
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
