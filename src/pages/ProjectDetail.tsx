import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskForm } from '@/components/tasks/TaskForm';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getProjectById, mockTasks, currentUser } from '@/lib/mockData';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Users, TrendingUp, Clock, CheckCircle2, Sparkles, Repeat } from 'lucide-react';
import { Task } from '@/types';
import { toast } from 'sonner';

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const project = getProjectById(id || '');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [tasks, setTasks] = useState(mockTasks);

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

  const projectTasks = tasks.filter(t => t.projectId === project.id);
  const progress = (project.completedTasks / project.totalTasksPlanned) * 100;

  const pendingTasks = projectTasks.filter(t => t.status === 'pending');
  const activeTasks = projectTasks.filter(t => t.status === 'accepted');
  const completedTasks = projectTasks.filter(t => t.status === 'completed');
  const recurringTasks = projectTasks.filter(t => t.type === 'recurring');

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
              [currentUser.id]: {
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

  const handleCreateTask = (taskData: {
    title: string;
    description: string;
    assigneeId: string;
    type: 'one_off' | 'recurring';
    recurrencePattern?: 'daily' | 'weekly' | 'custom';
    dueDate?: Date;
  }) => {
    const newTask: Task = {
      id: `t${Date.now()}`,
      projectId: project.id,
      creatorId: currentUser.id,
      assigneeId: taskData.assigneeId,
      type: taskData.type,
      recurrencePattern: taskData.recurrencePattern,
      title: taskData.title,
      description: taskData.description,
      status: 'pending',
      createdAt: new Date(),
      dueDate: taskData.dueDate,
      completions: {
        [currentUser.id]: { completed: false },
        [taskData.assigneeId]: { completed: false }
      }
    };

    setTasks(prev => [newTask, ...prev]);
    toast.success('Task initiated! 🚀', {
      description: 'Waiting for your friend to accept'
    });
  };

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
                style={{ backgroundColor: `${project.color}15` }}
              >
                <TrendingUp className="w-6 h-6" style={{ color: project.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold truncate">{project.name}</h1>
                <p className="text-muted-foreground">{project.description}</p>
              </div>
            </div>
          </div>

          <Button
            onClick={() => setShowTaskForm(true)}
            className="gradient-primary text-white hover:opacity-90 shrink-0"
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">New Task</span>
          </Button>
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
                {project.completedTasks} of {project.totalTasksPlanned} tasks completed
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-status-pending">{pendingTasks.length}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-status-accepted">{activeTasks.length}</div>
                <div className="text-xs text-muted-foreground">Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-status-completed">{completedTasks.length}</div>
                <div className="text-xs text-muted-foreground">Done</div>
              </div>
            </div>

            {/* Participants */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Team Members</span>
              </div>
              <div className="flex -space-x-2">
                {project.participants.map((participant) => (
                  <Avatar
                    key={participant.id}
                    className="w-10 h-10 ring-2 ring-background border border-border"
                    title={participant.name}
                  >
                    <AvatarImage src={participant.avatar} alt={participant.name} />
                    <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Tasks Tabs */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">
              Pending {pendingTasks.length > 0 && (
                <Badge variant="secondary" className="ml-2">{pendingTasks.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="recurring">
              <Repeat className="w-4 h-4 mr-1" />
              Recurring
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-6">
            {pendingTasks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-status-pending" />
                  <h3 className="text-lg font-semibold">Needs Action</h3>
                </div>
                <div className="space-y-3">
                  {pendingTasks.map(task => (
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

            {activeTasks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-status-accepted" />
                  <h3 className="text-lg font-semibold">In Progress</h3>
                </div>
                <div className="space-y-3">
                  {activeTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onComplete={handleComplete}
                    />
                  ))}
                </div>
              </div>
            )}

            {completedTasks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-status-completed" />
                  <h3 className="text-lg font-semibold">Completed</h3>
                </div>
                <div className="space-y-3 opacity-60">
                  {completedTasks.map(task => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </div>
            )}

            {projectTasks.length === 0 && (
              <EmptyState onCreateTask={() => setShowTaskForm(true)} />
            )}
          </TabsContent>

          <TabsContent value="pending">
            <div className="space-y-3">
              {pendingTasks.length > 0 ? (
                pendingTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onAccept={handleAccept}
                    onDecline={handleDecline}
                  />
                ))
              ) : (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No pending tasks</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="active">
            <div className="space-y-3">
              {activeTasks.length > 0 ? (
                activeTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={handleComplete}
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

          <TabsContent value="recurring">
            <div className="space-y-3">
              {recurringTasks.length > 0 ? (
                recurringTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onAccept={handleAccept}
                    onDecline={handleDecline}
                    onComplete={handleComplete}
                  />
                ))
              ) : (
                <div className="text-center py-12">
                  <Repeat className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">No recurring tasks yet</p>
                  <Button onClick={() => setShowTaskForm(true)} variant="outline">
                    Create Recurring Task
                  </Button>
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
        project={project}
      />
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

export default ProjectDetail;
