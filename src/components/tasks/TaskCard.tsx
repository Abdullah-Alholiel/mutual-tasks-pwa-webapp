import type { Task, User, TaskStatusUserStatus, TaskStatusEntity, CompletionLog } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle2, Circle, Clock, Repeat, Sparkles, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getUserById, getProjectById, currentUser, mapTaskStatusForUI } from '@/lib/mockData';
import { useState } from 'react';
import { DifficultyRatingModal } from './DifficultyRatingModal';
import { cn } from '@/lib/utils';
import { 
  getRingColor, 
  canCompleteTask, 
  canRecoverTask, 
  getStatusBadgeVariant, 
  getStatusColor 
} from '@/lib/taskUtils';

interface TaskCardProps {
  task: Task;
  completionLogs?: CompletionLog[];
  onAccept?: (taskId: string) => void;
  onDecline?: (taskId: string) => void;
  onComplete?: (taskId: string, difficultyRating?: number) => void;
  onRecover?: (taskId: string) => void;
}

export const TaskCard = ({ task, completionLogs = [], onAccept, onDecline, onComplete, onRecover }: TaskCardProps) => {
  const [showRatingModal, setShowRatingModal] = useState(false);
  const creator = getUserById(task.creatorId);
  const project = getProjectById(task.projectId);
  
  // Get task statuses for current user and other participants (avoid duplicates)
  const myTaskStatus = task.taskStatuses?.find(ts => ts.userId === currentUser.id);
  
  // Check completion via CompletionLog (use provided logs or empty array)
  const myCompletion = completionLogs.find(
    log => log.taskId === task.id && log.userId === currentUser.id
  );

  // Map status to UI-friendly status - use user's individual status if completed, otherwise task status
  const userStatus = myCompletion ? 'completed' : (myTaskStatus?.status || task.status);
  const uiStatus = userStatus === 'completed' ? 'completed' : mapTaskStatusForUI(task.status);
  
  // Check if task is archived (at task level or user's taskStatus level)
  const isTaskArchived = task.status === 'archived' || 
                        myTaskStatus?.status === 'archived' ||
                        (myTaskStatus?.archivedAt !== undefined && myTaskStatus?.archivedAt !== null);
  
  // Use modular utilities for task actions
  const canComplete = canCompleteTask(myTaskStatus, myCompletion, task);
  const canRecover = canRecoverTask(myTaskStatus, task.status, myCompletion, task);
  
  // For archived tasks, always prioritize showing recover button (even if canComplete somehow returns true)
  const shouldShowRecover = isTaskArchived ? canRecover : (canRecover && !canComplete);
  const shouldShowComplete = isTaskArchived ? false : (canComplete && !canRecover);

  const handleComplete = () => {
    if (canComplete && onComplete) {
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
                className={`${getStatusColor(uiStatus)} capitalize shrink-0 font-bold ${
                  uiStatus === 'completed' 
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Show all unique participants */}
                {task.taskStatuses && task.taskStatuses.length > 0 && (() => {
                  const uniqueParticipants = new Map<string, { user: User | undefined; status: typeof myTaskStatus }>();
                  
                  // Add all participants
                  task.taskStatuses.forEach(ts => {
                    if (!uniqueParticipants.has(ts.userId)) {
                      const user = getUserById(ts.userId);
                      uniqueParticipants.set(ts.userId, { user, status: ts });
                    }
                  });
                  
                  return Array.from(uniqueParticipants.values()).map((participant, index) => {
                    const participantCompletion = completionLogs.find(
                      log => log.taskId === task.id && log.userId === participant.status.userId
                    );
                    
                    // Use modular utility for ring color calculation - pass full task entity for comprehensive checks
                    // This ensures archived/expired tasks show red rings for all participants
                    const ringColorClass = getRingColor(participant.status, participantCompletion, task);
                    
                    return (
                      <div key={participant.status.userId} className="flex items-center gap-2">
                        {index > 0 && <div className="h-6 w-px bg-border" />}
                        <Avatar className={cn("w-8 h-8 ring-2", ringColorClass)}>
                          <AvatarImage src={participant.user?.avatar || ''} alt={participant.user?.name || ''} />
                          <AvatarFallback>{participant.user?.name.charAt(0) || '?'}</AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-1">
                          {participantCompletion ? (
                            <CheckCircle2 className="w-5 h-5 text-success" />
                          ) : (
                            <Circle className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {task.dueDate && (() => {
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
    </>
  );
};



