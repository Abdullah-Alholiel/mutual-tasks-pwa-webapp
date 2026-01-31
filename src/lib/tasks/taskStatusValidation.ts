// ============================================================================
// Task Status Validation - Data Consistency Validation
// ============================================================================
//
// This file provides centralized validation utilities for ensuring data
// consistency between task statuses and completion logs. Use these utilities
// for defensive checks across components.
//
// OPTIMIZATION: Warnings are deduplicated per session to prevent console spam.
// Each unique task/user/issue combination is only logged once.
// ============================================================================

import type { TaskStatusEntity, CompletionLog, RingColor } from '@/types';
import { normalizeId } from '../idUtils';
import { normalizeToStartOfDay } from './taskUtils';

/**
 * Session-level cache to prevent duplicate warnings for the same issue.
 * Key format: `${taskId}-${userId}-${issueType}`
 * This prevents console spam while still catching unique issues.
 */
const sessionIssueCache = new Set<string>();

/**
 * Check if an issue has already been logged this session
 */
const hasLoggedIssue = (taskId: number, userId: number, issueType: string): boolean => {
    const key = `${taskId}-${userId}-${issueType}`;
    return sessionIssueCache.has(key);
};

/**
 * Mark an issue as logged for this session
 */
const markIssueLogged = (taskId: number, userId: number, issueType: string): void => {
    const key = `${taskId}-${userId}-${issueType}`;
    sessionIssueCache.add(key);
};

/**
 * Clear all cached issues (useful for testing or manual reset)
 */
export const clearValidationCache = (): void => {
    sessionIssueCache.clear();
};

/**
 * Result of a validation check
 */
export interface ValidationResult {
    isValid: boolean;
    issues: ValidationIssue[];
}

/**
 * Describes a specific validation issue found
 */
export interface ValidationIssue {
    type: 'MISSING_COMPLETION_LOG' | 'COMPLETION_LOG_WITHOUT_STATUS' | 'RING_COLOR_MISMATCH';
    taskId: number;
    userId: number;
    details: Record<string, unknown>;
}

/**
 * Calculate the expected ring color for a COMPLETED task based on completion timing
 *
 * NOTE: This is different from `calculateRingColor` in taskUtils.ts:
 * - `calculateRingColor` → Determines what color to DISPLAY for UI (handles all live states)
 * - `calculateExpectedRingColor` → Determines what color SHOULD HAVE BEEN STORED for validation
 *
 * This function only applies to completed tasks and validates persisted ringColor.
 *
 * Rules (in priority order):
 * - Red: archived task (archivedAt exists) - takes precedence over all
 * - Yellow: recovered task (recoveredAt exists, not archived)
 * - Green: on-time completion (before or on due date, not recovered, not archived)
 * - None: late completion (after due date, not recovered, not archived)
 *
 * IMPORTANT: A task can have archivedAt set AND be completed.
 * In this case, archivedAt takes precedence and ring should be red.
 * The task status remains 'completed' but shows red until recovery or manual update.
 *
 * @param completionDate - When the task was completed
 * @param dueDate - When the task was due
 * @param recoveredAt - Optional recovery timestamp
 * @param archivedAt - Optional archived timestamp
 * @returns Expected ring color value for validation
 */
export const calculateExpectedRingColor = (
    completionDate: Date,
    dueDate: Date,
    recoveredAt?: Date,
    archivedAt?: Date
): RingColor => {
    // Priority 1: Archived tasks should have red ring
    if (archivedAt && archivedAt !== null) {
        return 'red';
    }

    // Priority 2: Recovered tasks get yellow
    if (recoveredAt) {
        return 'yellow';
    }

    // Priority 3: On-time completion
    const normalizedCompletion = normalizeToStartOfDay(new Date(completionDate));
    const normalizedDue = normalizeToStartOfDay(new Date(dueDate));

    if (normalizedCompletion.getTime() <= normalizedDue.getTime()) {
        return 'green';
    }

    // Priority 4: Late completion
    return 'none';
};

/**
 * Validate consistency between task status and completion logs
 * 
 * Checks for these inconsistencies:
 * - completed status without completion log
 * - completion log exists but status is not completed (except recovered)
 * - ring color doesn't match completion timing
 * - archived status with completion log (should not happen)
 * 
 * Valid State Transitions:
 * - archived → recovered → completed (valid flow via recovery)
 * - active/upcoming → completed (valid direct completion)
 * - recovered + completionLog is VALID (transition in progress)
 * 
 * @param taskStatus - The task status entity to validate
 * @param completionLog - The completion log for this user (if any)
 * @param taskDueDate - The task's due date
 * @returns Validation result with any issues found
 */
export const validateTaskStatusConsistency = (
    taskStatus: TaskStatusEntity,
    completionLog: CompletionLog | undefined,
    taskDueDate: Date
): ValidationResult => {
    const issues: ValidationIssue[] = [];
    const { status, ringColor, recoveredAt } = taskStatus;
    const taskId = normalizeId(taskStatus.taskId);
    const userId = normalizeId(taskStatus.userId);

    switch (status) {
        case 'completed':
            if (!completionLog) {
                issues.push({
                    type: 'MISSING_COMPLETION_LOG',
                    taskId,
                    userId,
                    details: { status, ringColor }
                });
            } else {
                // Validate that ring color matches completion timing
                const expectedColor = calculateExpectedRingColor(
                    completionLog.createdAt,
                    taskDueDate,
                    recoveredAt,
                    taskStatus.archivedAt
                );
                
                if (ringColor !== expectedColor) {
                    issues.push({
                        type: 'RING_COLOR_MISMATCH',
                        taskId,
                        userId,
                        details: {
                            actual: ringColor,
                            expected: expectedColor,
                            issue: `Ring color should be '${expectedColor}' based on completion timing`,
                            completionDate: completionLog.createdAt,
                            dueDate: taskDueDate,
                            recoveredAt
                        }
                    });
                }
            }
            break;

        case 'active':
        case 'upcoming':
            // Active/upcoming should NOT have completion logs
            if (completionLog) {
                issues.push({
                    type: 'COMPLETION_LOG_WITHOUT_STATUS',
                    taskId,
                    userId,
                    details: { status, completionLogId: completionLog.id }
                });
            }
            break;

        case 'recovered':
            // Recovered tasks CAN have completion logs (valid: recovered → completed transition)
            // The completion log is created first, then status updates to 'completed'
            // This is intentionally NOT flagged as an error
            break;

        case 'archived':
            // Archived tasks should NOT have completion logs
            if (completionLog) {
                issues.push({
                    type: 'COMPLETION_LOG_WITHOUT_STATUS',
                    taskId,
                    userId,
                    details: { status: 'archived-with-completion-log', completionLogId: completionLog.id }
                });
            }
            break;
    }

    return { isValid: issues.length === 0, issues };
};

/**
 * Convenience function to validate and log issues for a task
 * Used by components for defensive consistency checks
 * 
 * @param taskStatus - The task status entity to validate
 * @param completionLog - The completion log for this user (if any)
 * @param taskDueDate - The task's due date
 * @param context - Logging context (e.g., component name)
 */
export const validateAndLogIssues = (
    taskStatus: TaskStatusEntity,
    completionLog: CompletionLog | undefined,
    taskDueDate: Date,
    context: string
): void => {
    // Skip in production
    if (process.env.NODE_ENV !== 'development') return;

    const result = validateTaskStatusConsistency(taskStatus, completionLog, taskDueDate);
    if (result.issues.length === 0) return;

    const taskId = normalizeId(taskStatus.taskId);
    const userId = normalizeId(taskStatus.userId);

    result.issues.forEach(issue => {
        // Deduplicate: Only log each unique issue once per session
        if (hasLoggedIssue(taskId, userId, issue.type)) return;
        markIssueLogged(taskId, userId, issue.type);

        // Use console.debug to reduce noise - these are data integrity checks
        // that are useful for debugging but shouldn't clutter normal development
        console.debug(`[${context}] Data inconsistency - ${issue.type}:`, {
            taskId,
            userId,
            ...issue,
            taskStatus: taskStatus.status,
            taskRingColor: taskStatus.ringColor,
            recoveredAt: taskStatus.recoveredAt,
            completionLogId: completionLog?.id,
            completionCreatedAt: completionLog?.createdAt,
            taskDueDate: taskDueDate.toISOString()
        });
    });
};
