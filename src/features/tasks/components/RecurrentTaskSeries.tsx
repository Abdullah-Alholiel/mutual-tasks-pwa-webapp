import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Repeat, Trash2, CalendarClock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TaskCard } from './TaskCard';
import type { CompletionLog, Task } from '@/types';
import type { HabitSeries } from '@/features/projects/hooks/types';

interface RecurrentTaskSeriesProps {
    series: HabitSeries;
    completionLogs?: CompletionLog[];
    onDeleteSeries?: (series: HabitSeries) => void;
    onRecoverTask?: (taskId: string | number) => void;
    onCompleteTask?: (taskId: string | number, difficultyRating?: number) => void;
    onDeleteTask?: (taskId: string | number) => void;
    getOnEditTask?: (task: Task) => ((task: Task) => void) | undefined;
    canManage?: boolean;
}

export const RecurrentTaskSeries = ({
    series,
    completionLogs = [],
    onDeleteSeries,
    onRecoverTask,
    onCompleteTask,
    onDeleteTask,
    getOnEditTask,
    canManage
}: RecurrentTaskSeriesProps) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Calculate stats using completionLogs to determine status
    const totalTasks = series.tasks.length;

    // A task is considered completed if it appears in the completion logs
    const completedTasks = series.tasks.filter(task =>
        completionLogs.some(log => log.taskId === task.id)
    ).length;

    const activeTasks = totalTasks - completedTasks;

    // Find the first non-completed task sorted by due date
    // We filter out completed tasks, then sort by date
    const nextUpTask = series.tasks
        .filter(task => !completionLogs.some(log => log.taskId === task.id))
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

    // Format next due
    const formattedNextDue = nextUpTask?.dueDate
        ? new Date(nextUpTask.dueDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
        : 'No upcoming tasks';

    return (
        <div className="group rounded-xl border border-border/60 bg-card/30 overflow-hidden transition-all duration-300 hover:border-primary/20 hover:bg-card/50">
            {/* Header / Summary Card */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-4 cursor-pointer select-none"
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        {/* Icon Box */}
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 transition-colors group-hover:bg-primary/15">
                            <Repeat className="w-5 h-5" />
                        </div>

                        {/* Content */}
                        <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-base truncate pr-2">{series.title}</h3>
                                <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-background/50 uppercase tracking-wide shrink-0">
                                    {series.recurrencePattern || 'Recurring'}
                                </Badge>
                            </div>

                            {/* Detailed Info Row */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground/80">
                                <div className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-primary/70" />
                                    <span>{activeTasks} Active / {totalTasks} Total</span>
                                </div>
                                {nextUpTask && (
                                    <div className="flex items-center gap-1.5">
                                        <CalendarClock className="w-3.5 h-3.5 text-accent/70" />
                                        <span>Upcoming: {formattedNextDue}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Action Area */}
                    <div className="flex items-center gap-1 self-center">
                        {isExpanded && canManage && onDeleteSeries && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteSeries(series);
                                }}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                        <div className={`text-muted-foreground/50 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                            <ChevronDown className="w-5 h-5" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Expanded Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="border-t border-border/40 bg-muted/20"
                    >
                        <div className="p-3 space-y-2.5">
                            {series.tasks.map((task) => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    completionLogs={completionLogs}
                                    onRecover={onRecoverTask}
                                    onComplete={onCompleteTask}
                                    onDelete={onDeleteTask}
                                    onEdit={getOnEditTask ? getOnEditTask(task) : undefined}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
