import { useRef, useCallback, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Task, CompletionLog } from '@/types';
import { TaskCard } from '@/features/tasks/components/TaskCard';

interface VirtualizedTaskListProps {
    tasks: Task[];
    completionLogs: CompletionLog[];
    onRecover?: (taskId: string | number) => void;
    onComplete?: (taskId: string | number, difficultyRating?: number) => void;
    showRecover?: boolean;
    estimatedItemHeight?: number;
    className?: string;
}

/**
 * VirtualizedTaskList - A performance-optimized task list for mobile
 * 
 * Uses @tanstack/react-virtual for windowing/virtualization.
 * Only renders visible items + a small overscan, dramatically reducing
 * DOM nodes and improving scroll performance on mobile devices.
 */
export const VirtualizedTaskList = memo(({
    tasks,
    completionLogs,
    onRecover,
    onComplete,
    showRecover = true,
    estimatedItemHeight = 260,
    className = '',
}: VirtualizedTaskListProps) => {
    const parentRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: tasks.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => estimatedItemHeight,
        overscan: 3, // Render 3 extra items above/below viewport for smoother scrolling
        measureElement: (element) => {
            // Dynamically measure actual element height for better accuracy
            return element?.getBoundingClientRect().height ?? estimatedItemHeight;
        },
    });

    const virtualItems = virtualizer.getVirtualItems();

    if (tasks.length === 0) {
        return null;
    }

    return (
        <div
            ref={parentRef}
            className={`w-full overflow-y-auto overflow-x-hidden ${className}`}
            style={{
                // Enable hardware acceleration
                transform: 'translateZ(0)',
                willChange: 'scroll-position',
                // Optimize for touch scrolling
                WebkitOverflowScrolling: 'touch',
            }}
        >
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {virtualItems.map((virtualItem) => {
                    const task = tasks[virtualItem.index];
                    return (
                        <div
                            key={task.id}
                            data-index={virtualItem.index}
                            ref={virtualizer.measureElement}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                transform: `translateY(${virtualItem.start}px)`,
                                // Optimize paint performance
                                contain: 'layout style paint',
                            }}
                        >
                            <div className="pb-3">
                                <TaskCard
                                    task={task}
                                    completionLogs={completionLogs}
                                    onRecover={onRecover}
                                    onComplete={onComplete}
                                    showRecover={showRecover}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

VirtualizedTaskList.displayName = 'VirtualizedTaskList';

/**
 * Non-virtualized task list for small lists 
 * Uses CSS containment and hardware acceleration for better performance
 */
export const OptimizedTaskList = memo(({
    tasks,
    completionLogs,
    onRecover,
    onComplete,
    showRecover = true,
    className = '',
}: Omit<VirtualizedTaskListProps, 'estimatedItemHeight'>) => {
    if (tasks.length === 0) {
        return null;
    }

    return (
        <div
            className={`space-y-3 ${className}`}
            style={{
                // Enable hardware acceleration for smoother scrolling
                transform: 'translateZ(0)',
                willChange: 'contents',
            }}
        >
            {tasks.map((task) => (
                <div
                    key={task.id}
                    style={{
                        // CSS containment for better paint performance
                        contain: 'layout style',
                        // Use content-visibility for off-screen optimization
                        contentVisibility: 'auto',
                        containIntrinsicSize: '0 260px',
                    }}
                >
                    <TaskCard
                        task={task}
                        completionLogs={completionLogs}
                        onRecover={onRecover}
                        onComplete={onComplete}
                        showRecover={showRecover}
                    />
                </div>
            ))}
        </div>
    );
});

OptimizedTaskList.displayName = 'OptimizedTaskList';

/**
 * Smart task list that automatically switches between virtualized 
 * and regular rendering based on list size
 */
export const SmartTaskList = memo(({
    tasks,
    completionLogs,
    onRecover,
    onComplete,
    showRecover = true,
    virtualizationThreshold = 15,
    className = '',
}: VirtualizedTaskListProps & { virtualizationThreshold?: number }) => {
    // Use virtualization for large lists, optimized CSS for smaller ones
    const shouldVirtualize = tasks.length > virtualizationThreshold;

    if (shouldVirtualize) {
        return (
            <VirtualizedTaskList
                tasks={tasks}
                completionLogs={completionLogs}
                onRecover={onRecover}
                onComplete={onComplete}
                showRecover={showRecover}
                className={className}
            />
        );
    }

    return (
        <OptimizedTaskList
            tasks={tasks}
            completionLogs={completionLogs}
            onRecover={onRecover}
            onComplete={onComplete}
            showRecover={showRecover}
            className={className}
        />
    );
});

SmartTaskList.displayName = 'SmartTaskList';
