import type { Task } from '@/types';

/**
 * ============================================================================
 * Date Utilities - Centralized Date Handling Functions
 * ============================================================================
 *
 * Purpose:
 * - Single source of truth for all date operations
 * - Consistent timezone handling across the application
 * - Prevents date comparison bugs from inconsistent implementations
 *
 * Usage Pattern:
 * 1. Use normalizeToStartOfDay() for date comparisons
 * 2. Use isToday() for today checks
 * 3. Use isPastDue() for due date checks
 * 4. Use isDueToday() for task-specific today checks
 * ============================================================================
 */

/**
 * Normalize a date to the start of day (midnight)
 * This ensures consistent date comparisons by removing time component
 *
 * @param date - The date to normalize
 * @returns A new Date object set to midnight of the input date
 *
 * Example:
 * normalizeToStartOfDay(new Date('2026-01-21T15:30:00')) // 2026-01-21T00:00:00.000Z
 */
export function normalizeToStartOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Get today's date normalized to start of day
 * Useful for comparing if something happened today vs other dates
 *
 * @param timezone - Optional timezone to use (default: UTC)
 * @returns Today's date at midnight
 *
 * Example:
 * getTodayDate() // 2026-01-21T00:00:00.000Z
 * getTodayDate('America/New_York') // Today in NY timezone at midnight
 */
export function getTodayDate(timezone?: string): Date {
  if (timezone) {
    const now = new Date();
    const year = now.toLocaleString('en-US', { timeZone: timezone, year: 'numeric' });
    const month = now.toLocaleString('en-US', { timeZone: timezone, month: '2-digit' });
    const day = now.toLocaleString('en-US', { timeZone: timezone, day: '2-digit' });
    return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  }
  return normalizeToStartOfDay(new Date());
}

/**
 * Check if a date is today (normalized to start of day)
 *
 * @param date - The date to check
 * @returns True if the date is today, false otherwise
 *
 * Example:
 * isToday(new Date()) // true
 * isToday(new Date('2026-01-20')) // false (assuming today is 2026-01-21)
 */
export function isToday(date: Date): boolean {
  const today = getTodayDate();
  const checkDate = normalizeToStartOfDay(new Date(date));
  return checkDate.getTime() === today.getTime();
}

/**
 * Check if a date is past due (before today's start of day)
 *
 * @param date - The date to check
 * @returns True if date is before today, false otherwise
 *
 * Example:
 * isPastDue(new Date('2026-01-20')) // true (assuming today is 2026-01-21)
 * isPastDue(new Date()) // false
 * isPastDue(new Date('2026-01-22')) // false
 */
export function isPastDue(date: Date): boolean {
  const today = getTodayDate();
  const checkDate = normalizeToStartOfDay(new Date(date));
  return checkDate.getTime() < today.getTime();
}

/**
 * Check if a task is due today
 * Compares task's due date against today's date
 *
 * @param task - The task to check
 * @returns True if task is due today, false otherwise
 *
 * Example:
 * const task = { dueDate: '2026-01-21' };
 * isDueToday(task) // true (assuming today is 2026-01-21)
 */
export function isDueToday(task: Task): boolean {
  if (!task.dueDate) return false;
  return isToday(new Date(task.dueDate));
}

/**
 * Check if a task is past due (due date before today)
 *
 * @param task - The task to check
 * @returns True if task is past due, false otherwise
 *
 * Example:
 * const task = { dueDate: '2026-01-20' };
 * isPastDue(task) // true (assuming today is 2026-01-21)
 */
export function isTaskPastDue(task: Task): boolean {
  if (!task.dueDate) return false;
  return isPastDue(new Date(task.dueDate));
}

/**
 * Compare two dates to see if first is before or equal to second
 * Useful for due date and completion date comparisons
 *
 * @param date1 - First date (e.g., completion date)
 * @param date2 - Second date (e.g., due date)
 * @returns True if date1 <= date2 (on time or early), false otherwise
 *
 * Example:
 * isOnOrBeforeDueDate(new Date('2026-01-21'), new Date('2026-01-21')) // true
 * isOnOrBeforeDueDate(new Date('2026-01-21'), new Date('2026-01-20')) // true
 * isOnOrBeforeDueDate(new Date('2026-01-22'), new Date('2026-01-21')) // false
 */
export function isOnOrBeforeDueDate(date1: Date, date2: Date): boolean {
  const normalized1 = normalizeToStartOfDay(new Date(date1));
  const normalized2 = normalizeToStartOfDay(new Date(date2));
  return normalized1.getTime() <= normalized2.getTime();
}

/**
 * Get the end of day for a given date
 * Useful for checking if a task has expired by end of due date day
 *
 * @param date - The date
 * @returns The same date but with time set to 23:59:59.999
 *
 * Example:
 * getEndOfDay(new Date('2026-01-21T12:00:00')) // 2026-01-21T23:59:59.999Z
 */
export function getEndOfDay(date: Date): Date {
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay;
}
