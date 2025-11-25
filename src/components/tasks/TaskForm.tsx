import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Project, User, TaskType, RecurrencePattern } from '@/types';
import { mockUsers, currentUser } from '@/lib/mockData';
import { motion } from 'framer-motion';
import { CalendarIcon, Repeat, Sparkles, Users } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (task: {
    title: string;
    description: string;
    assigneeId: string;
    type: TaskType;
    recurrencePattern?: RecurrencePattern;
    dueDate?: Date;
  }) => void;
  project: Project;
}

export const TaskForm = ({ open, onOpenChange, onSubmit, project }: TaskFormProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('daily');
  const [dueDate, setDueDate] = useState<Date | undefined>(new Date());

  const availableUsers = mockUsers.filter(u => 
    u.id !== currentUser.id && project.participants.some(p => p.id === u.id)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !assigneeId) {
      return;
    }

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      assigneeId,
      type: isRecurring ? 'recurring' : 'one_off',
      recurrencePattern: isRecurring ? recurrencePattern : undefined,
      dueDate
    });

    // Reset form
    setTitle('');
    setDescription('');
    setAssigneeId('');
    setIsRecurring(false);
    setRecurrencePattern('daily');
    setDueDate(new Date());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <DialogTitle>Initiate New Task</DialogTitle>
          </div>
          <DialogDescription>
            Create a task in <span className="font-medium" style={{ color: project.color }}>{project.name}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Task Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Task Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Morning meditation"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-base"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Add details about this task..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[100px] text-base resize-none"
            />
          </div>

          {/* Assign To */}
          <div className="space-y-2">
            <Label>Assign To *</Label>
            <div className="grid grid-cols-2 gap-3">
              {availableUsers.map((user) => (
                <motion.button
                  key={user.id}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setAssigneeId(user.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                    assigneeId === user.id
                      ? "border-primary bg-primary/5 shadow-primary"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Avatar className="w-10 h-10 ring-2 ring-border">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{user.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{user.handle}</div>
                  </div>
                </motion.button>
              ))}
            </div>
            {availableUsers.length === 0 && (
              <div className="text-sm text-muted-foreground flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Users className="w-4 h-4" />
                <span>No other participants in this project. Add friends to collaborate!</span>
              </div>
            )}
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Recurring Task Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Repeat className="w-5 h-5 text-primary" />
              </div>
              <div>
                <Label htmlFor="recurring" className="cursor-pointer">
                  Recurring Task
                </Label>
                <p className="text-xs text-muted-foreground">
                  Repeat this task automatically
                </p>
              </div>
            </div>
            <Switch
              id="recurring"
              checked={isRecurring}
              onCheckedChange={setIsRecurring}
            />
          </div>

          {/* Recurrence Pattern */}
          {isRecurring && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              <Label htmlFor="pattern">Recurrence Pattern</Label>
              <Select value={recurrencePattern} onValueChange={(v) => setRecurrencePattern(v as RecurrencePattern)}>
                <SelectTrigger id="pattern">
                  <SelectValue placeholder="Select pattern" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">
                    <div className="flex items-center gap-2">
                      <span>📅</span>
                      <span>Daily</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="weekly">
                    <div className="flex items-center gap-2">
                      <span>📆</span>
                      <span>Weekly</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="custom">
                    <div className="flex items-center gap-2">
                      <span>⚙️</span>
                      <span>Custom</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </motion.div>
          )}

          {/* Info Badge */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Note:</span> Your friend will need to accept 
              this task before it becomes active. You'll both need to complete it for it to count! 💪
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || !assigneeId}
              className="flex-1 gradient-primary text-white"
            >
              Initiate Task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
