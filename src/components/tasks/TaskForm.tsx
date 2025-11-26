import { useState, useEffect } from 'react';
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
import { CalendarIcon, Repeat, Sparkles, Users, FolderKanban, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { toast } from 'sonner';

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (task: {
    title: string;
    description: string;
    assigneeId: string;
    projectId: string;
    type: TaskType;
    recurrencePattern?: RecurrencePattern;
    dueDate?: Date;
    customRecurrence?: {
      frequency: 'days' | 'weeks' | 'months';
      interval: number;
      daysOfWeek: number[];
      endType: 'date' | 'count';
      endDate?: Date;
      occurrenceCount: number;
    };
  }) => void;
  project?: Project;
  projects?: Project[]; // Actual projects list (includes newly created ones)
  allowProjectSelection?: boolean;
  onCreateProject?: (project: {
    name: string;
    description: string;
    participants: string[];
    color: string;
  }) => Project;
}

export const TaskForm = ({ 
  open, 
  onOpenChange, 
  onSubmit, 
  project: initialProject,
  projects = [], // Default to empty array if not provided
  allowProjectSelection = false,
  onCreateProject
}: TaskFormProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProject?.id || '');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('daily');
  const [dueDate, setDueDate] = useState<Date | undefined>(new Date());
  const [dueTime, setDueTime] = useState<string>(() => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  });
  
  // Custom recurrence settings
  const [customRecurrence, setCustomRecurrence] = useState({
    frequency: 'days' as 'days' | 'weeks' | 'months',
    interval: 1,
    daysOfWeek: [] as number[], // 0 = Sunday, 1 = Monday, etc.
    endType: 'date' as 'date' | 'count',
    endDate: undefined as Date | undefined,
    occurrenceCount: 10
  });
  const [showProjectForm, setShowProjectForm] = useState(false);

  // Use provided projects list, or fall back to initialProject
  const project = initialProject || (selectedProjectId ? projects.find(p => p.id === selectedProjectId) : undefined);
  const availableProjects = allowProjectSelection ? projects : [];
  
  // Get available users - must be participants in the selected project
  const availableUsers = project 
    ? mockUsers.filter(u => {
        if (u.id === currentUser.id) return false;
        // Check participantIds first (normalized), then participants array (for backward compatibility)
        return project.participantIds?.includes(u.id) || project.participants?.some(p => p.id === u.id);
      })
    : mockUsers.filter(u => u.id !== currentUser.id);

  // Reset assignee when project changes
  useEffect(() => {
    if (project && assigneeId) {
      const isAssigneeValid = availableUsers.some(u => u.id === assigneeId);
      if (!isAssigneeValid) {
        setAssigneeId('');
      }
    }
  }, [project, assigneeId, availableUsers]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setTitle('');
      setDescription('');
      setAssigneeId('');
      setIsRecurring(false);
      setRecurrencePattern('daily');
      const now = new Date();
      setDueDate(now);
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setDueTime(`${hours}:${minutes}`);
      if (!initialProject) {
        setSelectedProjectId('');
      }
    }
  }, [open, initialProject]);

  const handleCreateProject = (projectData: {
    name: string;
    description: string;
    participants: string[];
    color: string;
    isPublic: boolean;
  }) => {
    if (onCreateProject) {
      const newProject = onCreateProject(projectData);
      setSelectedProjectId(newProject.id);
      setShowProjectForm(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !assigneeId || !project) {
      return;
    }

    // Validate that assignee is a participant in the selected project
    // Check both participantIds (normalized) and participants array (for backward compatibility)
    const isInParticipantIds = project.participantIds?.includes(assigneeId) ?? false;
    const isInParticipants = project.participants?.some(p => p.id === assigneeId) ?? false;
    
    if (!isInParticipantIds && !isInParticipants) {
      toast.error('Invalid assignee', {
        description: 'The selected friend must be a participant in this project'
      });
      return;
    }

    // Combine date and time - preserve the time properly
    let finalDueDate: Date | undefined = undefined;
    if (dueDate) {
      finalDueDate = new Date(dueDate);
      const [hours, minutes] = dueTime.split(':').map(Number);
      // Ensure we preserve the time even if date picker resets it
      finalDueDate.setHours(hours, minutes || 0, 0, 0);
    }

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      assigneeId,
      projectId: project.id,
      type: isRecurring ? 'recurring' : 'one_off',
      recurrencePattern: isRecurring ? recurrencePattern : undefined,
      dueDate: finalDueDate,
      customRecurrence: isRecurring && recurrencePattern === 'custom' ? customRecurrence : undefined
    });

    // Reset form
    setTitle('');
    setDescription('');
    setAssigneeId('');
        setIsRecurring(false);
        setRecurrencePattern('daily');
        const now = new Date();
        setDueDate(now);
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        setDueTime(`${hours}:${minutes}`);
        setCustomRecurrence({
          frequency: 'days',
          interval: 1,
          daysOfWeek: [],
          endType: 'date',
          endDate: undefined,
          occurrenceCount: 10
        });
    if (!initialProject) {
      setSelectedProjectId('');
    }
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
            {project 
              ? `Create a task in ${project.name}`
              : 'Create a new collaborative task'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Project Selection (if allowed) */}
          {allowProjectSelection && (
            <div className="space-y-2">
              <Label>Project *</Label>
              <div className="space-y-2">
                <Select 
                  value={selectedProjectId} 
                  onValueChange={setSelectedProjectId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProjects.map((proj) => (
                      <SelectItem key={proj.id} value={proj.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: proj.color }}
                          />
                          <span>{proj.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowProjectForm(true)}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Project
                </Button>
              </div>
            </div>
          )}

          {project && (
            <div className="bg-muted/50 rounded-xl p-3 flex items-center gap-2">
              <FolderKanban className="w-4 h-4" style={{ color: project.color }} />
              <span className="text-sm font-medium" style={{ color: project.color }}>
                {project.name}
              </span>
            </div>
          )}

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
            <Label>Due Date & Time</Label>
            <div className="grid grid-cols-2 gap-3">
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
                    onSelect={(date) => {
                      // Preserve the time when date changes
                      if (date) {
                        const newDate = new Date(date);
                        if (dueDate) {
                          // Preserve existing time
                          newDate.setHours(dueDate.getHours(), dueDate.getMinutes(), 0, 0);
                        } else {
                          // Use current time from dueTime state
                          const [hours, minutes] = dueTime.split(':').map(Number);
                          newDate.setHours(hours || 9, minutes || 0, 0, 0);
                        }
                        setDueDate(newDate);
                      } else {
                        setDueDate(date);
                      }
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="text-base"
              />
            </div>
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
              className="space-y-4"
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

              {/* Custom Recurrence Configuration */}
              {recurrencePattern === 'custom' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 p-4 bg-muted/50 rounded-xl border border-border"
                >
                  <div className="space-y-2">
                    <Label>Repeat Every</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={customRecurrence.interval}
                        onChange={(e) => setCustomRecurrence(prev => ({
                          ...prev,
                          interval: Math.max(1, parseInt(e.target.value) || 1)
                        }))}
                        className="w-20"
                      />
                      <Select
                        value={customRecurrence.frequency}
                        onValueChange={(v) => setCustomRecurrence(prev => ({
                          ...prev,
                          frequency: v as 'days' | 'weeks' | 'months'
                        }))}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="days">Day(s)</SelectItem>
                          <SelectItem value="weeks">Week(s)</SelectItem>
                          <SelectItem value="months">Month(s)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Days of Week (for weekly) */}
                  {customRecurrence.frequency === 'weeks' && (
                    <div className="space-y-2">
                      <Label>Repeat On</Label>
                      <div className="flex flex-wrap gap-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              setCustomRecurrence(prev => ({
                                ...prev,
                                daysOfWeek: prev.daysOfWeek.includes(index)
                                  ? prev.daysOfWeek.filter(d => d !== index)
                                  : [...prev.daysOfWeek, index]
                              }));
                            }}
                            className={cn(
                              "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                              customRecurrence.daysOfWeek.includes(index)
                                ? "bg-primary text-primary-foreground"
                                : "bg-background border border-border hover:bg-muted"
                            )}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* End Condition */}
                  <div className="space-y-2">
                    <Label>Ends</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCustomRecurrence(prev => ({ ...prev, endType: 'date' }))}
                        className={cn(
                          "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                          customRecurrence.endType === 'date'
                            ? "bg-primary text-primary-foreground"
                            : "bg-background border border-border hover:bg-muted"
                        )}
                      >
                        On Date
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomRecurrence(prev => ({ ...prev, endType: 'count' }))}
                        className={cn(
                          "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                          customRecurrence.endType === 'count'
                            ? "bg-primary text-primary-foreground"
                            : "bg-background border border-border hover:bg-muted"
                        )}
                      >
                        After Occurrences
                      </button>
                    </div>

                    {customRecurrence.endType === 'date' && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !customRecurrence.endDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {customRecurrence.endDate ? format(customRecurrence.endDate, "PPP") : "Select end date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={customRecurrence.endDate}
                            onSelect={(date) => setCustomRecurrence(prev => ({ ...prev, endDate: date }))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    )}

                    {customRecurrence.endType === 'count' && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          value={customRecurrence.occurrenceCount}
                          onChange={(e) => setCustomRecurrence(prev => ({
                            ...prev,
                            occurrenceCount: Math.max(1, parseInt(e.target.value) || 1)
                          }))}
                          className="flex-1"
                        />
                        <span className="text-sm text-muted-foreground">occurrences</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
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
              disabled={!title.trim() || !assigneeId || !project}
              className="flex-1 gradient-primary text-white"
            >
              Initiate Task
            </Button>
          </div>
        </form>
      </DialogContent>

      {allowProjectSelection && onCreateProject && (
        <ProjectForm
          open={showProjectForm}
          onOpenChange={setShowProjectForm}
          onSubmit={handleCreateProject}
        />
      )}
    </Dialog>
  );
};
