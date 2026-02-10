// ============================================================================
// Date-Time Utilities - Time-Aware Date Handling
// ============================================================================
//
// This module provides utilities for handling dates with time components.
// It supports timezone-aware operations and consistent formatting across the app.
// ============================================================================

import { format, isToday, isTomorrow, isPast } from 'date-fns';

/**
 * Check if a date has a meaningful time component (not midnight)
 *
 * @param date - The date to check
 * @returns True if the date has a time component other than 00:00:00
 */
export const hasTimeComponent = (date: Date): boolean => {
    return date.getHours() !== 0 ||
        date.getMinutes() !== 0 ||
        date.getSeconds() !== 0 ||
        date.getMilliseconds() !== 0;
};

/**
 * Format a date-time for display
 *
 * Rules:
 * - "Today" if due today with no time component
 * - "Today at 3:00 PM" if due today with time component
 * - "Tomorrow" if due tomorrow with no time component
 * - "Tomorrow at 9:00 AM" if due tomorrow with time component
 * - "Jan 15" if due on other date with no time component
 * - "Jan 15 at 2:00 PM" if due on other date with time component
 *
 * @param dateTime - The date-time to format
 * @param userTimezone - Optional user timezone string (e.g., 'America/New_York')
 * @returns Formatted date-time string
 */
export const formatDueDateTime = (
    dateTime: Date,
    alwaysShowTime: boolean = false
): string => {
    const hasTime = alwaysShowTime || hasTimeComponent(dateTime);

    // Use date-fns for consistent formatting
    if (isToday(dateTime)) {
        return hasTime
            ? `Today at ${format(dateTime, 'h:mm a')}`
            : 'Today';
    }

    if (isTomorrow(dateTime)) {
        return hasTime
            ? `Tomorrow at ${format(dateTime, 'h:mm a')}`
            : 'Tomorrow';
    }

    // For other dates, show abbreviated month and day
    const datePart = format(dateTime, 'MMM d');
    return hasTime
        ? `${datePart} at ${format(dateTime, 'h:mm a')}`
        : datePart;
};

/**
 * Format a date-time for compact display (e.g., in task cards)
 *
 * Similar to formatDueDateTime but more concise:
 * - "Today" or "Today 3PM"
 * - "Tomorrow" or "Tomorrow 9AM"
 * - "Jan 15" or "Jan 15 2PM"
 *
 * @param dateTime - The date-time to format
 * @param userTimezone - Optional user timezone string
 * @returns Formatted compact date-time string
 */
export const formatDueDateTimeCompact = (
    dateTime: Date,
    alwaysShowTime: boolean = false
): string => {
    const hasTime = alwaysShowTime || hasTimeComponent(dateTime);

    if (isToday(dateTime)) {
        return hasTime
            ? `Today ${format(dateTime, 'h:mm a')}`
            : 'Today';
    }

    if (isTomorrow(dateTime)) {
        return hasTime
            ? `Tomorrow ${format(dateTime, 'h:mm a')}`
            : 'Tomorrow';
    }

    const datePart = format(dateTime, 'MMM d');
    return hasTime
        ? `${datePart} ${format(dateTime, 'h:mm a')}`
        : datePart;
};

/**
 * Check if a date-time is past due (considering time)
 *
 * @param dueDateTime - The due date-time
 * @param now - Current date-time (defaults to new Date())
 * @returns True if the due date-time has passed
 */
export const isPastDue = (
    dueDateTime: Date,
    now: Date = new Date()
): boolean => {
    return dueDateTime.getTime() < now.getTime();
};

/**
 * Check if a date-time is in the future
 *
 * @param dateTime - The date-time to check
 * @param now - Current date-time (defaults to new Date())
 * @returns True if the date-time is in the future
 */
export const isFuture = (
    dateTime: Date,
    now: Date = new Date()
): boolean => {
    return dateTime.getTime() > now.getTime();
};

/**
 * Check if a date-time is due today (date only, ignoring time)
 *
 * @param dateTime - The date-time to check
 * @param now - Current date-time (defaults to new Date())
 * @returns True if the date is today
 */
export const isDueToday = (
    dateTime: Date,
    now: Date = new Date()
): boolean => {
    const dateTimeOnly = new Date(dateTime);
    dateTimeOnly.setHours(0, 0, 0, 0);

    const nowOnly = new Date(now);
    nowOnly.setHours(0, 0, 0, 0);

    return dateTimeOnly.getTime() === nowOnly.getTime();
};

/**
 * Check if a date-time is due tomorrow (date only, ignoring time)
 *
 * @param dateTime - The date-time to check
 * @param now - Current date-time (defaults to new Date())
 * @returns True if the date is tomorrow
 */
export const isDueTomorrow = (
    dateTime: Date,
    now: Date = new Date()
): boolean => {
    const dateTimeOnly = new Date(dateTime);
    dateTimeOnly.setHours(0, 0, 0, 0);

    const tomorrowOnly = new Date(now);
    tomorrowOnly.setDate(tomorrowOnly.getDate() + 1);
    tomorrowOnly.setHours(0, 0, 0, 0);

    return dateTimeOnly.getTime() === tomorrowOnly.getTime();
};

/**
 * Normalize a date to start of day (00:00:00.000)
 * Used for legacy date-only comparisons
 *
 * @param date - The date to normalize
 * @returns Normalized date at start of day
 */
export const normalizeToStartOfDay = (date: Date): Date => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
};

/**
 * Normalize a date to end of day (23:59:59.999)
 * Used for checking if something is still valid for the day
 *
 * @param date - The date to normalize
 * @returns Normalized date at end of day
 */
export const normalizeToEndOfDay = (date: Date): Date => {
    const normalized = new Date(date);
    normalized.setHours(23, 59, 59, 999);
    return normalized;
};

/**
 * Parse a time string (HH:MM) to hours and minutes
 *
 * @param timeString - Time string in "HH:MM" format
 * @returns Object with hours and minutes, or null if invalid
 */
export const parseTimeString = (timeString: string): { hours: number; minutes: number } | null => {
    const match = timeString.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return null;
    }

    return { hours, minutes };
};

/**
 * Format hours and minutes to a time string (HH:MM)
 *
 * @param hours - Hours (0-23)
 * @param minutes - Minutes (0-59)
 * @returns Time string in "HH:MM" format
 */
export const formatTimeString = (hours: number, minutes: number): string => {
    const h = Math.max(0, Math.min(23, hours));
    const m = Math.max(0, Math.min(59, minutes));
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

/**
 * Combine a date and time string into a single Date object
 *
 * @param date - The base date
 * @param timeString - Time string in "HH:MM" format
 * @returns Combined Date object
 */
export const combineDateTime = (date: Date, timeString: string): Date => {
    const parsed = parseTimeString(timeString);
    if (!parsed) {
        // If invalid time, use midnight
        return normalizeToStartOfDay(date);
    }

    const combined = new Date(date);
    combined.setHours(parsed.hours, parsed.minutes, 0, 0);
    return combined;
};

/**
 * Get time string from a Date object (HH:MM)
 *
 * @param date - The date object
 * @returns Time string in "HH:MM" format
 */
export const getTimeStringFromDate = (date: Date): string => {
    return formatTimeString(date.getHours(), date.getMinutes());
};

/**
 * Format a date-time for input fields (datetime-local)
 *
 * @param date - The date to format
 * @returns String in "YYYY-MM-DDTHH:MM" format
 */
export const formatForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Parse a datetime-local input string to Date object
 *
 * @param inputString - String in "YYYY-MM-DDTHH:MM" format
 * @returns Date object
 */
export const parseFromInput = (inputString: string): Date => {
    return new Date(inputString);
};

/**
 * Get relative time description (e.g., "in 2 hours", "3 days ago")
 *
 * @param dateTime - The date-time to describe
 * @param now - Current date-time (defaults to new Date())
 * @returns Relative time description
 */
export const getRelativeTimeDescription = (
    dateTime: Date,
    now: Date = new Date()
): string => {
    const diffMs = dateTime.getTime() - now.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < -1) {
        return `${Math.abs(diffMinutes)} min ago`;
    }
    if (diffMinutes === -1) {
        return '1 min ago';
    }
    if (diffMinutes < 1) {
        return 'Just now';
    }
    if (diffMinutes < 60) {
        return `in ${diffMinutes} min`;
    }
    if (diffHours < -1) {
        return `${Math.abs(diffHours)} hr ago`;
    }
    if (diffHours === -1) {
        return '1 hr ago';
    }
    if (diffHours < 24) {
        return `in ${diffHours} hr`;
    }
    if (diffDays < -1) {
        return `${Math.abs(diffDays)} days ago`;
    }
    if (diffDays === -1) {
        return '1 day ago';
    }
    if (diffDays < 7) {
        return `in ${diffDays} days`;
    }

    // For dates further than a week, use the standard format
    return formatDueDateTime(dateTime);
};

/**
 * Check if two dates are the same day (ignoring time)
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns True if both dates are on the same day
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    return d1.getTime() === d2.getTime();
};

/**
 * Get the end of the day for a given date (23:59:59.999)
 *
 * @param date - The date
 * @returns Date object set to end of day
 */
export const getEndOfDay = (date: Date): Date => {
    return normalizeToEndOfDay(date);
};

/**
 * Get the start of the day for a given date (00:00:00.000)
 *
 * @param date - The date
 * @returns Date object set to start of day
 */
export const getStartOfDay = (date: Date): Date => {
    return normalizeToStartOfDay(date);
};
