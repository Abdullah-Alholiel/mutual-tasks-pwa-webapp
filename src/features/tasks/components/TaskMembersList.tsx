// ============================================================================
// TaskMembersList - Scrollable list of task participants with completion status
// ============================================================================

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task, User, TaskStatusEntity, CompletionLog } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { normalizeId } from '@/lib/idUtils';
import { useAuth } from '@/features/auth/useAuth';
import {
    getRingColor,
    calculateRingColor,
    calculateTaskStatusUserStatus,
} from '@/lib/tasks/taskUtils';
import { CompletionStatusIcon } from '@/components/tasks/CompletionStatusIcon';
import { Clock } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface TaskMembersListProps {
    task: Task;
    completionLogs: CompletionLog[];
    participantUsers: Map<number, User>;
    maxVisibleWithoutScroll?: number;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Displays a scrollable list of task participants with their completion status.
 * Shows avatars, names, handles, and completion badges for each member.
 */
export const TaskMembersList = ({
    task,
    completionLogs,
    participantUsers,
    maxVisibleWithoutScroll = 5,
}: TaskMembersListProps) => {
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();

    const members = useMemo(() => {
        if (!task.taskStatus) return [];

        return task.taskStatus.map((statusEntry) => {
            const participantUserId = normalizeId(statusEntry.userId);
            const user = participantUsers.get(participantUserId) || statusEntry.user;

            const participantCompletion = completionLogs.find((log) => {
                const logTaskId = normalizeId(log.taskId);
                const logUserId = normalizeId(log.userId);
                const taskIdNum = normalizeId(task.id);
                return logTaskId === taskIdNum && logUserId === participantUserId;
            });

            const participantUiStatus = calculateTaskStatusUserStatus(
                statusEntry,
                participantCompletion,
                task
            );

            const isParticipantCompleted =
                participantCompletion !== undefined || participantUiStatus === 'completed';
            const ringColorClass = getRingColor(statusEntry, participantCompletion, task);
            const ringColor = calculateRingColor(participantCompletion, statusEntry, task);
            const isLateCompletion = isParticipantCompleted && ringColor === 'yellow';

            return {
                statusEntry,
                user,
                participantUserId,
                participantCompletion,
                participantUiStatus,
                isParticipantCompleted,
                ringColorClass,
                isLateCompletion,
            };
        });
    }, [task, completionLogs, participantUsers]);

    const needsScroll = members.length > maxVisibleWithoutScroll;
    const listHeight = needsScroll ? 'h-[280px]' : 'h-auto';

    const handleMemberClick = (user: User | undefined) => {
        if (user) {
            if (currentUser && normalizeId(user.id) === normalizeId(currentUser.id)) {
                navigate('/profile');
            } else {
                navigate(`/friends/${user.id}`);
            }
        }
    };

    const membersList = (
        <div className="space-y-2">
            {members.map(({
                statusEntry,
                user,
                isParticipantCompleted,
                ringColorClass,
                isLateCompletion,
                participantUiStatus,
                participantCompletion,
            }) => (
                <div
                    key={String(statusEntry.userId)}
                    onClick={() => handleMemberClick(user)}
                    className="group flex items-center justify-between p-3 rounded-2xl border border-border/40 bg-card/40 hover:bg-muted/40 hover:border-border/80 transition-all duration-200 cursor-pointer"
                >
                    <div className="flex items-center gap-3">
                        <Avatar
                            className={cn(
                                'w-10 h-10 ring-2 transition-all duration-300 group-hover:scale-105 shadow-sm',
                                ringColorClass
                            )}
                        >
                            <AvatarImage src={user?.avatar} alt={user?.name} />
                            <AvatarFallback className="bg-primary/5 text-primary text-sm font-bold">
                                {user?.name?.charAt(0).toUpperCase() || '?'}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                                {user?.name || 'Unknown User'}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-medium">
                                {user?.handle ? `${user.handle}` : '@user'}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                        <div
                            className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 shadow-sm',
                                isLateCompletion
                                    ? 'bg-yellow-500/15 text-yellow-500 border border-yellow-500/30'
                                    : isParticipantCompleted
                                        ? 'bg-success/15 text-success border border-success/30'
                                        : participantUiStatus === 'archived'
                                            ? 'bg-destructive/15 text-destructive border border-destructive/30'
                                            : 'bg-muted/50 text-muted-foreground border border-border/60'
                            )}
                        >
                            {isParticipantCompleted ? (
                                <>
                                    <CompletionStatusIcon
                                        status={isLateCompletion ? 'late' : 'completed'}
                                        size="sm"
                                    />
                                    <span>{isLateCompletion ? 'Late' : 'Completed'}</span>
                                </>
                            ) : participantUiStatus === 'archived' ? (
                                <>
                                    <Clock className="w-3 h-3" />
                                    <span>Archived</span>
                                </>
                            ) : (
                                <>
                                    <CompletionStatusIcon status="pending" size="sm" />
                                    <span>Pending</span>
                                </>
                            )}
                        </div>

                        {isParticipantCompleted && participantCompletion?.createdAt && (
                            <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {(() => {
                                    const date = new Date(participantCompletion.createdAt);
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const checkDate = new Date(date);
                                    checkDate.setHours(0, 0, 0, 0);

                                    if (checkDate.getTime() === today.getTime()) return 'Today';

                                    const yesterday = new Date(today);
                                    yesterday.setDate(yesterday.getDate() - 1);
                                    if (checkDate.getTime() === yesterday.getTime()) return 'Yesterday';

                                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                })()}
                            </span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );

    if (needsScroll) {
        return (
            <ScrollArea className={cn(listHeight, 'pr-2')}>
                {membersList}
            </ScrollArea>
        );
    }

    return membersList;
};

TaskMembersList.displayName = 'TaskMembersList';
