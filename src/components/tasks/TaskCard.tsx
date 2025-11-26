import { Task, User } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle2, Circle, Clock, Repeat, Sparkles, Calendar, Clock as ClockIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getUserById, getProjectById, currentUser, mapTaskStatusForUI } from '@/lib/mockData';
import { useState } from 'react';
import { DifficultyRatingModal } from './DifficultyRatingModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: Task;
  onAccept?: (taskId: string) => void;
  onDecline?: (taskId: string) => void;
  onComplete?: (taskId: string, difficultyRating?: number) => void;
  onProposeTime?: (taskId: string, proposedDate: Date) => void;
}

export const TaskCard = ({ task, onAccept, onDecline, onComplete, onProposeTime }: TaskCardProps) => {
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [proposedDate, setProposedDate] = useState<Date | undefined>(task.dueDate ? new Date(task.dueDate) : new Date());
  const [proposedTime, setProposedTime] = useState<string>('09:00');
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
      onComplete(task.id, rating);
    }
    setShowRatingModal(false);
  };

  const handleProposeTime = () => {
    if (proposedDate && onProposeTime) {
      const finalDate = new Date(proposedDate);
      const [hours, minutes] = proposedTime.split(':').map(Number);
      finalDate.setHours(hours || 9, minutes || 0, 0, 0);
      onProposeTime(task.id, finalDate);
      setShowProposeModal(false);
    }
  };

  const isTimeProposed = task.status === 'time_proposed';
  const canRespondToProposal = isTimeProposed && task.proposedByUserId !== currentUser.id;
  const isProposer = isTimeProposed && task.proposedByUserId === currentUser.id;

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
                
                // Format time
                const timeLabel = dueDate.toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit',
                  hour12: true 
                });
                
                return (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{dateLabel} {timeLabel}</span>
                  </div>
                );
              })()}
            </div>

            {/* Show proposed time info */}
            {isTimeProposed && task.proposedDueDate && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <ClockIcon className="w-4 h-4 text-primary" />
                  <span className="font-medium">New time proposed:</span>
                </div>
                <div className="text-muted-foreground">
                  {format(new Date(task.proposedDueDate), "PPP 'at' p")}
                </div>
              </div>
            )}

            {/* Actions */}
            <AnimatePresence mode="wait">
              {needsAcceptance && !isTimeProposed && (
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
                  <Button
                    onClick={() => setShowProposeModal(true)}
                    variant="outline"
                    className="flex-1"
                    size="sm"
                  >
                    <Calendar className="w-4 h-4 mr-1" />
                    Propose Time
                  </Button>
                </motion.div>
              )}

              {canRespondToProposal && (
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
                  <Button
                    onClick={() => setShowProposeModal(true)}
                    variant="outline"
                    className="flex-1"
                    size="sm"
                  >
                    <Calendar className="w-4 h-4 mr-1" />
                    Propose Time
                  </Button>
                </motion.div>
              )}

              {isProposer && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-2 border-t border-border/50"
                >
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-muted-foreground text-center">
                    <ClockIcon className="w-4 h-4 mx-auto mb-1 text-primary" />
                    <p className="font-medium text-foreground">Waiting for response</p>
                    <p className="text-xs mt-1">Your time proposal is pending approval</p>
                  </div>
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

      {/* Propose New Time Modal */}
      <Dialog open={showProposeModal} onOpenChange={setShowProposeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Propose New Time</DialogTitle>
            <DialogDescription>
              Suggest a different date and time for this task
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !proposedDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {proposedDate ? format(proposedDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={proposedDate}
                    onSelect={setProposedDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>New Time</Label>
              <Input
                type="time"
                value={proposedTime}
                onChange={(e) => setProposedTime(e.target.value)}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowProposeModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleProposeTime}
                disabled={!proposedDate}
                className="flex-1 gradient-primary text-white"
              >
                Propose Time
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
