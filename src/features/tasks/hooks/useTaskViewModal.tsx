// ============================================================================
// useTaskViewModal - Context and hook for global task view modal state
// ============================================================================

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Task, CompletionLog } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface TaskViewModalState {
    task: Task | null;
    isOpen: boolean;
    onEdit?: (task: Task) => void;
    onDelete?: (taskId: number) => void;
    canModify: boolean;
    completionLogs: CompletionLog[];
}

interface TaskViewModalContextValue extends TaskViewModalState {
    openTaskView: (
        task: Task,
        options?: {
            onEdit?: (task: Task) => void;
            onDelete?: (taskId: number) => void;
            canModify?: boolean;
            completionLogs?: CompletionLog[];
        }
    ) => void;
    closeTaskView: () => void;
}

// ============================================================================
// Context
// ============================================================================

const TaskViewModalContext = createContext<TaskViewModalContextValue | undefined>(
    undefined
);

// ============================================================================
// Provider
// ============================================================================

interface TaskViewModalProviderProps {
    children: ReactNode;
}

/**
 * Provider for global task view modal state.
 * Wrap your app with this provider to enable task view modals from anywhere.
 */
export const TaskViewModalProvider = ({ children }: TaskViewModalProviderProps) => {
    const [state, setState] = useState<TaskViewModalState>({
        task: null,
        isOpen: false,
        onEdit: undefined,
        onDelete: undefined,
        canModify: false,
        completionLogs: [],
    });

    const openTaskView = useCallback(
        (
            task: Task,
            options?: {
                onEdit?: (task: Task) => void;
                onDelete?: (taskId: number) => void;
                canModify?: boolean;
                completionLogs?: CompletionLog[];
            }
        ) => {
            setState({
                task,
                isOpen: true,
                onEdit: options?.onEdit,
                onDelete: options?.onDelete,
                canModify: options?.canModify ?? false,
                completionLogs: options?.completionLogs ?? [],
            });
        },
        []
    );

    const closeTaskView = useCallback(() => {
        setState((prev) => ({
            ...prev,
            isOpen: false,
        }));
    }, []);

    const value: TaskViewModalContextValue = {
        ...state,
        openTaskView,
        closeTaskView,
    };

    return (
        <TaskViewModalContext.Provider value={value}>
            {children}
        </TaskViewModalContext.Provider>
    );
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access the task view modal context.
 * Use openTaskView() to show a task in the modal from any component.
 */
export const useTaskViewModal = (): TaskViewModalContextValue => {
    const context = useContext(TaskViewModalContext);

    if (context === undefined) {
        throw new Error(
            'useTaskViewModal must be used within a TaskViewModalProvider'
        );
    }

    return context;
};
