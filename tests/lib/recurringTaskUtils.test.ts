// ============================================================================
// Recurring Task Utilities Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
    calculateNextOccurrence,
    generateOccurrenceDates,
    getDefaultOccurrenceCount,
    getDefaultDurationDays,
} from '../../src/lib/tasks/recurringTaskUtils';

describe('calculateNextOccurrence', () => {
    it('should add 1 day for Daily pattern', () => {
        const date = new Date('2026-01-20');
        const result = calculateNextOccurrence(date, 'Daily');

        expect(result.getDate()).toBe(21);
    });

    it('should add 7 days for weekly pattern', () => {
        const date = new Date('2026-01-20');
        const result = calculateNextOccurrence(date, 'weekly');

        expect(result.getDate()).toBe(27);
    });

    it('should respect interval for Daily pattern', () => {
        const date = new Date('2026-01-20');
        const result = calculateNextOccurrence(date, 'Daily', 3);

        expect(result.getDate()).toBe(23);
    });
});

describe('generateOccurrenceDates', () => {
    it('should generate correct number of daily occurrences', () => {
        const startDate = new Date('2026-01-20');
        const result = generateOccurrenceDates(startDate, 'Daily', 1, 5);

        expect(result.length).toBe(5);
        expect(result[0].getDate()).toBe(20);
        expect(result[4].getDate()).toBe(24);
    });

    it('should stop at end date', () => {
        const startDate = new Date('2026-01-20');
        const endDate = new Date('2026-01-22');
        const result = generateOccurrenceDates(startDate, 'Daily', 1, 30, endDate);

        expect(result.length).toBe(3); // Jan 20, 21, 22
    });

    describe('Custom Recurrence', () => {
        it('should handle custom frequency (every 3 days)', () => {
            const startDate = new Date('2026-01-01');
            const result = generateOccurrenceDates(startDate, 'custom', 1, 3, undefined, {
                frequency: 'days',
                interval: 3,
                endType: 'count',
                occurrenceCount: 3
            });

            expect(result.length).toBe(3);
            expect(result[0].getDate()).toBe(1);
            expect(result[1].getDate()).toBe(4);
            expect(result[2].getDate()).toBe(7);
        });

        it('should handle custom frequency (every 2 weeks)', () => {
            const startDate = new Date('2026-01-01'); // Thursday
            const result = generateOccurrenceDates(startDate, 'custom', 1, 3, undefined, {
                frequency: 'weeks',
                interval: 2,
                endType: 'count',
                occurrenceCount: 3
            });

            expect(result.length).toBe(3);
            expect(result[0].getDate()).toBe(1);
            expect(result[1].getDate()).toBe(15);
            expect(result[2].getDate()).toBe(29);
        });

        it('should handle custom frequency (every 1 month) with rollover', () => {
            const startDate = new Date('2026-01-31');
            const result = generateOccurrenceDates(startDate, 'custom', 1, 3, undefined, {
                frequency: 'months',
                interval: 1,
                endType: 'count',
                occurrenceCount: 3
            });

            expect(result.length).toBe(3);
            // Jan 31
            expect(result[0].getMonth()).toBe(0);
            // Feb 28 (2026 is non-leap) - date-fns addMonths handles this correctly
            expect(result[1].getMonth()).toBe(1); // Feb
            expect(result[1].getDate()).toBe(28); // Snaps to last day of month
        });
    });

    describe('Edge Cases', () => {
        it('should handle leap year (Feb 29)', () => {
            const startDate = new Date('2024-02-28'); // 2024 is leap
            const result = generateOccurrenceDates(startDate, 'Daily', 1, 3);

            expect(result[0].getDate()).toBe(28);
            expect(result[1].getDate()).toBe(29);
            expect(result[2].getDate()).toBe(1); // Mar 1
            expect(result[2].getMonth()).toBe(2);
        });
    });
});

describe('getDefaultOccurrenceCount', () => {
    it('should return 30 for Daily', () => {
        expect(getDefaultOccurrenceCount('Daily')).toBe(30);
    });

    it('should return 5 for weekly', () => {
        expect(getDefaultOccurrenceCount('weekly')).toBe(5);
    });
});

describe('getDefaultDurationDays', () => {
    it('should return 30 for Daily', () => {
        expect(getDefaultDurationDays('Daily')).toBe(30);
    });

    it('should return 35 for weekly', () => {
        expect(getDefaultDurationDays('weekly')).toBe(35);
    });
});
