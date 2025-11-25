import { Task, User } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle2, Circle, Clock, Repeat, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getUserById, getProjectById, currentUser, mapTaskStatusForUI } from '@/lib/mockData';
import { useState } from 'react';
import { DifficultyRatingModal } from './DifficultyRatingModal';

interface TaskCardProps {
  task: Task;
  onAccept?: (taskId: string) => void;
  onDecline?: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
}

export const TaskCard = ({ task, onAccept, onDecline, onComplete }: TaskCardProps) => {
  const [showRatingModal, setShowRatingModal] = useState(false);
  const creator = getUserById(task.creatorId);
  const assignee = getUserById(task.assigneeId);
  const project = getProjectById(task.projectId);

  const myCompletion = task.completions[currentUser.id];
  const partnerCompletion = task.completions[task.creatorId === currentUser.id ? task.assigneeId : task.creatorId];

  // Map status to UI-friendly status
  const uiStatus = mapTaskStatusForUI(task.status);
  const canComplete = uiStatus === 'accepted' && !myCompletion?.completed;
  const needsAcceptance = (uiStatus === 'pending' || task.status === 'pending_acceptance') && task.assigneeId === currentUser.id;

  const getStatusBadgeVariant = () => {
    switch (uiStatus) {
      case 'pending':
        return 'outline';
      case 'accepted':
        return 'secondary';
      case 'completed':
        return 'default';
      default:
        return 'outline';
    }
  };

  const getStatusColor = () => {
    switch (uiStatus) {
      case 'pending':
        return 'text-status-pending';
      case 'accepted':
        return 'text-status-accepted';
      case 'completed':
        return 'text-status-completed';
      default:
        return 'text-muted-foreground';
    }
  };

  const handleComplete = () => {
    if (canComplete && onComplete) {
      setShowRatingModal(true);
    }
  };

  const handleRatingSubmit = (rating: number) => {
    if (onComplete) {
      onComplete(task.id);
      // In a real app, we'd pass the rating here
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
                  {task.type === 'recurring' && (
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      <Repeat className="w-3 h-3" />
                      {task.recurrencePattern}
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
                variant={uiStatus === 'completed' ? 'outline' : getStatusBadgeVariant()} 
                className={`${getStatusColor()} capitalize shrink-0 font-bold ${
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
                {creator && (
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8 ring-2 ring-border">
                      <AvatarImage src={creator.avatar} alt={creator.name} />
                      <AvatarFallback>{creator.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-1">
                      {myCompletion?.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-success" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                )}

                <div className="h-6 w-px bg-border" />

                {assignee && (
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8 ring-2 ring-border">
                      <AvatarImage src={assignee.avatar} alt={assignee.name} />
                      <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-1">
                      {partnerCompletion?.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-success" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {task.dueDate && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Today</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <AnimatePresence mode="wait">
              {needsAcceptance && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex gap-2 pt-2 border-t border-border/50"
                >
                  <Button
                    onClick={() => onAccept?.(task.id)}
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                    size="sm"
                  >
                    Accept
                  </Button>
                  <Button
                    onClick={() => onDecline?.(task.id)}
                    variant="outline"
                    className="flex-1"
                    size="sm"
                  >
                    Decline
                  </Button>
                </motion.div>
              )}

              {canComplete && (
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

              {uiStatus === 'completed' && myCompletion?.difficultyRating && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 pt-2 border-t border-border/50"
                >
                  <Sparkles className="w-4 h-4 text-accent" />
                  <span className="text-sm text-muted-foreground">
                    Difficulty: {myCompletion.difficultyRating}/10
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
