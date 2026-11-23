import { describe, it, expect } from 'vitest';
import { format, isToday, addDays } from 'date-fns';
import { endOfToday, dueDateDisablesSubmit } from '@/lib/dateUtils';

/**
 * L4d acceptance-suite finding (run 26): TaskForm defaulted the due date to
 * `new Date()` (the creation moment) while the submit button disables on
 * `dueDate < now`. Any user who took more than a few seconds to fill the form
 * hit a permanently disabled Create Task button. The default is now
 * end-of-today (23:59:59.999 local), so "Today" stays valid until midnight.
 *
 * These tests import the REAL helpers from src/lib/dateUtils.ts — the same
 * module TaskForm uses — so a regression in the component's helper or the
 * disabled semantics cannot pass silently.
 */
describe('TaskForm default due date (L4d finding)', () => {
  it('default due date is end of today (23:59:59.999), not the creation moment', () => {
    const d = endOfToday();
    expect(format(d, 'HH:mm')).toBe('23:59');
    expect(isToday(d)).toBe(true);
    // creation-moment default would be within the same second
    expect(Math.abs(d.getTime() - Date.now())).toBeGreaterThan(1000);
  });

  it('submit stays enabled after a 30-second form fill (the regression case)', () => {
    const dueDate = endOfToday();
    const afterTyping = Date.now() + 30_000;
    expect(dueDateDisablesSubmit(dueDate, afterTyping)).toBe(false);
  });

  it('old behavior would disable the button within the same second (guards the fix)', () => {
    const openedAt = Date.now();
    const oldDefault = new Date(openedAt); // the pre-fix default
    expect(dueDateDisablesSubmit(oldDefault, openedAt + 1_000)).toBe(true);
  });

  it('submit still disables for a genuinely past due date', () => {
    const yesterday = addDays(new Date(), -1);
    expect(dueDateDisablesSubmit(yesterday, Date.now())).toBe(true);
  });
});
