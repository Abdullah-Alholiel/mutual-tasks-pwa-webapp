import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Settings, Users } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
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
  onViewMembers: () => void;
}

export const ProjectHeader = ({
  project,
  canManage,
  isParticipant,
  onBack,
  onEdit,
  onJoin,
  isJoining,
  onCreateTask,
  onViewMembers
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
          {canManage && (
            <Button
              onClick={onCreateTask}
              className="gradient-primary text-white rounded-full h-10 w-10 p-0"
              title="New Task"
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={onViewMembers}
            className="shrink-0 h-10 w-10 rounded-full"
            title="View Members"
          >
            <Users className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onEdit}
            className="shrink-0 h-10 w-10 rounded-full"
            title="Project Settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="hidden sm:flex items-start gap-3 w-full">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="shrink-0 w-10 h-10 mt-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 mt-1"
            style={{ backgroundColor: adjustColorOpacity(project.color || 'var(--primary)', 0.15) }}
          >
            <Icon className="w-7 h-7" style={{ color: project.color || 'var(--primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold break-words leading-tight py-1">{project.name}</h1>
            <p className="text-base text-muted-foreground break-words">{project.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 mt-1">
          {!isParticipant && project.isPublic ? (
            <Button
              onClick={onJoin}
              disabled={isJoining}
              className="gradient-primary text-white rounded-full h-10 px-4 text-sm font-semibold"
            >
              {isJoining ? (
                <Spinner size={16} className="mr-1.5" />
              ) : (
                <Plus className="w-4 h-4 mr-1.5" />
              )}
              <span>Join</span>
            </Button>
          ) : (
            <>
              {canManage && (
                <Button
                  onClick={onCreateTask}
                  className="gradient-primary text-white rounded-full h-10 px-4 text-sm font-semibold"
                  title="New Task"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  <span>New</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={onViewMembers}
                className="shrink-0 h-10 w-10 rounded-full"
                title="View Members"
              >
                <Users className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={onEdit}
                className="shrink-0 h-10 w-10 rounded-full"
                title="Project Settings"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1 sm:hidden">
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: adjustColorOpacity(project.color || 'var(--primary)', 0.15) }}
          >
            <Icon className="w-8 h-8" style={{ color: project.color || 'var(--primary)' }} />
          </div>
          <h1 className="text-2xl font-bold break-words flex-1 min-w-0">{project.name}</h1>
        </div>
        {project.description && (
          <p className="text-sm text-muted-foreground break-words mt-1 text-left pl-0">{project.description}</p>
        )}
      </div>
    </div>
  );
};

