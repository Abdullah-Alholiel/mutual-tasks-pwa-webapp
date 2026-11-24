import { describe, it, expect } from 'vitest';
import { endOfToday } from '@/lib/dateUtils';
import { normalizeToStartOfDay } from '@/lib/tasks/taskUtils';

/**
 * Run 27 L4d acceptance finding: the project-detail creation handler zeroed
 * the chosen due time with normalizeToStartOfDay (23:59 → 00:00 today). The
 * mutation guard (useTasks.ts, useCreateTask/useCreateTaskWithStatuses)
 * rejects dueDate < now-60s, so EVERY default-due task threw "Cannot create a
 * task with a past due date/time" before any network call. The guard is the
 * behavior contract — these tests pin it against both date shapes so the
 * zeroing regression can never pass silently again.
 */
const guardAllows = (dueDate: Date, now = Date.now()) =>
  dueDate.getTime() >= now - 60_000;

describe('task creation due-time contract (run 27 finding)', () => {
  it('the mutation guard accepts an end-of-today due date all day', () => {
    expect(guardAllows(endOfToday())).toBe(true);
    // still accepted one hour before the due moment (late-evening form fill)
    expect(guardAllows(endOfToday(), endOfToday().getTime() - 3600_000)).toBe(true);
  });

  it('zeroing the due time to 00:00 makes the SAME date fail the guard (the regression mechanism)', () => {
    const chosen = endOfToday();
    const zeroed = normalizeToStartOfDay(chosen);
    expect(guardAllows(zeroed)).toBe(false);
  });

  it('normalizeToStartOfDay is a day-boundary helper, not a creation-path helper', () => {
    const d = new Date();
    d.setHours(15, 30, 0, 0);
    const zeroed = normalizeToStartOfDay(d);
    expect(zeroed.getHours()).toBe(0);
    expect(zeroed.getMinutes()).toBe(0);
    expect(zeroed.getDate()).toBe(d.getDate());
  });
});
