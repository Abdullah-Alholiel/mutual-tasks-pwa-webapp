// ============================================================================
// Recurring Task Utilities - Modular Recurrence Pattern Calculations
// ============================================================================

import type { RecurrencePattern, Task, TaskRecurrence } from '@/types';
import { addDays, addWeeks, addMonths } from 'date-fns';
import { TASK_CONFIG } from '@/config/appConfig';

/**
 * Custom recurrence configuration
 */
export interface CustomRecurrence {
    frequency: 'days' | 'weeks' | 'months';
    interval: number;
    endType?: 'date' | 'count';
    endDate?: Date;
    occurrenceCount?: number;
}

/**
 * Calculate next occurrence date based on recurrence pattern
 * @param currentDate - The current occurrence date
 * @param pattern - Recurrence pattern (Daily, weekly, custom)
 * @param interval - Optional interval multiplier (default: 1)
 * @param customRecurrence - Custom recurrence configuration for 'custom' pattern
 */
export const calculateNextOccurrence = (
    currentDate: Date,
    pattern: RecurrencePattern,
    interval: number = 1,
    customRecurrence?: CustomRecurrence
): Date => {
    switch (pattern) {
        case 'Daily':
            return addDays(currentDate, interval);
        case 'weekly':
            return addWeeks(currentDate, interval);
        case 'custom':
            if (customRecurrence) {
                const { frequency, interval: customInterval } = customRecurrence;
                if (frequency === 'days') {
                    return addDays(currentDate, customInterval);
                } else if (frequency === 'weeks') {
                    return addWeeks(currentDate, customInterval);
                } else if (frequency === 'months') {
                    return addMonths(currentDate, customInterval);
                }
            }
            // Fallback to days
            return addDays(currentDate, interval);
        default:
            return addDays(currentDate, 1);
    }
};

/**
 * Generate recurrence configuration for a task
 * @param task - The base task
 * @param pattern - Recurrence pattern
 * @param interval - Interval between occurrences
 * @param endDate - Optional end date for recurrence
 */
export const createRecurrenceConfig = (
    task: Task,
    pattern: RecurrencePattern,
    interval: number,
    endDate?: Date
): Omit<TaskRecurrence, 'id'> => {
    const nextOccurrence = calculateNextOccurrence(task.dueDate, pattern, interval);

    return {
        taskId: task.id,
        recurrencePattern: pattern,
        recurrenceInterval: interval,
        nextOccurrence,
        endOfRecurrence: endDate,
    };
};

/**
 * Check if a task has more occurrences to generate
 * @param recurrence - The recurrence configuration
 */
export const shouldGenerateNextOccurrence = (
    recurrence: TaskRecurrence | null
): boolean => {
    if (!recurrence) return false;

    const now = new Date();
    const hasOccurrencesLeft =
        !recurrence.endOfRecurrence || now < recurrence.endOfRecurrence;

    return hasOccurrencesLeft && now >= new Date(recurrence.nextOccurrence);
};

/**
 * Calculate all occurrence dates for a recurrence pattern
 * @param startDate - Initial due date
 * @param pattern - Recurrence pattern
 * @param interval - Interval between occurrences
 * @param maxOccurrences - Maximum number of occurrences
 * @param endDate - Optional end date
 * @param customRecurrence - Custom recurrence configuration
 */
export const generateOccurrenceDates = (
    startDate: Date,
    pattern: RecurrencePattern,
    interval: number = 1,
    maxOccurrences: number = 30,
    endDate?: Date,
    customRecurrence?: CustomRecurrence
): Date[] => {
    const dates: Date[] = [new Date(startDate)];
    let currentDate = new Date(startDate);

    while (dates.length < maxOccurrences) {
        currentDate = calculateNextOccurrence(currentDate, pattern, interval, customRecurrence);

        // Stop if we've passed the end date
        if (endDate && currentDate > endDate) break;

        dates.push(new Date(currentDate));
    }

    return dates;
};

/**
 * Get default occurrence count based on recurrence pattern
 * Uses TASK_CONFIG for consistency
 * @param pattern - Recurrence pattern
 */
export const getDefaultOccurrenceCount = (pattern: RecurrencePattern): number => {
    return TASK_CONFIG.DEFAULT_RECURRING_COUNT[pattern as keyof typeof TASK_CONFIG.DEFAULT_RECURRING_COUNT]
        || TASK_CONFIG.DEFAULT_RECURRING_COUNT.custom;
};

/**
 * Get default duration in days for a recurrence pattern
 * @param pattern - Recurrence pattern
 */
export const getDefaultDurationDays = (pattern: RecurrencePattern): number => {
    switch (pattern) {
        case 'Daily':
            return TASK_CONFIG.DEFAULT_RECURRING_DURATION_DAYS;
        case 'weekly':
            return TASK_CONFIG.DEFAULT_RECURRING_DURATION_DAYS + 5; // 35 days for 5 weeks
        case 'custom':
            return TASK_CONFIG.DEFAULT_RECURRING_DURATION_DAYS * 2; // 60 days
        default:
            return TASK_CONFIG.DEFAULT_RECURRING_DURATION_DAYS;
    }
};

/**
 * Get max occurrences from task data or defaults
 * @param pattern - Recurrence pattern
 * @param customOccurrenceCount - Optional custom count
 */
export const getMaxOccurrences = (
    pattern: RecurrencePattern,
    customOccurrenceCount?: number
): number => {
    return customOccurrenceCount
        || TASK_CONFIG.DEFAULT_RECURRING_COUNT[pattern as keyof typeof TASK_CONFIG.DEFAULT_RECURRING_COUNT]
        || TASK_CONFIG.MAX_RECURRING_OCCURRENCES;
};
