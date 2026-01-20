// ============================================================================
// Task Validation - Input Validation for Task Operations
// ============================================================================

import type { TaskCreationData } from '@/features/projects/hooks/types';
import { ValidationError } from '@/lib/errors';

/**
 * Validate task creation/update data
 * Throws ValidationError if validation fails
 * 
 * @param data - Task creation data to validate
 * @throws {ValidationError} When validation fails
 * 
 * @example
 * try {
 *   validateTaskCreation(taskData);
 *   await createTask(taskData);
 * } catch (error) {
 *   if (error instanceof ValidationError) {
 *     toast.error(error.message);
 *   }
 * }
 */
export const validateTaskCreation = (data: TaskCreationData): void => {
    // Title validation
    if (!data.title?.trim()) {
        throw new ValidationError('Title is required', 'title');
    }

    if (data.title.length > 200) {
        throw new ValidationError('Title must be less than 200 characters', 'title');
    }

    // Description validation
    if (data.description && data.description.length > 2000) {
        throw new ValidationError('Description must be less than 2000 characters', 'description');
    }

    // Due date validation
    if (!data.dueDate) {
        throw new ValidationError('Due date is required', 'dueDate');
    }

    // Habit/Recurrence validation
    if (data.type === 'habit') {
        if (!data.recurrencePattern) {
            throw new ValidationError('Recurrence pattern is required for recurring tasks', 'recurrencePattern');
        }

        if (data.recurrencePattern === 'custom' && data.customRecurrence) {
            if (data.customRecurrence.interval < 1) {
                throw new ValidationError('Interval must be at least 1', 'recurrenceInterval');
            }

            if (data.customRecurrence.endType === 'count' &&
                (!data.customRecurrence.occurrenceCount || data.customRecurrence.occurrenceCount < 1)) {
                throw new ValidationError('Must have at least 1 occurrence', 'occurrenceCount');
            }

            if (data.customRecurrence.endType === 'date' && !data.customRecurrence.endDate) {
                throw new ValidationError('End date is required when using date-based recurrence', 'endDate');
            }
        }
    }
};

/**
 * Validate task update data (less strict for updates)
 * 
 * @param data - Partial task data to validate
 * @throws {ValidationError} When validation fails
 */
export const validateTaskUpdate = (data: Partial<TaskCreationData>): void => {
    if (data.title !== undefined) {
        if (!data.title?.trim()) {
            throw new ValidationError('Title cannot be empty', 'title');
        }

        if (data.title.length > 200) {
            throw new ValidationError('Title must be less than 200 characters', 'title');
        }
    }

    if (data.description !== undefined && data.description.length > 2000) {
        throw new ValidationError('Description must be less than 2000 characters', 'description');
    }
};
