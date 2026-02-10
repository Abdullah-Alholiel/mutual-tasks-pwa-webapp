// ============================================================================
// Task Utilities Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
    calculateTaskStatusUserStatus,
    normalizeToStartOfDay,
    canCompleteTask,
    canRecoverTask,
    getStatusBadgeVariant,
} from '../../src/lib/tasks/taskUtils';
import type { TaskStatusEntity, Task, CompletionLog } from '../../src/types';

describe('normalizeToStartOfDay', () => {
    it('should set time to 00:00:00.000', () => {
        const date = new Date('2026-01-20T14:30:00.000Z');
        const result = normalizeToStartOfDay(date);

        expect(result.getHours()).toBe(0);
        expect(result.getMinutes()).toBe(0);
        expect(result.getSeconds()).toBe(0);
        expect(result.getMilliseconds()).toBe(0);
    });

    it('should preserve the date', () => {
        const date = new Date('2026-01-20T14:30:00.000Z');
        const result = normalizeToStartOfDay(date);

        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(0); // January is 0
        expect(result.getDate()).toBe(20);
    });
});

describe('calculateTaskStatusUserStatus', () => {
    it('should return completed if completion log exists', () => {
        const task = {
            id: 1,
            dueDate: new Date(),
        } as Task;
        const completionLog = {} as CompletionLog;

        const result = calculateTaskStatusUserStatus(undefined, completionLog, task);

        expect(result).toBe('completed');
    });

    it('should return upcoming for future tasks', () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const task = {
            id: 1,
            dueDate: tomorrow,
        } as Task;

        const taskStatus = {
            id: 1,
            taskId: 1,
            userId: 1,
            status: 'upcoming' as const,
        } as TaskStatusEntity;

        const result = calculateTaskStatusUserStatus(taskStatus, undefined, task);

        expect(result).toBe('upcoming');
    });

    it('should return active for today future tasks', () => {
        const laterToday = new Date();
        laterToday.setHours(laterToday.getHours() + 1);

        const task = {
            id: 1,
            dueDate: laterToday,
        } as Task;

        const taskStatus = {
            id: 1,
            taskId: 1,
            userId: 1,
            status: 'active' as const,
        } as TaskStatusEntity;

        const result = calculateTaskStatusUserStatus(taskStatus, undefined, task);

        expect(result).toBe('active');
    });

    it('should return archived for today past due tasks', () => {
        const earlierToday = new Date();
        earlierToday.setHours(earlierToday.getHours() - 1);

        const task = {
            id: 1,
            dueDate: earlierToday,
        } as Task;

        const taskStatus = {
            id: 1,
            taskId: 1,
            userId: 1,
            status: 'active' as const,
        } as TaskStatusEntity;

        const result = calculateTaskStatusUserStatus(taskStatus, undefined, task);

        expect(result).toBe('archived');
    });

    it('should return archived for past due tasks without completion', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const task = {
            id: 1,
            dueDate: yesterday,
        } as Task;

        const taskStatus = {
            id: 1,
            taskId: 1,
            userId: 1,
            status: 'active' as const,
        } as TaskStatusEntity;

        const result = calculateTaskStatusUserStatus(taskStatus, undefined, task);

        expect(result).toBe('archived');
    });

    it('should return recovered for recovered tasks', () => {
        const task = {
            id: 1,
            dueDate: new Date(),
        } as Task;

        const taskStatus = {
            id: 1,
            taskId: 1,
            userId: 1,
            status: 'recovered' as const,
            recoveredAt: new Date(),
        } as TaskStatusEntity;

        const result = calculateTaskStatusUserStatus(taskStatus, undefined, task);

        expect(result).toBe('recovered');
    });
});

describe('canCompleteTask', () => {
    it('should allow completion for active tasks', () => {
        const laterToday = new Date();
        laterToday.setHours(laterToday.getHours() + 1);

        const task = { dueDate: laterToday } as Task;
        const taskStatus = { status: 'active' as const } as TaskStatusEntity;

        const result = canCompleteTask(taskStatus, undefined, task);

        expect(result).toBe(true);
    });

    it('should allow completion for recovered tasks', () => {
        const task = { dueDate: new Date() } as Task;
        const taskStatus = {
            status: 'recovered' as const,
            recoveredAt: new Date(),
        } as TaskStatusEntity;

        const result = canCompleteTask(taskStatus, undefined, task);

        expect(result).toBe(true);
    });

    it('should not allow completion for already completed tasks', () => {
        const task = { dueDate: new Date() } as Task;
        const taskStatus = { status: 'active' as const } as TaskStatusEntity;
        const completionLog = {} as CompletionLog;

        const result = canCompleteTask(taskStatus, completionLog, task);

        expect(result).toBe(false);
    });
});

describe('canRecoverTask', () => {
    it('should allow recovery for archived tasks', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const task = { dueDate: yesterday } as Task;
        const taskStatus = {
            status: 'archived' as const,
            archivedAt: new Date(),
        } as TaskStatusEntity;

        const result = canRecoverTask(taskStatus, undefined, task);

        expect(result).toBe(true);
    });

    it('should not allow recovery for already recovered tasks', () => {
        const task = { dueDate: new Date() } as Task;
        const taskStatus = {
            status: 'recovered' as const,
            recoveredAt: new Date(),
        } as TaskStatusEntity;

        const result = canRecoverTask(taskStatus, undefined, task);

        expect(result).toBe(false);
    });
});

describe('getStatusBadgeVariant', () => {
    it('should return correct variants for each status', () => {
        // active returns 'secondary', completed returns 'default'
        expect(getStatusBadgeVariant('active')).toBe('secondary');
        expect(getStatusBadgeVariant('completed')).toBe('default');
        expect(getStatusBadgeVariant('archived')).toBe('outline');
    });
});
