// ============================================================================
// Task Validation Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { validateTaskCreation } from '../../src/lib/tasks/taskValidation';
import { ValidationError } from '../../src/lib/errors';

describe('validateTaskCreation', () => {
    const validTaskData = {
        projectId: 1,
        creatorId: 1,
        title: 'Test Task',
        description: 'Test description',
        type: 'one_off' as const,
        dueDate: new Date(),
    };

    it('should pass for valid task data', () => {
        expect(() => validateTaskCreation(validTaskData)).not.toThrow();
    });

    it('should throw ValidationError for empty title', () => {
        const data = { ...validTaskData, title: '' };

        expect(() => validateTaskCreation(data)).toThrow(ValidationError);
        expect(() => validateTaskCreation(data)).toThrow('Title is required');
    });

    it('should throw ValidationError for title too long', () => {
        const data = { ...validTaskData, title: 'a'.repeat(201) };

        expect(() => validateTaskCreation(data)).toThrow(ValidationError);
        expect(() => validateTaskCreation(data)).toThrow('Title must be less than 200 characters');
    });

    it('should throw ValidationError for description too long', () => {
        const data = { ...validTaskData, description: 'a'.repeat(2001) };

        expect(() => validateTaskCreation(data)).toThrow(ValidationError);
        expect(() => validateTaskCreation(data)).toThrow('Description must be less than 2000 characters');
    });

    it('should throw ValidationError for missing due date', () => {
        const data = { ...validTaskData, dueDate: undefined };

        expect(() => validateTaskCreation(data as any)).toThrow(ValidationError);
        expect(() => validateTaskCreation(data as any)).toThrow('Due date is required');
    });

    it('should throw ValidationError for habit without recurrence pattern', () => {
        const data = {
            ...validTaskData,
            type: 'habit' as const,
            recurrencePattern: undefined
        };

        expect(() => validateTaskCreation(data as any)).toThrow(ValidationError);
        expect(() => validateTaskCreation(data as any)).toThrow('Recurrence pattern is required');
    });

    it('should pass for valid habit with recurrence', () => {
        const data = {
            ...validTaskData,
            type: 'habit' as const,
            recurrencePattern: 'Daily' as const
        };

        expect(() => validateTaskCreation(data)).not.toThrow();
    });
});
