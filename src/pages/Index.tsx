import { AppLayout } from '@/components/layout/AppLayout';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskForm } from '@/components/tasks/TaskForm';
import { getTodayTasks, mockTasks, mockProjects, mockUsers, currentUser, mapTaskStatusForUI } from '@/lib/mockData';
import { motion } from 'framer-motion';
import { Calendar, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';
import { Task, Project } from '@/types';

const Index = () => {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [showTaskForm, setShowTaskForm] = useState(false);
  // Get today's tasks for current user
  const todayTasks = getTodayTasks(currentUser.id);

  const handleAccept = (taskId: string) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === taskId ? { ...task, status: 'accepted' as const, acceptedAt: new Date() } : task
      )
    );
    toast.success('Task accepted! Let\'s do this together 🎯');
  };

  const handleDecline = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
    toast('Task declined');
  };

  const handleComplete = (taskId: string) => {
    setTasks(prev =>
      prev.map(task => {
        if (task.id === taskId) {
          return {
            ...task,
            status: 'completed' as const,
            completedAt: new Date(),
            completions: {
              ...task.completions,
              '1': {
                completed: true,
                completedAt: new Date(),
                difficultyRating: 3
              }
            }
          };
        }
        return task;
      })
    );
    toast.success('Amazing work! 🎉', {
      description: 'Keep up the momentum!'
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
  }): Project => {
    const participantUsers = [currentUser, ...projectData.participants.map(id => mockUsers.find(u => u.id === id)!).filter(Boolean)];
    
    const newProject: Project = {
      id: `p${Date.now()}`,
      name: projectData.name,
      description: projectData.description,
      ownerId: currentUser.id,
      participantIds: [currentUser.id, ...projectData.participants],
      totalTasksPlanned: 0,
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
  }) => {
    const newTask: Task = {
      id: `t${Date.now()}`,
      projectId: taskData.projectId,
      creatorId: currentUser.id,
      assigneeId: taskData.assigneeId,
      type: taskData.type,
      recurrencePattern: taskData.recurrencePattern,
      title: taskData.title,
      description: taskData.description,
      status: 'pending_acceptance', // New status system
      initiatedAt: new Date(),
      dueDate: taskData.dueDate,
      initiatedByUserId: currentUser.id,
      isMirrorCompletionVisible: true,
      createdAt: new Date(), // Legacy support
      completions: {
        [currentUser.id]: { completed: false },
        [taskData.assigneeId]: { completed: false }
      }
    };

    setTasks(prev => [newTask, ...prev]);
    toast.success('Task initiated! 🚀', {
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
