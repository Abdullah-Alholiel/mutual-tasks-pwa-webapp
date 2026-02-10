import type { Task, User, TaskStatus, TaskStatusEntity, CompletionLog } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Clock,
  RotateCcw,
  CheckCircle2,
  Repeat,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/features/auth/useAuth';
import { useUser, useBatchUsers } from '@/features/users/hooks/useUsers';
import { DifficultyRatingModal } from './DifficultyRatingModal';
import { TaskParticipantAvatars } from '@/components/tasks/TaskParticipantAvatars';
import { CompletionStatusIcon } from '@/components/tasks/CompletionStatusIcon';
import { cn } from '@/lib/utils';
import { normalizeId, compareIds } from '@/lib/idUtils';

import {
  getRingColor,
  calculateRingColor,
  canCompleteTask,
  getStatusBadgeVariant,
  getStatusColor,
  calculateTaskStatusUserStatus,
  canEditTask
} from '../../../lib/tasks/taskUtils';
import { getIconByName } from '@/lib/projects/projectIcons';
import { adjustColorOpacity } from '@/lib/colorUtils';
import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '@/features/projects/hooks/useProjects';
import { useTaskStatuses } from '@/features/tasks/hooks/useTasks';
import { deduplicator } from '@/lib/utils/requestDeduplicator';
import { validateAndLogIssues } from '@/lib/tasks/taskStatusValidation';
import { useTaskViewModal } from '../hooks/useTaskViewModal';

interface TaskCardProps {
  task: Task;
  completionLogs?: CompletionLog[];
  onAccept?: (taskId: string | number) => void;
  onDecline?: (taskId: string | number) => void;
  onComplete?: (taskId: string | number, difficultyRating?: number) => void;
  onRecover?: (taskId: string | number) => void;
  onDelete?: (taskId: string | number) => void;
  onEdit?: (task: Task) => void;
  showRecover?: boolean; // If false, hide recover button (for today's view)
  showMemberInfo?: boolean; // If false, hide participant details for non-members
}

const TaskCardComponent = ({ task, completionLogs = [], onComplete, onRecover, onDelete, onEdit, showRecover = true, showMemberInfo = true }: TaskCardProps) => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [isJustCompleted, setIsJustCompleted] = useState(false);
  const { openTaskView } = useTaskViewModal();

  const creatorId = normalizeId(task.creatorId);
  const projectId = normalizeId(task.projectId);

  // Use centralized useUser hook for creator data with proper caching
  useUser(creatorId);

  // Use shared useProject hook for consistency
  const { data: project } = useProject(projectId);

  // Extract unique participant user IDs
  const participantUserIds = useMemo(() => {
    if (!task.taskStatus) return [];
    const uniqueIds = new Set<number>();
    task.taskStatus.forEach(ts => {
      uniqueIds.add(normalizeId(ts.userId));
    });
    return Array.from(uniqueIds);
  }, [task.taskStatus]);

  // Use centralized useBatchUsers hook for efficient batch fetching
  const { data: participantUsersData = [] } = useBatchUsers(participantUserIds);

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

  // ============================================================================
  // DIRECT SUBSCRIPTION FOR REALTIME UPDATES
  // Subscribe directly to React Query's task status cache to ensure this
  // component re-renders when realtime updates change status data,
  // regardless of whether the parent component re-renders.
  // ============================================================================
  const { data: allTaskStatuses = [] } = useTaskStatuses();

  // Get fresh task status for current user from the React Query cache
  // This takes precedence over task.taskStatus props for freshest data
  const myTaskStatus = useMemo(() => {
    if (!currentUser) return undefined;
    const userId = normalizeId(currentUser.id);
    const taskId = normalizeId(task.id);

    // First check the directly subscribed cache (freshest data)
    const fromCache = allTaskStatuses.find(ts => {
      const tsUserId = normalizeId(ts.userId);
      const tsTaskId = normalizeId(ts.taskId);
      return tsTaskId === taskId && tsUserId === userId;
    });

    // If found in cache, use it (freshest)
    if (fromCache) return fromCache;

    // Fall back to task.taskStatus props (may be stale)
    if (!task.taskStatus) return undefined;
    return task.taskStatus.find(ts => {
      const tsUserId = normalizeId(ts.userId);
      return tsUserId === userId;
    });
  }, [allTaskStatuses, task.taskStatus, task.id, currentUser]);

  // DEBUG: Log when myTaskStatus changes to track realtime data flow
  useEffect(() => {
    console.log('[TaskCard] 📍 Task', task.id, 'myTaskStatus updated:', {
      status: myTaskStatus?.status,
      ringColor: myTaskStatus?.ringColor,
      recoveredAt: myTaskStatus?.recoveredAt,
      completedAt: myTaskStatus?.completedAt,
      cacheSize: allTaskStatuses.length,
    });
  }, [task.id, myTaskStatus?.status, myTaskStatus?.ringColor, myTaskStatus?.recoveredAt, myTaskStatus?.completedAt, allTaskStatuses.length]);

  // Build merged taskStatus array for participant display
  // Prefer cache data over props data for freshness
  const mergedTaskStatuses = useMemo(() => {
    if (!task.taskStatus && allTaskStatuses.length === 0) return [];

    const taskId = normalizeId(task.id);
    const statusMap = new Map<number, TaskStatusEntity>();

    // First add props statuses
    task.taskStatus?.forEach(ts => {
      statusMap.set(normalizeId(ts.userId), ts);
    });

    // Then overlay cache statuses (fresher data takes precedence)
    allTaskStatuses.forEach(ts => {
      if (normalizeId(ts.taskId) === taskId) {
        statusMap.set(normalizeId(ts.userId), ts);
      }
    });

    return Array.from(statusMap.values());
  }, [task.taskStatus, task.id, allTaskStatuses]);

  const isCreator = useMemo(() => {
    if (!currentUser) return false;
    return compareIds(task.creatorId, currentUser.id);
  }, [task.creatorId, currentUser]);

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

  // DEFENSIVE CHECK: Validate data consistency between task status and completion logs
  // Uses centralized validation utility with session-level deduplication
  // Each unique issue is only logged once per session to prevent console spam
  useEffect(() => {
    if (!task.taskStatus || task.taskStatus.length === 0) return;

    const taskDueDate = new Date(task.dueDate);

    task.taskStatus.forEach(ts => {
      const completionLog = completionLogs.find(log =>
        normalizeId(log.taskId) === normalizeId(task.id) &&
        normalizeId(log.userId) === normalizeId(ts.userId)
      );

      // Uses centralized utility with built-in deduplication
      validateAndLogIssues(ts, completionLog, taskDueDate, 'TaskCard');
    });
  }, [task.taskStatus, completionLogs, task.id, task.dueDate]);

  // Use calculated user status directly for UI
  const uiStatus: TaskStatus = taskStatusUserStatus;

  // Permission checks
  const canModify = useMemo(() => {
    if (!project || !currentUser) return false;
    const userId = normalizeId(currentUser.id);

    // Only upcoming tasks can be edited - this restriction applies to everyone, including owners
    if (!canEditTask(myTaskStatus, myCompletion, task)) return false;

    // Project owner always has permission (for tasks that are upcoming)
    if (normalizeId(project.ownerId) === userId) return true;

    // Check participant role
    const participant = project.participantRoles?.find(p => normalizeId(p.userId) === userId);
    return participant?.role === 'owner' || participant?.role === 'manager';
  }, [project, currentUser, myTaskStatus, myCompletion, task]);

  const isTaskArchived = uiStatus === 'archived';

  // Use modular utilities for task actions
  const canComplete = canCompleteTask(myTaskStatus, myCompletion, task);

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
  // NOTE: Explicitly allow creators to complete tasks even if status is missing
  const shouldShowComplete = !!onComplete && !myCompletion &&
    (canComplete || isRecovered || myTaskStatus?.recoveredAt || (isCreator && uiStatus === 'active'));

  const handleComplete = () => {
    // Allow completion for recovered tasks even if canComplete initially failed
    if ((canComplete || isRecovered || myTaskStatus?.recoveredAt) && onComplete && !myCompletion) {
      setShowRatingModal(true);
    }
  };

  const handleRatingSubmit = (rating: number | undefined) => {
    // Deduplicate to prevent rapid double-clicks from creating duplicate completions
    deduplicator.deduplicate(`complete-${task.id}`, async () => {
      if (onComplete) {
        await onComplete(task.id, rating);
        setIsJustCompleted(true);
        setTimeout(() => setIsJustCompleted(false), 2000);
      }
      setShowRatingModal(false);
    });
  };

  // Calculate card height based on task state - PRODUCTION COMPACT DESIGN
  // Target: fit 3 cards on mobile screen with comfortable spacing
  const getCardHeight = () => {
    if ((uiStatus === 'completed' && myCompletion) || uiStatus === 'upcoming') {
      // Completed & Upcoming tasks: Compact (no action buttons)
      // Mobile: 130px, Desktop: 140px - Tighter vertical spacing
      return 'h-[130px] lg:h-[140px]';
    }
    if (shouldShowRecover || shouldShowComplete) {
      // Active/Recovered tasks with buttons: Taller for action
      // Mobile: 165px, Desktop: 175px - Optimized for new button size
      return 'h-[165px] lg:h-[175px]';
    }
    // Default height
    return 'h-[130px] lg:h-[140px]';
  };

  // Handle card click to open task detail modal
  const handleCardClick = useCallback(() => {
    openTaskView(task, {
      onEdit: canModify && onEdit ? onEdit : undefined,
      onDelete: canModify && onDelete ? (id) => onDelete(id) : undefined,
      canModify,
      completionLogs,
    });
  }, [task, canModify, onEdit, onDelete, completionLogs, openTaskView]);


  return (
    <>
      {/* Optimized for mobile scroll performance - removed heavy layout animations */}
      <div
        className="animate-fade-in"
        style={{
          // CSS containment for better paint performance
          contain: 'layout style',
        }}
      >
        <motion.div
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <Card
            className={cn(
              "p-3 lg:p-4 hover-lift shadow-sm hover:shadow-md transition-all duration-300 flex flex-col overflow-hidden cursor-pointer relative group bg-card",
              // Editorial Design: Solid left border for status, no blur/transparency for performance
              "border-l-[4px] border-y border-r border-border/50",
              getCardHeight(),
              isJustCompleted && "ring-2 ring-primary/50",
              // Status-specific left border colors
              uiStatus === 'active' && "border-l-primary",
              uiStatus === 'completed' && "border-l-status-completed",
              uiStatus === 'upcoming' && "border-l-[hsl(var(--status-upcoming))]", // Tailored Purple
              uiStatus === 'archived' && "border-l-destructive", // Enforce Red via destructive
              isRecovered && "border-l-[hsl(var(--status-recovered))]", // Tailored Yellow
              // Removed invalid 'todo'/'in-progress' checks
            )}
            onClick={handleCardClick}
            role="article"
            aria-label={`Task: ${task.title}. Status: ${uiStatus}. ${project ? `Project: ${project.name}.` : ''}`}
          >
            {/* Shine Effect - Reduced intensity for Editorial feel */}
            <motion.div
              className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent z-0 pointer-events-none"
              initial={{ x: '-100%' }}
              whileHover={{ x: '100%' }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />

            {/* Completion Shine Effect */}
            <AnimatePresence>
              {isJustCompleted && (
                <motion.div
                  initial={{ x: '-100%', opacity: 0 }}
                  animate={{ x: '100%', opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1, ease: "easeInOut" }}
                  className="absolute inset-y-0 w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent z-10 pointer-events-none"
                />
              )}
            </AnimatePresence>
            <div className="flex flex-col h-full">
              {/* Compact Header - All badges inline */}
              <div className="flex items-start justify-between gap-2 flex-none">
                <div className="flex-1 min-w-0">
                  {/* Inline badges row: Project + Recurrence + Status */}
                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                    {project && (
                      <Badge
                        variant="outline"
                        className="text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 transition-all duration-200 shadow-sm cursor-pointer hover:opacity-80 text-left h-[22px] max-w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/projects/${project.id}`);
                        }}
                        style={project.color ? {
                          backgroundColor: adjustColorOpacity(project.color, 0.1),
                          borderColor: adjustColorOpacity(project.color, 0.3), // Clearer border
                          color: project.color
                        } : undefined}
                        title={project.name}
                        aria-label={`Project: ${project.name}. Click to view project.`}
                      >
                        {project.icon && (() => {
                          const Icon = getIconByName(project.icon);
                          return <Icon className="w-3 h-3 shrink-0" />;
                        })()}
                        {/* Flexible truncate - let it take available space */}
                        <span className="truncate">{project.name}</span>
                      </Badge>
                    )}
                    {task.type === 'habit' && task.recurrencePattern && (
                      <Badge
                        variant="outline"
                        // Perfect circle for icon-only badge
                        className="flex items-center justify-center shrink-0 bg-background/60 border-border/60 p-0 w-[22px] h-[22px] rounded-full"
                        title={task.recurrencePattern.toLowerCase() === 'daily' ? 'Daily habit' : task.recurrencePattern.toLowerCase() === 'weekly' ? 'Weekly habit' : `${task.recurrencePattern} habit`}
                        aria-label={`Recurring: ${task.recurrencePattern}`}
                      >
                        <Repeat className="w-3 h-3" />
                        {/* Recurrence details removed from card face for cleaner look */}
                      </Badge>
                    )}
                    {/* Status badge - pushed to right via flex if needed, or inline */}
                    <Badge
                      variant={getStatusBadgeVariant(uiStatus)}
                      className={cn(
                        "text-[11px] capitalize shrink-0 font-bold h-[22px] px-2 ml-auto", // ml-auto pushes it right
                        getStatusColor(uiStatus),
                        uiStatus === 'completed' && 'bg-status-completed/15 border-status-completed/40 text-status-completed',
                        uiStatus === 'archived' && 'bg-destructive/15 border-destructive/40 text-destructive',
                        uiStatus === 'upcoming' && 'bg-[hsl(var(--status-upcoming))]/15 border-[hsl(var(--status-upcoming))]/40 text-[hsl(var(--status-upcoming))]'
                      )}
                      style={
                        uiStatus === 'completed' ? {
                          borderColor: 'hsl(var(--status-completed) / 0.4)',
                          backgroundColor: 'hsl(var(--status-completed) / 0.15)',
                          color: 'hsl(var(--status-completed))'
                        } : uiStatus === 'archived' ? {
                          borderColor: 'hsl(var(--destructive) / 0.4)',
                          backgroundColor: 'hsl(var(--destructive) / 0.15)',
                          color: 'hsl(var(--destructive))'
                        } : uiStatus === 'upcoming' ? {
                          borderColor: 'hsl(var(--status-upcoming) / 0.4)',
                          backgroundColor: 'hsl(var(--status-upcoming) / 0.15)',
                          color: 'hsl(var(--status-upcoming))'
                        } : undefined
                      }
                      aria-label={`Status: ${uiStatus}`}
                    >
                      {uiStatus}
                    </Badge>
                  </div>

                  {/* Compact title - single line with tooltip */}
                  <h3
                    className="font-semibold text-base lg:text-lg text-foreground line-clamp-1 mt-0.5"
                    title={task.title}
                  >
                    {task.title}
                  </h3>
                </div>

                {/* REMOVED: Edit/Delete buttons (Actionable via card click) */}
              </div>

              {/* Participants & Completion Status - Compact with proper spacing */}
              {showMemberInfo && (
                <div className="flex items-center justify-between gap-2 flex-none pt-2">
                  <TaskParticipantAvatars
                    task={task}
                    completionLogs={completionLogs}
                    participantUsers={participantUsers}
                    onViewAll={() => setShowParticipantsModal(true)}
                  />

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
              )}

              {/* Default fallback for date when showMemberInfo is false */}
              {!showMemberInfo && task.dueDate && (
                <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {(() => {
                      const dueDate = new Date(task.dueDate);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const dueDateOnly = new Date(dueDate);
                      dueDateOnly.setHours(0, 0, 0, 0);
                      if (dueDateOnly.getTime() === today.getTime()) return 'Today';
                      if (dueDateOnly.getTime() === today.getTime() + 86400000) return 'Tomorrow';
                      return dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    })()}
                  </span>
                </div>
              )}

              {/* Actions - Production Ready */}
              {(shouldShowRecover || shouldShowComplete) && (
                <div className={cn(
                  "flex-none pt-2.5 mt-auto",
                  // separator removed
                )}>
                  <AnimatePresence mode="wait">
                    {/* Show Recover button for archived tasks, Mark As Completed for active tasks */}
                    {shouldShowRecover && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRecover?.(task.id);
                          }}
                          variant="outline"
                          className="w-full h-8 text-[13px] font-medium active:scale-[0.98] transition-transform"
                          aria-label={`Recover task: ${task.title}`}
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-2" />
                          Recover
                        </Button>
                      </motion.div>
                    )}

                    {shouldShowComplete && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleComplete();
                          }}
                          className="w-full h-8 text-[13px] font-medium gradient-primary text-white hover:opacity-90 active:scale-[0.98] transition-transform shadow-sm"
                          aria-label={`Mark task as completed: ${task.title}`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                          Mark Complete
                        </Button>
                      </motion.div>
                    )}


                  </AnimatePresence>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </div >

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
                  {mergedTaskStatuses.length || 0} Members contributing
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-2 py-4 relative z-10 custom-scrollbar">
            <div className="space-y-2 px-4">
              {/* Use mergedTaskStatuses for freshest realtime data */}
              {mergedTaskStatuses.map((statusEntry) => {
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
                const ringColor = calculateRingColor(participantCompletion, statusEntry, task);
                const isLateCompletion = isParticipantCompleted && ringColor === 'yellow';

                return (
                  <div
                    key={String(statusEntry.userId)}
                    onClick={() => {
                      if (user) {
                        if (currentUser && normalizeId(user.id) === normalizeId(currentUser.id)) {
                          navigate('/profile');
                        } else {
                          navigate(`/friends/${user.id}`);
                        }
                      }
                    }}
                    className="group flex items-center justify-between p-3 rounded-2xl border border-border/40 bg-card/40 hover:bg-muted/40 hover:border-border/80 transition-all duration-200 cursor-pointer"
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
                        isLateCompletion
                          ? "bg-yellow-500/15 text-yellow-500 border border-yellow-500/30 shadow-yellow-500/10"
                          : isParticipantCompleted
                            ? "bg-success/15 text-success border border-success/30 shadow-success/10"
                            : participantUiStatus === 'archived'
                              ? "bg-destructive/15 text-destructive border border-destructive/30 shadow-destructive/10"
                              : "bg-muted/50 text-muted-foreground border border-border/60"
                      )}>
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
                            <Clock className="w-3.5 h-3.5" />
                            <span>Archived</span>
                          </>
                        ) : (
                          <>
                            <CompletionStatusIcon
                              status="pending"
                              size="sm"
                            />
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
                );
              })}
            </div>
          </div>


        </DialogContent>
      </Dialog >
    </>
  );
};

/**
 * Memoized TaskCard component for optimal scroll performance.
 * Uses custom comparison to prevent re-renders when props haven't meaningfully changed.
 */
export const TaskCard = memo(TaskCardComponent, (prevProps: TaskCardProps, nextProps: TaskCardProps) => {
  // Custom comparison for performance - only re-render when these change:
  // 1. Task ID or key data changed
  if (prevProps.task.id !== nextProps.task.id) return false;
  if (prevProps.task.title !== nextProps.task.title) return false;
  if (prevProps.task.description !== nextProps.task.description) return false;
  if (prevProps.task.dueDate !== nextProps.task.dueDate) return false;
  if (prevProps.task.recurrenceIndex !== nextProps.task.recurrenceIndex) return false;
  if (prevProps.task.showRecurrenceIndex !== nextProps.task.showRecurrenceIndex) return false;

  // 2. Completion logs changed (by length or content)
  if (prevProps.completionLogs?.length !== nextProps.completionLogs?.length) return false;

  // 3. Handler references changed (usually stable but check)
  if (prevProps.onComplete !== nextProps.onComplete) return false;
  if (prevProps.onRecover !== nextProps.onRecover) return false;
  if (prevProps.onDelete !== nextProps.onDelete) return false;
  if (prevProps.showRecover !== nextProps.showRecover) return false;

  // 4. Task status array changed - check both length AND content for status changes
  const prevStatuses = prevProps.task.taskStatus ?? [];
  const nextStatuses = nextProps.task.taskStatus ?? [];
  if (prevStatuses.length !== nextStatuses.length) return false;

  // Deep compare status content for ring color changes
  for (let i = 0; i < prevStatuses.length; i++) {
    const prev = prevStatuses[i];
    const next = nextStatuses.find((s: TaskStatusEntity) => s.userId === prev.userId);
    if (!next) return false;
    if (prev.status !== next.status) return false;
    if (prev.ringColor !== next.ringColor) return false;
    if (prev.recoveredAt !== next.recoveredAt) return false;
    if (prev.completedAt !== next.completedAt) return false;
  }

  // 5. Member info visibility changed
  if (prevProps.showMemberInfo !== nextProps.showMemberInfo) return false;

  // Props are equal, skip re-render
  return true;
});

TaskCard.displayName = 'TaskCard';
