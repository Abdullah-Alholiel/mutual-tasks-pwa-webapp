// ============================================================================
// Task Status Validation Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
    validateTaskStatusConsistency,
    calculateExpectedRingColor,
    type ValidationResult
} from '../../src/lib/tasks/taskStatusValidation';
import type { TaskStatusEntity, CompletionLog } from '../../src/types';

describe('calculateExpectedRingColor', () => {
    it('should return green for on-time completion', () => {
        const completionDate = new Date('2026-01-20');
        const dueDate = new Date('2026-01-20');

        const result = calculateExpectedRingColor(completionDate, dueDate);

        expect(result).toBe('green');
    });

    it('should return green for early completion', () => {
        const completionDate = new Date('2026-01-19');
        const dueDate = new Date('2026-01-20');

        const result = calculateExpectedRingColor(completionDate, dueDate);

        expect(result).toBe('green');
    });

    it('should return none for late completion', () => {
        const completionDate = new Date('2026-01-21');
        const dueDate = new Date('2026-01-20');

        const result = calculateExpectedRingColor(completionDate, dueDate);

        expect(result).toBe('none');
    });

    it('should return yellow for recovered task', () => {
        const completionDate = new Date('2026-01-21');
        const dueDate = new Date('2026-01-20');
        const recoveredAt = new Date('2026-01-21');

        const result = calculateExpectedRingColor(completionDate, dueDate, recoveredAt);

        expect(result).toBe('yellow');
    });
});

describe('validateTaskStatusConsistency', () => {
    describe('completed status', () => {
        it('should flag MISSING_COMPLETION_LOG when completed without log', () => {
            const taskStatus = {
                id: 1,
                taskId: 1,
                userId: 1,
                status: 'completed' as const,
                ringColor: 'green' as const
            } as TaskStatusEntity;
            const dueDate = new Date('2026-01-20');

            const result = validateTaskStatusConsistency(taskStatus, undefined, dueDate);

            expect(result.isValid).toBe(false);
            expect(result.issues).toHaveLength(1);
            expect(result.issues[0].type).toBe('MISSING_COMPLETION_LOG');
        });

        it('should pass for completed with matching completion log', () => {
            const taskStatus = {
                id: 1,
                taskId: 1,
                userId: 1,
                status: 'completed' as const,
                ringColor: 'green' as const
            } as TaskStatusEntity;
            const completionLog = {
                id: 1,
                taskId: 1,
                userId: 1,
                createdAt: new Date('2026-01-20')
            } as CompletionLog;
            const dueDate = new Date('2026-01-20');

            const result = validateTaskStatusConsistency(taskStatus, completionLog, dueDate);

            expect(result.isValid).toBe(true);
            expect(result.issues).toHaveLength(0);
        });

        it('should flag RING_COLOR_MISMATCH when ring color is wrong', () => {
            const taskStatus = {
                id: 1,
                taskId: 1,
                userId: 1,
                status: 'completed' as const,
                ringColor: 'green' as const // Should be 'none' for late completion
            } as TaskStatusEntity;
            const completionLog = {
                id: 1,
                taskId: 1,
                userId: 1,
                createdAt: new Date('2026-01-21') // Late
            } as CompletionLog;
            const dueDate = new Date('2026-01-20');

            const result = validateTaskStatusConsistency(taskStatus, completionLog, dueDate);

            expect(result.isValid).toBe(false);
            expect(result.issues).toHaveLength(1);
            expect(result.issues[0].type).toBe('RING_COLOR_MISMATCH');
        });
    });

    describe('active/upcoming status', () => {
        it('should flag COMPLETION_LOG_WITHOUT_STATUS for active with log', () => {
            const taskStatus = {
                id: 1,
                taskId: 1,
                userId: 1,
                status: 'active' as const
            } as TaskStatusEntity;
            const completionLog = {
                id: 1,
                taskId: 1,
                userId: 1,
                createdAt: new Date()
            } as CompletionLog;
            const dueDate = new Date();

            const result = validateTaskStatusConsistency(taskStatus, completionLog, dueDate);

            expect(result.isValid).toBe(false);
            expect(result.issues).toHaveLength(1);
            expect(result.issues[0].type).toBe('COMPLETION_LOG_WITHOUT_STATUS');
        });

        it('should pass for active without log', () => {
            const taskStatus = {
                id: 1,
                taskId: 1,
                userId: 1,
                status: 'active' as const
            } as TaskStatusEntity;
            const dueDate = new Date();

            const result = validateTaskStatusConsistency(taskStatus, undefined, dueDate);

            expect(result.isValid).toBe(true);
            expect(result.issues).toHaveLength(0);
        });
    });

    describe('recovered status', () => {
        it('should pass for recovered WITH completion log (valid transition)', () => {
            // This is a valid state: recovered → completed transition in progress
            const taskStatus = {
                id: 1,
                taskId: 1,
                userId: 1,
                status: 'recovered' as const,
                recoveredAt: new Date()
            } as TaskStatusEntity;
            const completionLog = {
                id: 1,
                taskId: 1,
                userId: 1,
                createdAt: new Date()
            } as CompletionLog;
            const dueDate = new Date();

            const result = validateTaskStatusConsistency(taskStatus, completionLog, dueDate);

            expect(result.isValid).toBe(true);
            expect(result.issues).toHaveLength(0);
        });

        it('should pass for recovered without log', () => {
            const taskStatus = {
                id: 1,
                taskId: 1,
                userId: 1,
                status: 'recovered' as const,
                recoveredAt: new Date()
            } as TaskStatusEntity;
            const dueDate = new Date();

            const result = validateTaskStatusConsistency(taskStatus, undefined, dueDate);

            expect(result.isValid).toBe(true);
            expect(result.issues).toHaveLength(0);
        });
    });

    describe('archived status', () => {
        it('should flag COMPLETION_LOG_WITHOUT_STATUS for archived with log', () => {
            const taskStatus = {
                id: 1,
                taskId: 1,
                userId: 1,
                status: 'archived' as const
            } as TaskStatusEntity;
            const completionLog = {
                id: 1,
                taskId: 1,
                userId: 1,
                createdAt: new Date()
            } as CompletionLog;
            const dueDate = new Date();

            const result = validateTaskStatusConsistency(taskStatus, completionLog, dueDate);

            expect(result.isValid).toBe(false);
            expect(result.issues).toHaveLength(1);
            expect(result.issues[0].type).toBe('COMPLETION_LOG_WITHOUT_STATUS');
        });

        it('should pass for archived without log', () => {
            const taskStatus = {
                id: 1,
                taskId: 1,
                userId: 1,
                status: 'archived' as const
            } as TaskStatusEntity;
            const dueDate = new Date();

            const result = validateTaskStatusConsistency(taskStatus, undefined, dueDate);

            expect(result.isValid).toBe(true);
            expect(result.issues).toHaveLength(0);
        });
    });
});
