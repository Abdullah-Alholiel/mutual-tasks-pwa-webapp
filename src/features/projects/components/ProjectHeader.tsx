import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Settings, Loader2 } from 'lucide-react';
import type { Project } from '@/types';
import { getIconByName } from '@/lib/projects/projectIcons';
import { adjustColorOpacity } from '@/lib/colorUtils';

interface ProjectHeaderProps {
  project: Project;
  canManage: boolean;
  isParticipant: boolean;
  onBack: () => void;
  onEdit: () => void;
  onJoin: () => void;
  isJoining?: boolean;
  onCreateTask: () => void;
}

export const ProjectHeader = ({
  project,
  canManage,
  isParticipant,
  onBack,
  onEdit,
  onJoin,
  isJoining,
  onCreateTask
}: ProjectHeaderProps) => {
  const Icon = getIconByName(project.icon || 'Target');

  return (
    <div className="flex items-start gap-2 sm:gap-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="shrink-0"
      >
        <ArrowLeft className="w-5 h-5" />
      </Button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          <div
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: adjustColorOpacity(project.color, 0.15) }}
          >
            <Icon className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: project.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold break-words">{project.name}</h1>
            <p className="text-sm sm:text-base text-muted-foreground line-clamp-2">{project.description}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {!isParticipant && project.isPublic ? (
          <Button
            onClick={onJoin}
            disabled={isJoining}
            className="gradient-primary text-white hover:shadow-md hover:shadow-primary/20 rounded-full h-10 px-4 text-sm font-semibold transition-all duration-300 hover:translate-y-[-1px] active:translate-y-[0px]"
          >
            {isJoining ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 sm:mr-1.5" />
            )}
            <span>{isJoining ? 'Joining...' : 'Join Project'}</span>
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={onEdit}
              className="shrink-0 h-10 w-10 rounded-full border-border/60 hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all duration-300"
            >
              <Settings className="w-4 h-4" />
            </Button>
            {canManage && (
              <Button
                onClick={onCreateTask}
                className="gradient-primary text-white hover:shadow-md hover:shadow-primary/20 rounded-full h-10 px-3.5 text-sm font-semibold transition-all duration-300 hover:translate-y-[-1px] active:translate-y-[0px]"
              >
                <Plus className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">New Task</span>
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

