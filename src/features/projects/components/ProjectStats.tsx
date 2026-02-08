import { Card } from '@/components/ui/card';
import type { Project } from '@/types';

interface ProjectStatsProps {
  project: Project;
  progress: number;
  completedCount: number;
  totalTasks: number;
  activeCount: number;
  completedTasksCount: number;
  upcomingCount: number;
  archivedCount: number;
}

export const ProjectStats = ({
  project,
  progress,
  completedCount,
  totalTasks,
  activeCount,
  completedTasksCount,
  upcomingCount,
  archivedCount,
}: ProjectStatsProps) => {
  return (
    <Card className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Progress */}
        <div className="space-y-4 md:col-span-1">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground/60">
              Project Progress
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-foreground">
                {Math.round(progress)}%
              </span>
              <div className="text-right">
                <span className="text-sm font-semibold text-muted-foreground">
                  {completedCount}/{totalTasks}
                </span>
                <span className="text-[10px] text-muted-foreground/60 font-medium block">TASKS</span>
              </div>
            </div>
          </div>

          <div className="relative h-2 w-full bg-muted/30 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${progress}%`,
                backgroundColor: project.color || 'var(--primary)',
              }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 md:col-span-2">
          <div className="text-center group transition-transform hover:scale-105 p-3 md:p-4 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold text-primary mb-1">{activeCount}</div>
            <div className="text-xs md:text-xs uppercase tracking-wider text-primary font-bold">Active</div>
          </div>
          <div className="text-center group transition-transform hover:scale-105 p-3 md:p-4 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold text-status-completed mb-1">{completedTasksCount}</div>
            <div className="text-xs md:text-xs uppercase tracking-wider text-status-completed font-bold">Completed</div>
          </div>
          <div className="text-center group transition-transform hover:scale-105 p-3 md:p-4 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold text-[#8b5cf6] mb-1">{upcomingCount}</div>
            <div className="text-xs md:text-xs uppercase tracking-wider text-[#8b5cf6] font-bold">Upcoming</div>
          </div>
          <div className="text-center group transition-transform hover:scale-105 p-3 md:p-4 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold text-destructive mb-1">{archivedCount}</div>
            <div className="text-xs md:text-xs uppercase tracking-wider text-destructive font-bold">Archived</div>
          </div>
        </div>
      </div>
    </Card>
  );
};

