// ============================================================================
// TaskViewModal - Modal for viewing task details
// ============================================================================

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Task, User, CompletionLog } from '@/types';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    X,
    Pencil,
    Trash2,
    Calendar,
    Repeat,
    Users,
    FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeId } from '@/lib/idUtils';
import { useAuth } from '@/features/auth/useAuth';
import { useProject } from '@/features/projects/hooks/useProjects';
import { getDatabaseClient } from '@/db';
import { getIconByName } from '@/lib/projects/projectIcons';
import { adjustColorOpacity } from '@/lib/colorUtils';
import {
    getStatusBadgeVariant,
    getStatusColor,
    calculateTaskStatusUserStatus,
} from '@/lib/tasks/taskUtils';
import { TaskMembersList } from './TaskMembersList';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

interface TaskViewModalProps {
    task: Task | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onEdit?: (task: Task) => void;
    onDelete?: (taskId: number) => void;
    canModify?: boolean;
    completionLogs?: CompletionLog[];
}

// ============================================================================
// Component
// ============================================================================

/**
 * Modal dialog for viewing complete task details.
 * Shows task name, description, project info, members list, and action buttons.
 */
export const TaskViewModal = ({
    task,
    open,
    onOpenChange,
    onEdit,
    onDelete,
    canModify = false,
    completionLogs = [],
}: TaskViewModalProps) => {
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const projectId = task ? normalizeId(task.projectId) : 0;
    const { data: project } = useProject(projectId);

    // Extract unique participant user IDs
    const participantUserIds = useMemo(() => {
        if (!task?.taskStatus) return [];
        const uniqueIds = new Set<number>();
        task.taskStatus.forEach((ts) => {
            uniqueIds.add(normalizeId(ts.userId));
        });
        return Array.from(uniqueIds);
    }, [task?.taskStatus]);

    // Fetch participant user data
    const { data: participantUsersData = [] } = useQuery({
        queryKey: ['users', 'batch', participantUserIds.join(',')],
        queryFn: async () => {
            const db = getDatabaseClient();
            const users = await Promise.all(
                participantUserIds.map((userId) => db.users.getById(userId))
            );
            return users.filter((u): u is User => u !== null);
        },
        enabled: participantUserIds.length > 0 && open,
        staleTime: 1000 * 60 * 10,
        gcTime: 1000 * 60 * 30,
    });

    // Build a map of userId -> User for quick lookup
    const participantUsers = useMemo(() => {
        const map = new Map<number, User>();
        participantUsersData.forEach((user) => {
            map.set(normalizeId(user.id), user);
        });
        if (currentUser) {
            map.set(normalizeId(currentUser.id), currentUser);
        }
        return map;
    }, [participantUsersData, currentUser]);

    // Get current user's task status
    const myTaskStatus = useMemo(() => {
        if (!currentUser || !task?.taskStatus) return undefined;
        const userId = normalizeId(currentUser.id);
        return task.taskStatus.find((ts) => normalizeId(ts.userId) === userId);
    }, [task?.taskStatus, currentUser]);

    // Check for completion
    const myCompletion = useMemo(() => {
        if (!currentUser || !task) return undefined;
        const userId = normalizeId(currentUser.id);
        const taskId = normalizeId(task.id);
        return completionLogs.find(
            (log) =>
                normalizeId(log.taskId) === taskId && normalizeId(log.userId) === userId
        );
    }, [completionLogs, task, currentUser]);

    // Calculate UI status
    const uiStatus = task
        ? calculateTaskStatusUserStatus(myTaskStatus, myCompletion, task)
        : 'active';

    const handleEdit = () => {
        if (task && onEdit) {
            onOpenChange(false);
            onEdit(task);
        }
    };

    const handleDelete = () => {
        if (task && onDelete) {
            onDelete(task.id);
            setShowDeleteConfirm(false);
            onOpenChange(false);
        }
    };

    const handleProjectClick = () => {
        if (project) {
            onOpenChange(false);
            navigate(`/projects/${project.id}`);
        }
    };

    if (!task) return null;

    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let dueDateLabel = '';
    if (dueDate) {
        const dueDateOnly = new Date(dueDate);
        dueDateOnly.setHours(0, 0, 0, 0);
        const isToday = dueDateOnly.getTime() === today.getTime();
        const isTomorrow = dueDateOnly.getTime() === today.getTime() + 86400000;

        if (isToday) {
            dueDateLabel = 'Today';
        } else if (isTomorrow) {
            dueDateLabel = 'Tomorrow';
        } else {
            dueDateLabel = dueDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
            });
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl [&>button.absolute]:hidden">
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background pointer-events-none" />

                {/* Header */}
                <DialogHeader className="p-6 pb-4 relative z-10 border-b border-border/40">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            {/* Project Badge */}
                            {project && (
                                <Badge
                                    variant="outline"
                                    className="text-xs font-bold px-3 py-0.5 rounded-full flex items-center gap-1.5 w-fit mb-3 cursor-pointer hover:opacity-80 transition-all"
                                    onClick={handleProjectClick}
                                    style={
                                        project.color
                                            ? {
                                                backgroundColor: adjustColorOpacity(project.color, 0.15),
                                                borderColor: adjustColorOpacity(project.color, 0.3),
                                                color: project.color,
                                            }
                                            : undefined
                                    }
                                >
                                    {project.icon &&
                                        (() => {
                                            const Icon = getIconByName(project.icon);
                                            return <Icon className="w-3 h-3" />;
                                        })()}
                                    <span>{project.name}</span>
                                </Badge>
                            )}

                            <DialogTitle className="text-xl font-bold tracking-tight text-left">
                                {task.title}
                            </DialogTitle>

                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                                {/* Status Badge */}
                                <Badge
                                    variant={getStatusBadgeVariant(uiStatus)}
                                    className={cn(
                                        'capitalize font-bold',
                                        getStatusColor(uiStatus),
                                        uiStatus === 'completed' &&
                                        'bg-status-completed/15 border-status-completed/40 text-status-completed'
                                    )}
                                    style={
                                        uiStatus === 'completed'
                                            ? {
                                                borderColor: 'hsl(var(--status-completed) / 0.4)',
                                                backgroundColor: 'hsl(var(--status-completed) / 0.15)',
                                                color: 'hsl(var(--status-completed))',
                                            }
                                            : undefined
                                    }
                                >
                                    {uiStatus}
                                </Badge>

                                {/* Due Date */}
                                {dueDateLabel && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>{dueDateLabel}</span>
                                    </div>
                                )}

                                {/* Recurrence */}
                                {task.type === 'habit' && task.recurrencePattern && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Repeat className="w-3.5 h-3.5" />
                                        <span>
                                            {task.recurrencePattern === 'Daily'
                                                ? 'Daily'
                                                : task.recurrencePattern === 'weekly'
                                                    ? 'Weekly'
                                                    : task.recurrencePattern}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                            {canModify && onEdit && task.type !== 'habit' && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                    onClick={handleEdit}
                                    title="Edit Task"
                                >
                                    <Pencil className="w-4 h-4" />
                                </Button>
                            )}
                            <DialogClose className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                                <X className="h-4 w-4" />
                                <span className="sr-only">Close</span>
                            </DialogClose>
                        </div>
                    </div>
                </DialogHeader>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4 relative z-10 custom-scrollbar">
                    {/* Description */}
                    {task.description && (
                        <div className="mb-6">
                            <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-muted-foreground">
                                <FileText className="w-4 h-4" />
                                <span>Description</span>
                            </div>
                            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                {task.description}
                            </p>
                        </div>
                    )}

                    {/* Members Section */}
                    {task.taskStatus && task.taskStatus.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-muted-foreground">
                                <Users className="w-4 h-4" />
                                <span>Members ({task.taskStatus.length})</span>
                            </div>
                            <TaskMembersList
                                task={task}
                                completionLogs={completionLogs}
                                participantUsers={participantUsers}
                                maxVisibleWithoutScroll={5}
                            />
                        </div>
                    )}
                </div>

                {/* Footer with Delete Button */}
                {canModify && onDelete && (
                    <div className="p-4 border-t border-border/40 relative z-10">
                        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    {task.type === 'habit' ? 'Delete Series' : 'Delete Task'}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>
                                        {task.type === 'habit' ? 'Delete Recurring Series?' : 'Delete Task?'}
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                        {task.type === 'habit'
                                            ? `Are you sure you want to delete "${task.title}"? This will delete ALL instances of this recurring task series.`
                                            : `Are you sure you want to delete "${task.title}"? This action cannot be undone and will remove the task for all participants.`
                                        }
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={handleDelete}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                        {task.type === 'habit' ? 'Delete Series' : 'Delete'}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

TaskViewModal.displayName = 'TaskViewModal';
