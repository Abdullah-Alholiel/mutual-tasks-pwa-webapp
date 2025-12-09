import { AppLayout } from '../../layout/AppLayout';
import { TaskCard } from '../tasks/components/TaskCard';
import { TaskForm } from '../tasks/components/TaskForm';
import { motion } from 'framer-motion';
import { Calendar, CheckCircle2, Plus, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { InlineLoader } from '../../components/ui/loader';
import { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { Task, TaskStatusEntity, CompletionLog } from '../../types';
import { 
  getTodayTasks, 
  getNeedsActionTasks, 
  getCompletedTasksForToday,
  getRecoveredTasks,
  updateTasksWithStatuses 
} from '../../lib/tasks/taskFilterUtils';
import { getProjectsWhereCanCreateTasks } from '../../lib/projects/projectUtils';
import { normalizeToStartOfDay } from '../../lib/tasks/taskUtils';
import { useAuth } from '../auth/useAuth';
import { useTodayTasks } from '../tasks/hooks/useTasks';
import { useProjects } from '../projects/hooks/useProjects';
import { useCreateTask } from '../tasks/hooks/useTasks';
import { useCreateCompletionLog, useUpdateTaskStatus } from '../tasks/hooks/useTasks';
import { getDatabaseClient } from '../../db';

const Index = () => {
  const { user, isAuthenticated } = useAuth();
  const { data: allProjects = [], isLoading: projectsLoading } = useProjects();
  const { data: todayTasksRaw = [], isLoading: tasksLoading } = useTodayTasks();
  const createTaskMutation = useCreateTask();
  const createCompletionLogMutation = useCreateCompletionLog();
  const updateTaskStatusMutation = useUpdateTaskStatus();
  
  const [taskStatuses, setTaskStatuses] = useState<TaskStatusEntity[]>([]);
  const [completionLogs, setCompletionLogs] = useState<CompletionLog[]>([]);
  const [showTaskForm, setShowTaskForm] = useState(false);

  // Fetch task statuses and completion logs
  useEffect(() => {
    if (!user || !isAuthenticated) return;

    const loadData = async () => {
      const db = getDatabaseClient();
      const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      
      try {
        const [statuses, logs] = await Promise.all([
          db.taskStatus.getByUserId(userId),
          db.completionLogs.getAll({ userId })
        ]);
        
        setTaskStatuses(statuses);
        setCompletionLogs(logs);
      } catch (error) {
        console.error('Failed to load task data:', error);
      }
    };

    loadData();
  }, [user, isAuthenticated]);

  // Update tasks with their statuses
  const tasksWithStatuses = useMemo(() => 
    updateTasksWithStatuses(todayTasksRaw, taskStatuses),
    [todayTasksRaw, taskStatuses]
  );

  // Update projects with participant roles for permission checking
  const projectsWithRoles = useMemo(() => 
    allProjects.map(project => ({
      ...project,
      participantRoles: project.participantRoles || []
    })),
    [allProjects]
  );

  // Get projects where user can create tasks (only owner/manager roles)
  const projectsWhereCanCreateTasks = useMemo(() => 
    user ? getProjectsWhereCanCreateTasks(projectsWithRoles, user.id) : [],
    [projectsWithRoles, user]
  );

  // Filter tasks for today using utility
  const myTasks = useMemo(() => {
    if (!user) return [];
    return getTodayTasks(tasksWithStatuses, user.id).filter(task => {
      // Task should appear if user is in project participants or is creator
      const project = allProjects.find(p => p.id === task.projectId);
      if (!project) return false;
      
      const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      const creatorId = typeof task.creatorId === 'string' ? parseInt(task.creatorId) : task.creatorId;
      const isCreator = creatorId === userId;
      
      const isInProject = project.participantRoles?.some(pr => {
        const prUserId = typeof pr.userId === 'string' ? parseInt(pr.userId) : pr.userId;
        return prUserId === userId && !pr.removedAt;
      }) || project.ownerId === userId || isCreator;
      
      return isInProject;
    });
  }, [tasksWithStatuses, allProjects, user]);

  const handleComplete = async (taskId: string | number, difficultyRating?: number) => {
    if (!user) return;

    const now = new Date();
    const task = tasksWithStatuses.find(t => {
      const tId = typeof t.id === 'string' ? parseInt(t.id) : t.id;
      const searchId = typeof taskId === 'string' ? parseInt(taskId) : taskId;
      return tId === searchId;
    });
    
    if (!task) {
      toast.error('Task not found');
      return;
    }

    const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    const taskIdNum = typeof taskId === 'string' ? parseInt(taskId) : taskId;
    const myTaskStatus = taskStatuses.find(ts => {
      const tsTaskId = typeof ts.taskId === 'string' ? parseInt(ts.taskId) : ts.taskId;
      const tsUserId = typeof ts.userId === 'string' ? parseInt(ts.userId) : ts.userId;
      return tsTaskId === taskIdNum && tsUserId === userId;
    });
    
    if (!myTaskStatus) {
      toast.error('Task status not found');
      return;
    }

    // Check if task is recovered
    const isRecovered = myTaskStatus.recoveredAt !== undefined;
    const taskDueDate = task.dueDate;
    const isBeforeDueDate = now <= taskDueDate;
    const penaltyApplied = isRecovered && !isBeforeDueDate;

    // Calculate XP
    const baseXP = (difficultyRating || 3) * 100;
    const xpEarned = penaltyApplied ? Math.floor(baseXP / 2) : baseXP;

    try {
      // Create completion log
      const newCompletionLog = await createCompletionLogMutation.mutateAsync({
        userId: userId,
        taskId: taskIdNum,
        difficultyRating: difficultyRating as 1 | 2 | 3 | 4 | 5 | undefined,
        penaltyApplied,
        xpEarned
      });

      // Update task status to completed
      await updateTaskStatusMutation.mutateAsync({
        id: myTaskStatus.id,
        data: {
          status: 'completed',
          ringColor: isRecovered ? 'yellow' : (isBeforeDueDate ? 'green' : 'none')
        }
      });

      // Update local state
      setCompletionLogs(prev => [...prev, newCompletionLog]);
      setTaskStatuses(prev => prev.map(ts => 
        ts.id === myTaskStatus.id 
          ? { ...ts, status: 'completed' as const, ringColor: isRecovered ? 'yellow' : (isBeforeDueDate ? 'green' : 'none') }
          : ts
      ));

      toast.success('Great job! 💪', {
        description: penaltyApplied 
          ? 'Waiting for your partner to complete... (Half XP - Recovered)'
          : 'Waiting for your partner to complete...'
      });
    } catch (error) {
      toast.error('Failed to complete task');
      console.error(error);
    }
  };

  // Filter tasks using utilities for today's view sections
  const needsActionTasks = useMemo(() => 
    user ? getNeedsActionTasks(myTasks, taskStatuses, completionLogs, user.id, projectsWithRoles) : [],
    [myTasks, taskStatuses, completionLogs, projectsWithRoles, user]
  );
  
  const completedTasksForToday = useMemo(() => 
    user ? getCompletedTasksForToday(myTasks, taskStatuses, completionLogs, user.id) : [],
    [myTasks, taskStatuses, completionLogs, user]
  );
  
  const recoveredTasks = useMemo(() => 
    user ? getRecoveredTasks(tasksWithStatuses, taskStatuses, completionLogs, user.id, projectsWithRoles) : [],
    [tasksWithStatuses, taskStatuses, completionLogs, projectsWithRoles, user]
  );

  const handleCreateTask = async (taskData: {
    title: string;
    description: string;
    projectId: string | number;
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
    try {
      const defaultDueDate = normalizeToStartOfDay(taskData.dueDate ?? new Date());
      
      if (taskData.type === 'habit' && taskData.dueDate && taskData.recurrencePattern) {
        // For habits, create multiple tasks
        // Note: This is simplified - in a real app you might want to create a recurrence entity
        const startDate = normalizeToStartOfDay(taskData.dueDate);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 28); // 28 days for habits
        
        const tasksToCreate: Array<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>> = [];
        let currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
          tasksToCreate.push({
            projectId: typeof taskData.projectId === 'string' ? parseInt(taskData.projectId) : taskData.projectId,
            creatorId: typeof user!.id === 'string' ? parseInt(user!.id) : user!.id,
            type: taskData.type,
            recurrencePattern: taskData.recurrencePattern,
            title: taskData.title,
            description: taskData.description,
            dueDate: normalizeToStartOfDay(new Date(currentDate))
          });
          
          if (taskData.recurrencePattern === 'Daily') {
            currentDate.setDate(currentDate.getDate() + 1);
          } else if (taskData.recurrencePattern === 'weekly') {
            currentDate.setDate(currentDate.getDate() + 7);
          } else {
            break;
          }
        }
        
        // Create all habit tasks
        await Promise.all(tasksToCreate.map(task => createTaskMutation.mutateAsync(task)));
        
        toast.success(`${tasksToCreate.length} habit tasks created! 🚀`, {
          description: 'Your friend has been notified to accept'
        });
      } else {
        // One-off task
        await createTaskMutation.mutateAsync({
          projectId: typeof taskData.projectId === 'string' ? parseInt(taskData.projectId) : taskData.projectId,
          creatorId: typeof user!.id === 'string' ? parseInt(user!.id) : user!.id,
          type: taskData.type,
          recurrencePattern: taskData.recurrencePattern,
          title: taskData.title,
          description: taskData.description,
          dueDate: defaultDueDate
        });
        
        toast.success('Task initiated! 🚀', {
          description: 'Your friend has been notified to accept'
        });
      }
      
      setShowTaskForm(false);
    } catch (error) {
      toast.error('Failed to create task');
      console.error(error);
    }
  };

  if (tasksLoading || projectsLoading) {
    return (
      <AppLayout>
        <InlineLoader text="Loading tasks..." />
      </AppLayout>
    );
  }

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

          {projectsWhereCanCreateTasks.length > 0 && (
            <Button
              onClick={() => setShowTaskForm(true)}
              className="gradient-primary text-white hover:opacity-90"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Task
            </Button>
          )}
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
              {needsActionTasks.length}
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
              {completedTasksForToday.length}
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
              {recoveredTasks.length}
            </div>
            <div className="text-sm text-muted-foreground">Recovered</div>
          </motion.div>
        </div>

        {/* Needs Your Action */}
        {needsActionTasks.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              <h2 className="text-xl font-semibold">Needs Your Action</h2>
            </div>
            <div className="space-y-3">
              {needsActionTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  completionLogs={completionLogs}
                  onComplete={handleComplete}
                  showRecover={false}
                />
              ))}
            </div>
          </div>
        )}

        {/* Done for the Day */}
        {completedTasksForToday.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-accent" />
              <h2 className="text-xl font-semibold">Done for the Day</h2>
            </div>
            <div className="space-y-3 opacity-60">
              {completedTasksForToday.map((task) => (
                <TaskCard key={task.id} task={task} completionLogs={completionLogs} />
              ))}
            </div>
          </div>
        )}

        {/* Another Chance? */}
        {recoveredTasks.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-accent" />
              <h2 className="text-xl font-semibold">Another Chance?</h2>
            </div>
            <div className="space-y-3">
              {recoveredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  completionLogs={completionLogs}
                  onComplete={handleComplete}
                  showRecover={false}
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
            {projectsWhereCanCreateTasks.length > 0 && (
              <Button
                onClick={() => setShowTaskForm(true)}
                className="gradient-primary text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Task
              </Button>
            )}
          </motion.div>
        )}
      </div>

      <TaskForm
        open={showTaskForm}
        onOpenChange={setShowTaskForm}
        onSubmit={handleCreateTask}
        projects={projectsWhereCanCreateTasks}
        allowProjectSelection={true}
      />
    </AppLayout>
  );
};

export default Index;
