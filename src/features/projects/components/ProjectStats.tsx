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
  upcomingCount: number;
  archivedCount: number;
  participants: (ProjectParticipant & { user?: { id: string | number; name: string; avatar: string } })[];
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
  upcomingCount,
  archivedCount,
  participants,
  isOwner,
  onAddMember,
  onViewMembers,
}: ProjectStatsProps) => {
  return (
    <Card className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Progress */}
        <div className="space-y-3 md:col-span-1">
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
        <div className="grid grid-cols-4 gap-2 md:col-span-2">
          <div className="text-center group transition-transform hover:scale-105">
            <div className="text-2xl font-bold text-primary">{activeCount}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Active</div>
          </div>
          <div className="text-center group transition-transform hover:scale-105">
            <div className="text-2xl font-bold text-status-completed">{completedTasksCount}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Done</div>
          </div>
          <div className="text-center group transition-transform hover:scale-105">
            <div className="text-2xl font-bold text-blue-500">{upcomingCount}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Upcoming</div>
          </div>
          <div className="text-center group transition-transform hover:scale-105">
            <div className="text-2xl font-bold text-muted-foreground">{archivedCount}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Archived</div>
          </div>
        </div>

        {/* Participants */}
        <div className="md:col-span-1">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-medium">Team</span>
            </div>
            <div className="flex items-center justify-between">
              <div
                className="flex -space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={onViewMembers}
              >
                {participants.length > 0 ? (
                  participants.slice(0, 4).map((participant) => (
                    <Avatar
                      key={participant.userId}
                      className="w-8 h-8 ring-2 ring-background border border-border shadow-sm"
                    >
                      <AvatarImage src={participant.user?.avatar} alt={participant.user?.name} />
                      <AvatarFallback className="bg-muted text-[10px]">{participant.user?.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                  ))
                ) : (
                  project.participants?.slice(0, 4).map((user) => (
                    <Avatar
                      key={user.id}
                      className="w-8 h-8 ring-2 ring-background border border-border shadow-sm"
                    >
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback className="bg-muted text-[10px]">{user.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                  ))
                )}
                {(participants.length > 4 || (project.participants?.length || 0) > 4) && (
                  <div className="w-8 h-8 rounded-full bg-muted ring-2 ring-background border border-border flex items-center justify-center shadow-sm">
                    <span className="text-[10px] font-bold text-muted-foreground">
                      +{(participants.length || project.participants?.length || 0) - 4}
                    </span>
                  </div>
                )}
              </div>
              {isOwner && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onAddMember}
                  className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                  title="Add Member"
                >
                  <UserPlus className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

