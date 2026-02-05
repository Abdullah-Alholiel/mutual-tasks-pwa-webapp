import { ReactNode, memo } from 'react';
import { TaskCard } from '../../tasks/components/TaskCard';
import { Clock, CheckCircle2, Sparkles } from 'lucide-react';
import type { Task, CompletionLog } from '@/types';

interface TaskSectionProps {
  title: string;
  icon: ReactNode;
  tasks: Task[];
  completionLogs: CompletionLog[];
  onRecover?: (taskId: string | number) => void;
  onComplete?: (taskId: string | number, difficultyRating?: number) => void;
  onDelete?: (taskId: string | number) => void;
  getOnEditTask?: (task: Task) => ((task: Task) => void) | undefined;
  className?: string;
  showMemberInfo?: boolean;
  titleClassName?: string;
}

/**
 * Optimized TaskSection component with CSS containment for scroll performance.
 * Uses content-visibility to optimize rendering of off-screen items.
 */
export const TaskSection = memo(({
  title,
  icon,
  tasks,
  completionLogs,
  onRecover,
  onComplete,
  onDelete,
  getOnEditTask,
  className = '',
  showMemberInfo,
  titleClassName = '',
}: TaskSectionProps) => {
  if (tasks.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        {icon}
        <h3 className={`text-lg font-semibold ${titleClassName}`}>{title}</h3>
      </div>
      {/* Optimized task container with GPU acceleration */}
      <div
        className="space-y-3"
        style={{
          // Enable GPU acceleration for smooth scrolling
          transform: 'translateZ(0)',
        }}
      >
        {tasks.map(task => (
          <div
            key={task.id}
            style={{
              // CSS containment for better paint performance
              contain: 'layout style',
              // Optimize off-screen rendering
              contentVisibility: 'auto',
              containIntrinsicSize: '0 260px',
            }}
          >
            <TaskCard
              task={task}
              completionLogs={completionLogs}
              onRecover={onRecover}
              onComplete={onComplete}
              onDelete={onDelete}
              onEdit={getOnEditTask ? getOnEditTask(task) : undefined}
              showMemberInfo={showMemberInfo}
            />
          </div>
        ))}
      </div>
    </div>
  );
});

TaskSection.displayName = 'TaskSection';

interface ProjectTaskSectionsProps {
  activeTasks: Task[];
  upcomingTasks: Task[];
  completedTasks: Task[];
  archivedTasks: Task[];
  completionLogs: CompletionLog[];
  onRecover?: (taskId: string | number) => void;
  onComplete?: (taskId: string | number, difficultyRating?: number) => void;
  onDelete?: (taskId: string | number) => void;
  getOnEditTask?: (task: Task) => ((task: Task) => void) | undefined;
  showMemberInfo?: boolean;
}

/**
 * Memoized ProjectTaskSections for optimal scroll performance.
 */
export const ProjectTaskSections = memo(({
  activeTasks,
  upcomingTasks,
  completedTasks,
  archivedTasks,
  completionLogs,
  onRecover,
  onComplete,
  onDelete,
  getOnEditTask,
  showMemberInfo,
}: ProjectTaskSectionsProps) => {
  return (
    <>
      {activeTasks.length > 0 && (
        <TaskSection
          title="Active"
          icon={<Sparkles className="w-6 h-6 text-accent" />}
          tasks={activeTasks}
          completionLogs={completionLogs}
          onRecover={onRecover}
          onComplete={onComplete}
          onDelete={onDelete}
          getOnEditTask={getOnEditTask}
          showMemberInfo={showMemberInfo}
        />
      )}

      {upcomingTasks.length > 0 && (
        <TaskSection
          title="Upcoming"
          icon={<Clock className="w-6 h-6 text-[#8b5cf6]" />}
          tasks={upcomingTasks}
          completionLogs={completionLogs}
          onComplete={onComplete}
          onDelete={onDelete}
          getOnEditTask={getOnEditTask}
          showMemberInfo={showMemberInfo}
          titleClassName="text-[#8b5cf6]"
        />
      )}

      {completedTasks.length > 0 && (
        <TaskSection
          title="Completed"
          icon={<CheckCircle2 className="w-6 h-6 text-status-completed" />}
          tasks={completedTasks}
          completionLogs={completionLogs}
          onDelete={onDelete}
          getOnEditTask={getOnEditTask}
          className="opacity-60"
          showMemberInfo={showMemberInfo}
        />
      )}

      {archivedTasks.length > 0 && (
        <TaskSection
          title="Archived"
          icon={<Clock className="w-6 h-6 text-destructive" />}
          tasks={archivedTasks}
          completionLogs={completionLogs}
          onRecover={onRecover}
          onComplete={onComplete}
          onDelete={onDelete}
          getOnEditTask={getOnEditTask}
          showMemberInfo={showMemberInfo}
          titleClassName="text-destructive"
        />
      )}
    </>
  );
});

ProjectTaskSections.displayName = 'ProjectTaskSections';
