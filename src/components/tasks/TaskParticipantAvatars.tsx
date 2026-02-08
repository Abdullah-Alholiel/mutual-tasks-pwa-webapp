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

    let allParticipants = Array.from(uniqueParticipantsMap.values());

    // Sort participants: Completed (earliest first) -> Pending
    allParticipants.sort((a, b) => {
      const getCompletionTime = (p: typeof a) => {
        const pUserId = normalizeId(p.userId);
        const log = completionLogs.find(l =>
          normalizeId(l.taskId) === normalizeId(task.id) &&
          normalizeId(l.userId) === pUserId
        );
        // If completed, return timestamp. If not, return Infinity to push to end.
        return log ? new Date(log.createdAt).getTime() : Infinity;
      };

      const timeA = getCompletionTime(a);
      const timeB = getCompletionTime(b);

      return timeA - timeB;
    });

    const visible = allParticipants.slice(0, maxVisible);
    const remaining = allParticipants.length - maxVisible;

    return { visibleParticipants: visible, remainingCount: Math.max(0, remaining) };
  }, [task.taskStatus, completionLogs, task.id]);

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
    <div className="flex items-center" role="group" aria-label="Task participants">
      <div className="flex items-center -space-x-2 py-1">
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
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 25,
                  delay: participantData.indexOf(participant) * 0.05 // Staggered animation
                }}
                whileHover={{ scale: 1.1, zIndex: 10 }}
              >
                <Avatar
                  className={cn(
                    "w-[30px] h-[30px] rounded-full ring-2 ring-background transition-all duration-300", // Fixed size 30px, perfect circle
                    participant.ringColorClass
                  )}
                  aria-label={`${userName || 'Unknown user'}: ${participant.isCompleted ? (participant.isLate ? 'Completed late' : 'Completed') : 'Pending'}`}
                >
                  <AvatarImage src={userAvatar} alt={userName} />
                  <AvatarFallback className="text-[11px] font-semibold">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
              </motion.div>

              {/* Status icon - positioned more to South-West (bottom-left) */}
              <div className="absolute -bottom-1 -left-1 z-10">
                {participant.isCompleted && (
                  <CompletionStatusIcon
                    status={participant.isLate ? 'late' : 'completed'}
                    size="sm"
                    className="ring-2 ring-background"
                  />
                )}
              </div>
            </div>
          );
        })}

        {/* Show +N button only when there are more participants beyond visible */}
        {remainingCount > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: Math.min(participantData.length, 3) * 0.05 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              onViewAll?.();
            }}
            // Exact same size as avatars: w-[30px] h-[30px]
            className="relative z-10 w-[30px] h-[30px] rounded-full bg-muted ring-2 ring-background border border-border flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 cursor-pointer shadow-sm group active:scale-95"
            aria-label={`View ${remainingCount} more participants`}
          >
            <span className="text-[10px] font-bold text-muted-foreground group-hover:text-primary transition-colors">
              +{remainingCount}
            </span>
          </motion.button>
        )}

        {/* Show 'view all' button (ellipsis) ONLY when there are 3+ participants and none remaining */}
        {remainingCount === 0 && participantData.length > 3 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: participantData.length * 0.05 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              onViewAll?.();
            }}
            // Exact same size as avatars: w-[30px] h-[30px]
            className="relative z-10 w-[30px] h-[30px] rounded-full bg-muted ring-2 ring-background border border-border flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 cursor-pointer shadow-sm group active:scale-95"
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
