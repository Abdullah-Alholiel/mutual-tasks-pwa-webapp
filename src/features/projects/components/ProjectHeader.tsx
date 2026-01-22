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
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center justify-between gap-2 sm:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="shrink-0 w-10 h-10"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onEdit}
            className="shrink-0 h-10 w-10 rounded-full"
          >
            <Settings className="w-4 h-4" />
          </Button>
          {canManage && (
            <Button
              onClick={onCreateTask}
              className="gradient-primary text-white rounded-full h-10 w-10 p-0"
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-3 w-full">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="shrink-0 w-10 h-10"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: adjustColorOpacity(project.color, 0.15) }}
          >
            <Icon className="w-7 h-7" style={{ color: project.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold break-words">{project.name}</h1>
            <p className="text-base text-muted-foreground break-words">{project.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isParticipant && project.isPublic ? (
            <Button
              onClick={onJoin}
              disabled={isJoining}
              className="gradient-primary text-white rounded-full h-10 px-4 text-sm font-semibold"
            >
              {isJoining ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-1.5" />
              )}
              <span>Join</span>
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={onEdit}
                className="shrink-0 h-10 w-10 rounded-full"
              >
                <Settings className="w-4 h-4" />
              </Button>
              {canManage && (
                <Button
                  onClick={onCreateTask}
                  className="gradient-primary text-white rounded-full h-10 px-4 text-sm font-semibold"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  <span>New</span>
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex items-start gap-3 flex-1 min-w-0 sm:hidden">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-1"
          style={{ backgroundColor: adjustColorOpacity(project.color, 0.15) }}
        >
          <Icon className="w-6 h-6" style={{ color: project.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold break-words">{project.name}</h1>
          <p className="text-sm text-muted-foreground break-words">{project.description}</p>
        </div>
      </div>
    </div>
  );
};

