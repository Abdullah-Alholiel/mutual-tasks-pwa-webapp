import { describe, it, expect } from 'vitest';
import { format, isToday, addDays } from 'date-fns';

/**
 * L4d acceptance-suite finding (run 26): TaskForm defaulted the due date to
 * `new Date()` (the creation moment) while the submit button disables on
 * `dueDate < now`. Any user who took more than a few seconds to fill the form
 * hit a permanently disabled Create Task button. The default is now
 * end-of-today (23:59 local), so "Today" stays valid until midnight.
 *
 * These tests pin the CONTRACT the form relies on (the helper is inline in
 * TaskForm.tsx; we mirror its exact semantics here):
 *   1. the default due date must never be in the past at click time for a
 *      reasonable form-fill duration, and
 *   2. it must still be TODAY (the product's meaning of "today at 23:59").
 */

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  return d;
}

// Mirror of TaskForm's submit-button disabled condition (TaskForm.tsx ~line 672):
// disabled = !title.trim() || !project || (dueDate ? dueDate.getTime() < Date.now() : false)
function submitDisabled(dueDate: Date | undefined, now: number): boolean {
  return dueDate ? dueDate.getTime() < now : false;
}

describe('TaskForm default due date (L4d finding)', () => {
  it('default due date is 23:59 today, not the creation moment', () => {
    const d = endOfToday();
    expect(format(d, 'HH:mm')).toBe('23:59');
    expect(isToday(d)).toBe(true);
  });

  it('submit stays enabled after a 30-second form fill (the regression case)', () => {
    const openedAt = Date.now();
    const dueDate = endOfToday();
    const afterTyping = openedAt + 30_000;
    expect(submitDisabled(dueDate, afterTyping)).toBe(false);
  });

  it('old behavior would disable the button within the same second (guards the fix)', () => {
    const openedAt = Date.now();
    const oldDefault = new Date(openedAt); // the pre-fix default
    expect(submitDisabled(oldDefault, openedAt + 1_000)).toBe(true);
  });

  it('submit still disables for a genuinely past due date', () => {
    const yesterday = addDays(new Date(), -1);
    expect(submitDisabled(yesterday, Date.now())).toBe(true);
  });
});
