import type { Task, User, TaskStatus, TaskStatusEntity, CompletionLog } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CheckCircle2, Circle, Clock, Repeat, Sparkles, RotateCcw, MoreHorizontal, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/features/auth/useAuth';
import { getDatabaseClient } from '@/db';
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DifficultyRatingModal } from './DifficultyRatingModal';
import { cn } from '@/lib/utils';
import { normalizeId } from '@/lib/idUtils';
import {
  getRingColor,
  canCompleteTask,
  canRecoverTask,
  getStatusBadgeVariant,
  getStatusColor,
  calculateTaskStatusUserStatus
} from '../../../lib/tasks/taskUtils';

interface TaskCardProps {
  task: Task;
  completionLogs?: CompletionLog[];
  onAccept?: (taskId: string | number) => void;
  onDecline?: (taskId: string | number) => void;
  onComplete?: (taskId: string | number, difficultyRating?: number) => void;
  onRecover?: (taskId: string | number) => void;
  showRecover?: boolean; // If false, hide recover button (for today's view)
}

export const TaskCard = ({ task, completionLogs = [], onAccept, onDecline, onComplete, onRecover, showRecover = true }: TaskCardProps) => {
  const { user: currentUser } = useAuth();
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const queryClient = useQueryClient();

  const creatorId = normalizeId(task.creatorId);
  const projectId = normalizeId(task.projectId);

  // Use React Query for creator data with proper caching
  const { data: creator } = useQuery({
    queryKey: ['user', creatorId],
    queryFn: async () => {
      const db = getDatabaseClient();
      return await db.users.getById(creatorId);
    },
    enabled: !!creatorId,
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
    gcTime: 1000 * 60 * 30, // Keep in garbage collection for 30 minutes
  });

  // Use React Query for project data with proper caching
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const db = getDatabaseClient();
      return await db.projects.getById(projectId);
    },
    enabled: !!projectId,
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
    gcTime: 1000 * 60 * 30, // Keep in garbage collection for 30 minutes
  });

  // Extract unique participant user IDs
  const participantUserIds = useMemo(() => {
    if (!task.taskStatus) return [];
    const uniqueIds = new Set<number>();
    task.taskStatus.forEach(ts => {
      uniqueIds.add(normalizeId(ts.userId));
    });
    return Array.from(uniqueIds);
  }, [task.taskStatus]);

  // Prefetch and cache participant user data
  const { data: participantUsersData = [] } = useQuery({
    queryKey: ['users', 'batch', participantUserIds.join(',')],
    queryFn: async () => {
      const db = getDatabaseClient();
      const users = await Promise.all(
        participantUserIds.map(userId => db.users.getById(userId))
      );
      return users.filter((u): u is User => u !== null);
    },
    enabled: participantUserIds.length > 0,
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
    gcTime: 1000 * 60 * 30, // Keep in garbage collection for 30 minutes
  });

  // Build a map of userId -> User for quick lookup
  const participantUsers = useMemo(() => {
    const map = new Map<number, User>();
    participantUsersData.forEach(user => {
      map.set(normalizeId(user.id), user);
    });
    // Also add currentUser to the map if available
    if (currentUser) {
      map.set(normalizeId(currentUser.id), currentUser);
    }
    return map;
  }, [participantUsersData, currentUser]);

  // Get task statuses for current user
  const myTaskStatus = useMemo(() => {
    if (!currentUser || !task.taskStatus) return undefined;
    const userId = normalizeId(currentUser.id);
    return task.taskStatus.find(ts => {
      const tsUserId = normalizeId(ts.userId);
      return tsUserId === userId;
    });
  }, [task.taskStatus, currentUser]);

  // Check completion via CompletionLog
  const myCompletion = useMemo(() => {
    if (!currentUser) return undefined;
    const userId = normalizeId(currentUser.id);
    const taskId = normalizeId(task.id);
    return completionLogs.find(log => {
      const logTaskId = normalizeId(log.taskId);
      const logUserId = normalizeId(log.userId);
      return logTaskId === taskId && logUserId === userId;
    });
  }, [completionLogs, task.id, currentUser]);

  // Calculate task status user status using the utility function
  const taskStatusUserStatus = calculateTaskStatusUserStatus(myTaskStatus, myCompletion, task);

  // Use calculated user status directly for UI
  const uiStatus: TaskStatus = taskStatusUserStatus;

  const isTaskArchived = uiStatus === 'archived';

  // Use modular utilities for task actions
  const canComplete = canCompleteTask(myTaskStatus, myCompletion, task);
  const canRecover = canRecoverTask(myTaskStatus, myCompletion, task);

  // Check if task is recovered - check both uiStatus AND myTaskStatus.recoveredAt for immediate feedback
  // This handles the case where local state is updated but calculateTaskStatusUserStatus hasn't run yet
  const isRecovered = uiStatus === 'recovered' ||
    (myTaskStatus?.recoveredAt !== undefined && myTaskStatus?.recoveredAt !== null && myTaskStatus?.status === 'recovered');

  // For archived tasks, ALWAYS show recover button if:
  // 1. showRecover is true (allows hiding in some contexts)
  // 2. onRecover handler is provided
  // 3. Task is archived (not recovered, not completed)
  // Recovered tasks should show complete button, not recover button
  const shouldShowRecover = showRecover && !!onRecover && isTaskArchived && !isRecovered && !myCompletion;

  // Show complete button if:
  // 1. onComplete handler is provided
  // 2. User hasn't already completed this task
  // 3. Task is either: active, recovered, OR has recoveredAt set (for immediate feedback after recovery)
  // NOTE: Explicitly allow recovered tasks to show complete button even if other checks fail
  const shouldShowComplete = !!onComplete && !myCompletion &&
    (canComplete || isRecovered || myTaskStatus?.recoveredAt);

  const handleComplete = () => {
    // Allow completion for recovered tasks even if canComplete initially failed
    if ((canComplete || isRecovered || myTaskStatus?.recoveredAt) && onComplete && !myCompletion) {
      setShowRatingModal(true);
    }
  };

  const handleRatingSubmit = (rating: number) => {
    if (onComplete) {
      onComplete(task.id, rating);
    }
    setShowRatingModal(false);
  };


  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <Card className="p-5 hover-lift shadow-md hover:shadow-lg transition-all duration-200 border-border/50">
          <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  {project && (
                    <Badge
                      variant="secondary"
                      className="text-xs font-medium"
                      style={{ backgroundColor: `${project.color}15`, color: project.color }}
                    >
                      {project.name}
                    </Badge>
                  )}
                  {task.type === 'habit' && task.recurrencePattern && (
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      <Repeat className="w-3 h-3" />
                      {task.recurrencePattern.toLowerCase() === 'daily'
                        ? 'Daily'
                        : task.recurrencePattern.toLowerCase() === 'weekly'
                          ? 'Weekly'
                          : task.recurrencePattern.charAt(0).toUpperCase() + task.recurrencePattern.slice(1).toLowerCase()}
                    </Badge>
                  )}
                </div>

                <h3 className="font-semibold text-lg text-foreground truncate">
                  {task.title}
                </h3>

                {task.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {task.description}
                  </p>
                )}
              </div>

              <Badge
                variant={getStatusBadgeVariant(uiStatus)}
                className={`${getStatusColor(uiStatus)} capitalize shrink-0 font-bold ${uiStatus === 'completed'
                  ? 'bg-status-completed/15 border-status-completed/40 text-status-completed font-bold'
                  : ''
                  }`}
                style={uiStatus === 'completed' ? {
                  borderColor: 'hsl(var(--status-completed) / 0.4)',
                  backgroundColor: 'hsl(var(--status-completed) / 0.15)',
                  color: 'hsl(var(--status-completed))'
                } : undefined}
              >
                {uiStatus}
              </Badge>
            </div>

            {/* Participants & Completion Status */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center min-w-0">
                {/* Show unique participants */}
                {task.taskStatus && task.taskStatus.length > 0 && (() => {
                  const uniqueParticipantsMap = new Map<string | number, { userId: string | number; status: TaskStatusEntity }>();

                  // Add all participants
                  task.taskStatus.forEach(ts => {
                    const tsUserId = ts.userId;
                    if (!uniqueParticipantsMap.has(tsUserId)) {
                      uniqueParticipantsMap.set(tsUserId, { userId: tsUserId, status: ts });
                    }
                  });

                  const currentUserIdNum = currentUser ? normalizeId(currentUser.id) : null;

                  const allParticipants = Array.from(uniqueParticipantsMap.values()).sort((a, b) => {
                    if (currentUserIdNum === null) return 0;
                    const bId = normalizeId(b.userId);
                    const aId = normalizeId(a.userId);

                    // Always put current user first
                    if (aId === currentUserIdNum) return -1;
                    if (bId === currentUserIdNum) return 1;
                    return 0;
                  });

                  const maxVisible = 2;
                  const visibleParticipants = allParticipants.slice(0, maxVisible);
                  const remainingCount = allParticipants.length - maxVisible;

                  return (
                    <div className="flex items-center gap-1.5 min-w-0">
                      {/* Added py-1 to prevent ring clipping */}
                      <div className="flex items-center gap-2 py-1 overflow-visible">
                        {visibleParticipants.map((participant, index) => {
                          const participantCompletion = completionLogs.find(log => {
                            const logTaskId = normalizeId(log.taskId);
                            const logUserId = normalizeId(log.userId);
                            const taskIdNum = normalizeId(task.id);
                            const partUserId = normalizeId(participant.userId);
                            return logTaskId === taskIdNum && logUserId === partUserId;
                          });

                          const participantUiStatus = calculateTaskStatusUserStatus(
                            participant.status,
                            participantCompletion,
                            task
                          );
                          const isParticipantCompleted =
                            participantCompletion !== undefined || participantUiStatus === 'completed';

                          const ringColorClass = getRingColor(participant.status, participantCompletion, task);

                          const participantUserId = normalizeId(participant.userId);
                          const user = participantUsers.get(participantUserId) ||
                            participant.status.user ||
                            (currentUser && normalizeId(currentUser.id) === participantUserId ? currentUser : null);

                          const userName = user?.name || '';
                          const userAvatar = user?.avatar || '';
                          const userInitial = userName ? userName.charAt(0).toUpperCase() : '?';

                          return (
                            <div key={String(participant.userId)} className="flex items-center gap-1.5 shrink-0">
                              {index > 0 && <div className="h-5 w-[1px] bg-border/40 mx-0.5" />}
                              <Avatar className={cn("w-8 h-8 sm:w-9 sm:h-9 ring-2 ring-offset-2 ring-offset-background shrink-0 transition-all duration-300 hover:scale-110", ringColorClass)}>
                                <AvatarImage src={userAvatar} alt={userName} />
                                <AvatarFallback className={!user ? 'animate-pulse bg-muted' : 'text-[10px]'}>
                                  {userInitial}
                                </AvatarFallback>
                              </Avatar>
                              <div className="shrink-0">
                                {isParticipantCompleted ? (
                                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
                                ) : (
                                  <Circle className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground/60" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {remainingCount > 0 && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowParticipantsModal(true);
                          }}
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full p-0 flex items-center justify-center text-[11px] sm:text-xs font-bold border-2 border-border/40 bg-muted/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all duration-300 shrink-0 shadow-sm"
                        >
                          +{remainingCount}
                        </Button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {(() => {
                // For recovered tasks, show original due date with yellow "Recovered" badge
                // Only show for the current user who recovered the task
                if (isRecovered && myTaskStatus?.recoveredAt && task.dueDate) {
                  const originalDueDate = new Date(task.dueDate);
                  const recoveredDate = new Date(myTaskStatus.recoveredAt);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const recoveredDateOnly = new Date(recoveredDate);
                  recoveredDateOnly.setHours(0, 0, 0, 0);
                  const isRecoveredToday = recoveredDateOnly.getTime() === today.getTime();

                  // Format the original due date
                  const originalDateLabel = originalDueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                  // Show original due date with "Recovered" indicator in yellow
                  const recoveredLabel = isRecoveredToday ? 'Recovered Today' : `Recovered ${recoveredDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

                  return (
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground line-through">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{originalDateLabel}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-yellow-500 font-medium">
                        <RotateCcw className="w-3 h-3" />
                        <span>{recoveredLabel}</span>
                      </div>
                    </div>
                  );
                }

                // Default: show task due date
                if (task.dueDate) {
                  const dueDate = new Date(task.dueDate);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const dueDateOnly = new Date(dueDate);
                  dueDateOnly.setHours(0, 0, 0, 0);
                  const isToday = dueDateOnly.getTime() === today.getTime();
                  const isTomorrow = dueDateOnly.getTime() === today.getTime() + 86400000;

                  let dateLabel = '';
                  if (isToday) {
                    dateLabel = 'Today';
                  } else if (isTomorrow) {
                    dateLabel = 'Tomorrow';
                  } else {
                    dateLabel = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  }

                  return (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{dateLabel}</span>
                    </div>
                  );
                }

                return null;
              })()}
            </div>

            {/* Actions */}
            <AnimatePresence mode="wait">
              {/* Show Recover button for archived tasks, Mark Complete for active tasks */}
              {shouldShowRecover && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-2 border-t border-border/50"
                >
                  <Button
                    onClick={() => onRecover?.(task.id)}
                    variant="outline"
                    className="w-full"
                    size="sm"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Recover Task
                  </Button>
                </motion.div>
              )}

              {shouldShowComplete && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-2 border-t border-border/50"
                >
                  <Button
                    onClick={handleComplete}
                    className="w-full gradient-primary text-white hover:opacity-90"
                    size="sm"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Mark Complete
                  </Button>
                </motion.div>
              )}

              {uiStatus === 'completed' && myCompletion && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 pt-2 border-t border-border/50"
                >
                  <Sparkles className="w-4 h-4 text-accent" />
                  <span className="text-sm text-muted-foreground">
                    Difficulty: {myCompletion.difficultyRating || 'N/A'}/5
                    {myCompletion.penaltyApplied && ' (Half XP - Recovered)'}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>
      </motion.div>

      <DifficultyRatingModal
        open={showRatingModal}
        onOpenChange={setShowRatingModal}
        onSubmit={handleRatingSubmit}
        taskTitle={task.title}
      />

      {/* Participants Detail Dialog */}
      <Dialog open={showParticipantsModal} onOpenChange={setShowParticipantsModal}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background pointer-events-none" />

          <DialogHeader className="p-6 pb-4 relative z-10 border-b border-border/40">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <UserIcon className="w-5 h-5" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-xl font-bold tracking-tight">Task Participants</DialogTitle>
                <DialogDescription className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                  {task.taskStatus?.length || 0} Members contributing
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-2 py-4 relative z-10 custom-scrollbar">
            <div className="space-y-2 px-4">
              {task.taskStatus && task.taskStatus.map((statusEntry) => {
                const participantUserId = normalizeId(statusEntry.userId);
                const user = participantUsers.get(participantUserId) || statusEntry.user;

                const participantCompletion = completionLogs.find(log => {
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

                return (
                  <div
                    key={String(statusEntry.userId)}
                    className="group flex items-center justify-between p-3 rounded-2xl border border-border/40 bg-card/40 hover:bg-muted/40 hover:border-border/80 transition-all duration-200"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className={cn("w-11 h-11 ring-2 transition-all duration-300 group-hover:scale-105 shadow-sm", ringColorClass)}>
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
                          {user?.handle || '@user'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 min-w-[100px]">
                      <div className={cn(
                        "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 shadow-sm",
                        isParticipantCompleted
                          ? "bg-success/15 text-success border border-success/30 shadow-success/10"
                          : "bg-muted/50 text-muted-foreground border border-border/60"
                      )}>
                        {isParticipantCompleted ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Done</span>
                          </>
                        ) : (
                          <>
                            <Circle className="w-3.5 h-3.5 opacity-60" />
                            <span>Pending</span>
                          </>
                        )}
                      </div>

                      {isParticipantCompleted && participantCompletion?.createdAt && (
                        <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(participantCompletion.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 bg-muted/20 border-t border-border/40 relative z-10">
            <Button
              variant="outline"
              className="w-full font-bold rounded-xl"
              onClick={() => setShowParticipantsModal(false)}
            >
              Close List
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
