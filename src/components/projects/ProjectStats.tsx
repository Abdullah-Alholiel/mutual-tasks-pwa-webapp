import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Users, UserPlus } from 'lucide-react';
import type { Project, ProjectParticipant } from '@/types';

interface ProjectStatsProps {
  project: Project;
  progress: number;
  completedCount: number;
  totalTasks: number;
  activeCount: number;
  completedTasksCount: number;
  participants: (ProjectParticipant & { user?: { id: string; name: string; avatar: string } })[];
  isOwner: boolean;
  onAddMember: () => void;
  onViewMembers: () => void;
}

export const ProjectStats = ({
  project,
  progress,
  completedCount,
  totalTasks,
  activeCount,
  completedTasksCount,
  participants,
  isOwner,
  onAddMember,
  onViewMembers,
}: ProjectStatsProps) => {
  return (
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
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{activeCount}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-status-completed">{completedTasksCount}</div>
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
            <div className="flex items-center gap-2">
              {project.participants && project.participants.length > 0 && (
                <div 
                  className="flex -space-x-2 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={onViewMembers}
                >
                  {project.participants.slice(0, 5).map((participant) => (
                    <Avatar
                      key={participant.id}
                      className="w-8 h-8 ring-2 ring-background border border-border"
                    >
                      <AvatarImage src={participant.avatar} alt={participant.name} />
                      <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  ))}
                  {project.participants.length > 5 && (
                    <div className="w-8 h-8 rounded-full bg-muted ring-2 ring-background border border-border flex items-center justify-center">
                      <span className="text-xs font-medium text-muted-foreground">
                        +{project.participants.length - 5}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {isOwner && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onAddMember}
                  className="h-8"
                >
                  <UserPlus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

