import { TaskCard } from '@/components/tasks/TaskCard';
import { Clock, CheckCircle2, Sparkles, Repeat } from 'lucide-react';
import type { Task, CompletionLog } from '@/types';

interface TaskSectionProps {
  title: string;
  icon: React.ReactNode;
  tasks: Task[];
  completionLogs: CompletionLog[];
  onRecover?: (taskId: string | number) => void;
  className?: string;
}

export const TaskSection = ({
  title,
  icon,
  tasks,
  completionLogs,
  onRecover,
  className = '',
}: TaskSectionProps) => {
  if (tasks.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <div className="space-y-3">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            completionLogs={completionLogs}
            onRecover={onRecover}
          />
        ))}
      </div>
    </div>
  );
};

interface ProjectTaskSectionsProps {
  activeTasks: Task[];
  upcomingTasks: Task[];
  completedTasks: Task[];
  archivedTasks: Task[];
  completionLogs: CompletionLog[];
  onRecover: (taskId: string | number) => void;
}

export const ProjectTaskSections = ({
  activeTasks,
  upcomingTasks,
  completedTasks,
  archivedTasks,
  completionLogs,
  onRecover,
}: ProjectTaskSectionsProps) => {
  return (
    <>
      {activeTasks.length > 0 && (
        <TaskSection
          title="Active"
          icon={<Sparkles className="w-5 h-5 text-accent" />}
          tasks={activeTasks}
          completionLogs={completionLogs}
          onRecover={onRecover}
        />
      )}

      {upcomingTasks.length > 0 && (
        <TaskSection
          title="Upcoming"
          icon={<Clock className="w-5 h-5 text-muted-foreground" />}
          tasks={upcomingTasks}
          completionLogs={completionLogs}
        />
      )}

      {completedTasks.length > 0 && (
        <TaskSection
          title="Completed"
          icon={<CheckCircle2 className="w-5 h-5 text-status-completed" />}
          tasks={completedTasks}
          completionLogs={completionLogs}
          className="opacity-60"
        />
      )}

      {archivedTasks.length > 0 && (
        <TaskSection
          title="Archived"
          icon={<Clock className="w-5 h-5 text-muted-foreground" />}
          tasks={archivedTasks}
          completionLogs={completionLogs}
          onRecover={onRecover}
        />
      )}
    </>
  );
};

