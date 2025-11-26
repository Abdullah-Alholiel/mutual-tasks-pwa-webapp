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
import { getProjectById, mockTasks, currentUser, mockProjects, mapTaskStatusForUI } from '@/lib/mockData';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Users, TrendingUp, Clock, CheckCircle2, Sparkles, Repeat, UserPlus } from 'lucide-react';
import { Task, Project, DifficultyRating } from '@/types';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { mockUsers } from '@/lib/mockData';

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // Check if project was passed via location state (from Projects page)
  const projectFromState = location.state?.project as Project | undefined;
  const projectFromData = getProjectById(id || '');
  const project = projectFromState || projectFromData;
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [tasks, setTasks] = useState(mockTasks);
  const [projects, setProjects] = useState(mockProjects);

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
  
  const projectTasks = tasks.filter(t => t.projectId === currentProject.id);
  
  // Calculate progress dynamically from tasks
  const totalTasks = projectTasks.length;
  const completedCount = projectTasks.filter(t => {
    const uiStatus = mapTaskStatusForUI(t.status);
    return uiStatus === 'completed';
  }).length;
  
  const progress = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

  const pendingTasks = projectTasks.filter(t => mapTaskStatusForUI(t.status) === 'pending');
  const activeTasks = projectTasks.filter(t => mapTaskStatusForUI(t.status) === 'accepted');
  const completedTasks = projectTasks.filter(t => mapTaskStatusForUI(t.status) === 'completed');
  const recurringTasks = projectTasks.filter(t => t.type === 'recurring');

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
              // If no matching day found in 2 weeks, advance by interval weeks
              if (!found) {
                currentDate.setDate(currentDate.getDate() + (interval * 7) - attempts);
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
      
      // Update project progress
      const projectTasks = updatedTasks.filter(t => t.projectId === project.id);
      const totalTasks = projectTasks.length;
      const completedCount = projectTasks.filter(t => {
        const uiStatus = mapTaskStatusForUI(t.status);
        return uiStatus === 'completed';
      }).length;
      
      // Note: In a real app, we'd update the project state here
      // For now, the progress is calculated on the fly
      
      return updatedTasks;
    });
    
    toast.success(
      newTasks.length > 1 
        ? `${newTasks.length} recurring tasks created! 🚀`
        : 'Task initiated! 🚀',
      {
        description: 'Waiting for your friend to accept'
      }
    );
  };

  const handleAddMember = () => {
    if (!memberEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    // Find user by email
    const userToAdd = mockUsers.find(u => u.email.toLowerCase() === memberEmail.toLowerCase().trim());
    
    if (!userToAdd) {
      toast.error('User not found', {
        description: 'No user with this email exists in the system'
      });
      return;
    }

    if (currentProject.participantIds?.includes(userToAdd.id)) {
      toast.error('User already in project', {
        description: 'This user is already a member of this project'
      });
      return;
    }

    // Add member to project
    setProjects(prev =>
      prev.map(p => {
        if (p.id === currentProject.id) {
          const updatedParticipants = p.participants 
            ? [...p.participants, userToAdd]
            : [userToAdd];
          
          return {
            ...p,
            participantIds: [...(p.participantIds || []), userToAdd.id],
            participants: updatedParticipants
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
                <h1 className="text-2xl md:text-3xl font-bold break-words">{currentProject.name}</h1>
                <p className="text-muted-foreground">{currentProject.description}</p>
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
                {completedCount} of {totalTasks} tasks completed
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
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Team Members</span>
                </div>
                {currentProject.ownerId === currentUser.id && (
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
              {currentProject.participants && currentProject.participants.length > 0 && (
                <div className="flex -space-x-2">
                  {currentProject.participants.map((participant) => (
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
              )}
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
                      onProposeTime={handleProposeTime}
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
                    onProposeTime={handleProposeTime}
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
        project={currentProject}
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
