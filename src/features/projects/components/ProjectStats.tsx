import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { UserPlus, MoreHorizontal } from 'lucide-react';
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
  canManage: boolean;
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
  canManage,
  onAddMember,
  onViewMembers,
}: ProjectStatsProps) => {
  return (
    <Card className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Progress */}
        <div className="space-y-4 md:col-span-1">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/40">
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
            <div className="text-xs md:text-xs uppercase tracking-wider text-muted-foreground font-semibold">Active</div>
          </div>
          <div className="text-center group transition-transform hover:scale-105 p-3 md:p-4 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold text-status-completed mb-1">{completedTasksCount}</div>
            <div className="text-xs md:text-xs uppercase tracking-wider text-muted-foreground font-semibold">Completed</div>
          </div>
          <div className="text-center group transition-transform hover:scale-105 p-3 md:p-4 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold text-[#8b5cf6] mb-1">{upcomingCount}</div>
            <div className="text-xs md:text-xs uppercase tracking-wider text-[#8b5cf6] font-semibold">Upcoming</div>
          </div>
          <div className="text-center group transition-transform hover:scale-105 p-3 md:p-4 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold text-destructive mb-1">{archivedCount}</div>
            <div className="text-xs md:text-xs uppercase tracking-wider text-destructive font-semibold">Archived</div>
          </div>
        </div>

        {/* Participants */}
        <div className="md:col-span-1">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/40">Team</span>
            </div>
            <div className="flex items-center justify-between">
              <div
                className="flex -space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={onViewMembers}
              >
                {(() => {
                  // Use participants from props first, fallback to project.participants
                  // Create a combined unique list to avoid duplicates
                  type ParticipantType = (typeof participants)[number] | { user: NonNullable<typeof project.participants>[number] };
                  const participantMap = new Map<string | number, ParticipantType>();

                  // Add participants from props
                  participants.forEach(p => {
                    const pUserId = typeof p.userId === 'string' ? parseInt(p.userId) : p.userId;
                    participantMap.set(pUserId, p);
                  });

                  // Add project.participants if not already present
                  project.participants?.forEach(user => {
                    const uId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
                    if (!participantMap.has(uId)) {
                      participantMap.set(uId, { user });
                    }
                  });

                  const uniqueParticipants = Array.from(participantMap.values()).slice(0, 4);

                  return uniqueParticipants.map((p) => {
                    const user = 'user' in p && p.user ? p.user : (p as typeof participants[0]).user;
                    const userId = user?.id ? (typeof user.id === 'string' ? parseInt(user.id) : user.id) : (p as typeof participants[0]).userId;

                    return (
                      <Avatar
                        key={`participant-${userId}`}
                        className="w-8 h-8 ring-2 ring-background border border-border shadow-sm"
                      >
                        <AvatarImage src={user?.avatar} alt={user?.name} />
                        <AvatarFallback className="bg-muted text-[10px]">{user?.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                    );
                  });
                })()}
                {(() => {
                  const totalUnique = new Set([
                    ...participants.map(p => typeof p.userId === 'string' ? parseInt(p.userId) : p.userId),
                    ...(project.participants?.map(u => typeof u.id === 'string' ? parseInt(u.id) : u.id) || [])
                  ]).size;

                  if (totalUnique > 4) {
                    return (
                      <div className="w-8 h-8 rounded-full bg-muted ring-2 ring-background border border-border flex items-center justify-center shadow-sm relative z-10 cursor-pointer hover:bg-primary/10 transition-colors" onClick={onViewMembers}>
                        <span className="text-[10px] font-bold text-muted-foreground group-hover:text-primary transition-colors">
                          +{totalUnique - 4}
                        </span>
                      </div>
                    );
                  } else if (totalUnique > 0) {
                    return (
                      <div className="w-8 h-8 rounded-full bg-muted ring-2 ring-background border border-border flex items-center justify-center shadow-sm relative z-10 cursor-pointer hover:bg-primary/10 transition-colors" onClick={onViewMembers}>
                        <MoreHorizontal className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onAddMember}
                  className="h-12 w-12 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                  title="Add Member"
                >
                  <UserPlus className="w-8 h-8" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

