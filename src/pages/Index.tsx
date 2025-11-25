import { AppLayout } from '@/components/layout/AppLayout';
import { TaskCard } from '@/components/tasks/TaskCard';
import { getTodayTasks, mockTasks } from '@/lib/mockData';
import { motion } from 'framer-motion';
import { Calendar, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const Index = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState(mockTasks);
  const todayTasks = getTodayTasks();

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

  const myTasks = todayTasks.filter(t => {
    const task = tasks.find(mt => mt.id === t.id);
    return task && (task.creatorId === '1' || task.assigneeId === '1');
  });

  const pendingTasks = myTasks.filter(t => {
    const task = tasks.find(mt => mt.id === t.id);
    return task?.status === 'pending';
  });
  
  const activeTasks = myTasks.filter(t => {
    const task = tasks.find(mt => mt.id === t.id);
    return task?.status === 'accepted';
  });
  
  const completedTasks = myTasks.filter(t => {
    const task = tasks.find(mt => mt.id === t.id);
    return task?.status === 'completed';
  });

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
            onClick={() => navigate('/projects')}
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
              {pendingTasks.map((task) => {
                const fullTask = tasks.find(t => t.id === task.id);
                return fullTask ? (
                  <TaskCard
                    key={task.id}
                    task={fullTask}
                    onAccept={handleAccept}
                    onDecline={handleDecline}
                  />
                ) : null;
              })}
            </div>
          </div>
        )}

        {/* Active tasks */}
        {activeTasks.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">In Progress</h2>
            <div className="space-y-3">
              {activeTasks.map((task) => {
                const fullTask = tasks.find(t => t.id === task.id);
                return fullTask ? (
                  <TaskCard
                    key={task.id}
                    task={fullTask}
                    onComplete={handleComplete}
                  />
                ) : null;
              })}
            </div>
          </div>
        )}

        {/* Completed tasks */}
        {completedTasks.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Completed</h2>
            <div className="space-y-3 opacity-60">
              {completedTasks.map((task) => {
                const fullTask = tasks.find(t => t.id === task.id);
                return fullTask ? <TaskCard key={task.id} task={fullTask} /> : null;
              })}
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
              onClick={() => navigate('/projects')}
              className="gradient-primary text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Task
            </Button>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
};

export default Index;
