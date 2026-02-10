// ============================================================================
// GlobalTaskViewModal - Renders the global task view modal
// ============================================================================

import { TaskViewModal, useTaskViewModal } from '@/features/tasks';

/**
 * Global component that renders the TaskViewModal.
 * Uses the useTaskViewModal context to get state and handlers.
 * Must be rendered inside TaskViewModalProvider.
 */
export const GlobalTaskViewModal = () => {
    const {
        task,
        taskId,
        isOpen,
        closeTaskView,
        onEdit,
        onDelete,
        canModify,
        completionLogs,
    } = useTaskViewModal();

    return (
        <TaskViewModal
            task={task}
            taskId={taskId}
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) closeTaskView();
            }}
            onEdit={onEdit}
            onDelete={onDelete}
            canModify={canModify}
            completionLogs={completionLogs}
        />
    );
};

GlobalTaskViewModal.displayName = 'GlobalTaskViewModal';
