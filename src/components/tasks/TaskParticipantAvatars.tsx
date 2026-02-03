import type { Task, User, TaskStatusEntity, CompletionLog } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeId } from '@/lib/idUtils';
import {
  getRingColor,
  calculateRingColor,
  calculateTaskStatusUserStatus
} from '@/lib/tasks/taskUtils';
import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CompletionStatusIcon } from './CompletionStatusIcon';

interface TaskParticipantAvatarsProps {
  task: Task;
  completionLogs?: CompletionLog[];
  participantUsers: Map<number, User>;
  onViewAll?: () => void;
}

interface ParticipantDisplayData {
  userId: number;
  user: User | null;
  ringColorClass: string;
  isCompleted: boolean;
  isLate: boolean;
}

const TaskParticipantAvatarsComponent = ({
  task,
  completionLogs = [],
  participantUsers,
  onViewAll
}: TaskParticipantAvatarsProps) => {
  const maxVisible = 3;

  const { visibleParticipants, remainingCount } = useMemo(() => {
    if (!task.taskStatus || task.taskStatus.length === 0) {
      return { visibleParticipants: [], remainingCount: 0 };
    }

    const uniqueParticipantsMap = new Map<string | number, { userId: string | number; status: TaskStatusEntity }>();

    task.taskStatus.forEach(ts => {
      const tsUserId = ts.userId;
      if (!uniqueParticipantsMap.has(tsUserId)) {
        uniqueParticipantsMap.set(tsUserId, { userId: tsUserId, status: ts });
      }
    });

    const allParticipants = Array.from(uniqueParticipantsMap.values());

    const visible = allParticipants.slice(0, maxVisible);
    const remaining = allParticipants.length - maxVisible;

    return { visibleParticipants: visible, remainingCount: Math.max(0, remaining) };
  }, [task.taskStatus]);

  const participantData: ParticipantDisplayData[] = useMemo(() => {
    return visibleParticipants.map(participant => {
      const participantUserId = normalizeId(participant.userId);
      const user = participantUsers.get(participantUserId) ||
        participant.status.user ||
        null;

      const participantCompletion = completionLogs.find(log => {
        const logTaskId = normalizeId(log.taskId);
        const logUserId = normalizeId(log.userId);
        const taskIdNum = normalizeId(task.id);
        return logTaskId === taskIdNum && logUserId === participantUserId;
      });

      const participantUiStatus = calculateTaskStatusUserStatus(
        participant.status,
        participantCompletion,
        task
      );
      const isCompleted = participantCompletion !== undefined || participantUiStatus === 'completed';
      const ringColorClass = getRingColor(participant.status, participantCompletion, task);

      const ringColor = calculateRingColor(participantCompletion, participant.status, task);
      const isLate = isCompleted && ringColor === 'yellow';

      return {
        userId: participantUserId,
        user,
        ringColorClass,
        isCompleted,
        isLate
      };
    });
  }, [visibleParticipants, participantUsers, completionLogs, task]);

  if (participantData.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center pt-1">
      <div className="flex items-center -space-x-1.5 py-1.5">
        {participantData.map((participant) => {
          const userName = participant.user?.name || '';
          const userAvatar = participant.user?.avatar || '';
          const userInitial = userName ? userName.charAt(0).toUpperCase() : '?';

          return (
            <div
              key={participant.userId}
              className="relative"
            >
              <motion.div
                whileHover={{ scale: 1.1, zIndex: 10 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <Avatar
                  className={cn(
                    "w-[34px] h-[34px] lg:w-[37px] lg:h-[37px] ring-2 ring-background transition-all duration-300",
                    participant.ringColorClass
                  )}
                >
                  <AvatarImage src={userAvatar} alt={userName} />
                  <AvatarFallback className="text-xs font-semibold">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
              </motion.div>

              <div className="absolute -bottom-1 -right-0.5">
                {participant.isCompleted ? (
                  <div className="w-4 h-4 lg:w-[17px] lg:h-[17px]">
                    <CompletionStatusIcon
                      status={participant.isLate ? 'late' : 'completed'}
                      size="sm"
                    />
                  </div>
                ) : (
                  <div className="w-4 h-4 lg:w-[17px] lg:h-[17px]">
                    <CompletionStatusIcon
                      status="pending"
                      size="sm"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {remainingCount > 0 && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              onViewAll?.();
            }}
            className="relative z-10 w-[34px] h-[34px] lg:w-[37px] lg:h-[37px] rounded-full bg-muted ring-2 ring-background border border-border flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 transition-all duration-300 cursor-pointer shadow-sm group"
            aria-label={`View ${remainingCount} more participants`}
          >
            <span className="text-sm font-bold text-muted-foreground group-hover:text-primary transition-colors">
              +{remainingCount}
            </span>
          </motion.button>
        )}

        {remainingCount === 0 && participantData.length > 0 && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              onViewAll?.();
            }}
            className="relative z-10 w-[34px] h-[34px] lg:w-[37px] lg:h-[37px] rounded-full bg-muted ring-2 ring-background border border-border flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 transition-all duration-300 cursor-pointer shadow-sm group"
            aria-label="View all participants"
          >
            <MoreHorizontal className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </motion.button>
        )}
      </div>
    </div>
  );
};

export const TaskParticipantAvatars = memo(TaskParticipantAvatarsComponent);

TaskParticipantAvatars.displayName = 'TaskParticipantAvatars';
