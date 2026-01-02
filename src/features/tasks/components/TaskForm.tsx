import { useState, useEffect, FormEvent } from 'react';
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
import type { Project, User, Task, TaskType, RecurrencePattern } from '@/types';
import { motion } from 'framer-motion';
import { CalendarIcon, Repeat, Sparkles, Users, FolderKanban, Plus, Wand2, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ProjectForm } from '@/features/projects/components/ProjectForm';
import { toast } from 'sonner';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { AIGenerateButton, type AIButtonState } from '@/components/ui/ai-generate-button';

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (task: {
    title: string;
    description: string;
    projectId: string | number;
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
    showRecurrenceIndex?: boolean;
  }) => void;
  initialTask?: Task;
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
  initialTask,
  project: initialProject,
  projects = [], // Default to empty array if not provided
  allowProjectSelection = false,
  onCreateProject
}: TaskFormProps) => {
  const { data: currentUser } = useCurrentUser();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | number>(initialProject?.id || '');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('Daily');
  const [showRecurrenceIndex, setShowRecurrenceIndex] = useState(false);
  const [dueDate, setDueDate] = useState<Date | undefined>(new Date());

  // Custom recurrence settings
  const [customRecurrence, setCustomRecurrence] = useState<{
    frequency: 'days' | 'weeks' | 'months';
    interval: number | string;
    daysOfWeek: number[];
    endType: 'date' | 'count';
    endDate?: Date;
    occurrenceCount: number | string;
  }>({
    frequency: 'days',
    interval: 1,
    daysOfWeek: [], // 0 = Sunday, 1 = Monday, etc.
    endType: 'date',
    endDate: undefined,
    occurrenceCount: 10
  });
  const [showProjectForm, setShowProjectForm] = useState(false);

  // AI Generation State
  const [aiState, setAiState] = useState<AIButtonState>('idle');
  // Counter to toggle success/fail logic (Mock)
  const [aiGenerateCount, setAiGenerateCount] = useState(0);

  // Use provided projects list, or fall back to initialProject
  const project = initialProject || (selectedProjectId ? projects.find(p => {
    const pId = typeof p.id === 'string' ? p.id : String(p.id);
    const sId = typeof selectedProjectId === 'string' ? selectedProjectId : String(selectedProjectId);
    return pId === sId;
  }) : undefined);
  const availableProjects = allowProjectSelection ? projects : [];

  // Reset form or populate with initialTask when dialog state changes
  useEffect(() => {
    if (open) {
      if (initialTask) {
        setTitle(initialTask.title);
        setDescription(initialTask.description || '');
        setIsRecurring(initialTask.type === 'habit');
        setRecurrencePattern(initialTask.recurrencePattern || 'Daily');
        setShowRecurrenceIndex(initialTask.showRecurrenceIndex || false);
        setDueDate(initialTask.dueDate ? new Date(initialTask.dueDate) : new Date());
        setSelectedProjectId(initialTask.projectId);
      } else {
        // Only reset if not editing
        setTitle('');
        setDescription('');
        setIsRecurring(false);
        setRecurrencePattern('Daily');
        setShowRecurrenceIndex(false);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        setDueDate(now);
        if (!initialProject) {
          setSelectedProjectId('');
        }
      }
    }
  }, [open, initialTask, initialProject]);

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

  const handleProjectFormClose = (open: boolean) => {
    setShowProjectForm(open);
  };

  const handleAIGenerate = async () => {
    if (!title.trim()) {
      toast.error('Please enter a task title first');
      return;
    }

    setAiState('loading');

    // Simulate API delay
    setTimeout(() => {
      // Logic: Success on 1st try (even count), Fail on 2nd (odd count)
      // We check current count value. 
      // 0 -> Success
      // 1 -> Fail
      // 2 -> Success ...
      const shouldFail = aiGenerateCount % 2 !== 0; // 1, 3, 5...

      if (shouldFail) {
        setAiState('error');
        toast.error('AI generation failed based on simulation rules.');
      } else {
        setAiState('success');
        setDescription((prev) => {
          // If description exists, append. If not, set.
          const aiDesc = ` ✨ AI Generated Description for "${title}": This task involves focused work to achieve the desired outcome. Remember to break it down into smaller steps!`;
          return prev ? prev + '\n' + aiDesc : aiDesc;
        });
        toast.success('Description generated!');
      }

      setAiGenerateCount(prev => prev + 1);

      // Reset to idle after a delay so user can try again
      setTimeout(() => {
        setAiState('idle');
      }, 3000);

    }, 2000); // 2 second generation simulated delay
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !project) {
      return;
    }

    // Tasks can now be created by any owner/manager regardless of participant count
    // if (!project.isPublic) {
    //   const participantCount = project.participants?.length || project.participantRoles?.length || 0;
    //   if (participantCount < 2) {
    //     toast.error('Task requires at least 2 participants', {
    //       description: 'Add more members to the project first'
    //     });
    //     return;
    //   }
    // }

    // Set due date to start of day (no time component)
    let finalDueDate: Date | undefined = undefined;
    if (dueDate) {
      finalDueDate = new Date(dueDate);
      finalDueDate.setHours(0, 0, 0, 0);
    }

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      projectId: project.id,
      type: isRecurring ? 'habit' : 'one_off',
      recurrencePattern: isRecurring ? recurrencePattern : undefined,
      dueDate: finalDueDate,
      customRecurrence: isRecurring && recurrencePattern === 'custom' ? {
        ...customRecurrence,
        interval: Number(customRecurrence.interval) || 1,
        occurrenceCount: Number(customRecurrence.occurrenceCount) || 1
      } : undefined,
      showRecurrenceIndex: isRecurring ? showRecurrenceIndex : undefined
    });

    // Reset form
    setTitle('');
    setDescription('');
    setIsRecurring(false);
    setRecurrencePattern('Daily');
    setShowRecurrenceIndex(false);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    setDueDate(now);
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
            {initialTask ? <Pencil className="w-5 h-5 text-primary" /> : <Sparkles className="w-5 h-5 text-primary" />}
            <DialogTitle>{initialTask ? 'Edit Task' : 'Create New Task'}</DialogTitle>
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
                  value={typeof selectedProjectId === 'string' ? selectedProjectId : selectedProjectId.toString()}
                  onValueChange={(value) => {
                    if (value === 'none') {
                      setSelectedProjectId('');
                    } else {
                      // Handle both string and number IDs
                      const numValue = parseInt(value);
                      setSelectedProjectId(isNaN(numValue) ? value : numValue);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select or Create a project">
                      {project ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                          <span>{project.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Select or Create a project</span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {/* Option to clear selection */}
                    {selectedProjectId && (
                      <SelectItem value="none">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span>—</span>
                          <span>None (clear selection)</span>
                        </div>
                      </SelectItem>
                    )}
                    {/* Existing projects */}
                    {availableProjects.map((proj) => (
                      <SelectItem key={proj.id} value={String(proj.id)}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: proj.color }}
                          />
                          <span>{proj.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                    {/* Create New Project button - separate from select items */}
                    <div className="border-t border-border mt-1 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowProjectForm(true);
                        }}
                        className="w-full justify-start text-primary font-medium hover:bg-primary/10"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create New Project
                      </Button>
                    </div>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {project && !allowProjectSelection && (
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant="secondary"
                className="text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full border-none whitespace-nowrap shrink-0 transition-all duration-300 shadow-sm bg-muted/40"
                style={project.color ? {
                  backgroundColor: `${project.color}15`,
                  color: project.color
                } : undefined}
              >
                {project.name}
              </Badge>
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
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Description</Label>
              <AIGenerateButton
                state={aiState}
                onClick={handleAIGenerate}
                disabled={!title.trim() || aiState === 'loading'}
                className="scale-90 origin-right" // Make it slightly more compact
              />
            </div>
            <Textarea
              id="description"
              placeholder="Add details about this task..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[100px] text-base resize-none"
            />
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
                  onSelect={(date) => {
                    if (date) {
                      const newDate = new Date(date);
                      newDate.setHours(0, 0, 0, 0);
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
                  <SelectItem value="Daily">
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

              {/* Show Occurrence Number Toggle */}
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                <div className="space-y-0.5">
                  <Label htmlFor="show-numbering" className="text-sm font-medium cursor-pointer">
                    Show Recurrence Number
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Display number (e.g., "Daily  1")
                  </p>
                </div>
                <Switch
                  id="show-numbering"
                  checked={showRecurrenceIndex}
                  onCheckedChange={setShowRecurrenceIndex}
                />
              </div>

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
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomRecurrence(prev => ({
                            ...prev,
                            interval: val === '' ? '' : parseInt(val)
                          }));
                        }}
                        onBlur={() => {
                          setCustomRecurrence(prev => ({
                            ...prev,
                            interval: Math.max(1, Number(prev.interval) || 1)
                          }));
                        }}
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
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomRecurrence(prev => ({
                              ...prev,
                              occurrenceCount: val === '' ? '' : parseInt(val)
                            }));
                          }}
                          onBlur={() => {
                            setCustomRecurrence(prev => ({
                              ...prev,
                              occurrenceCount: Math.max(1, Number(prev.occurrenceCount) || 1)
                            }));
                          }}
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
              <span className="font-medium text-foreground">Note:</span> This task will be automatically assigned
              to all project members. 💪
              <br />
              <br />
              <b> Daily/Weekly recurring tasks will repeat for 30 days.</b>
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
              disabled={!title.trim() || !project}
              className="flex-1 gradient-primary text-white"
            >
              {initialTask ? 'Update Task' : 'Create Task'}
            </Button>
          </div>
        </form>
      </DialogContent>

      {allowProjectSelection && onCreateProject && currentUser && (
        <ProjectForm
          open={showProjectForm}
          onOpenChange={handleProjectFormClose}
          onSubmit={handleCreateProject}
          currentUser={currentUser}
        />
      )}
    </Dialog>
  );
};
