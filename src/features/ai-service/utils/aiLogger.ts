// ============================================================================
// AI Logger - Centralized Logging for AI Service Interactions
// ============================================================================

const LOG_PREFIX = '[AI-Service]';

/**
 * Log levels with styling for browser console
 */
const LOG_STYLES = {
    info: 'color: #3b82f6; font-weight: bold;',
    error: 'color: #ef4444; font-weight: bold;',
    warn: 'color: #f59e0b; font-weight: bold;',
    success: 'color: #22c55e; font-weight: bold;',
};

/**
 * Centralized logger for AI service interactions.
 * Provides consistent formatting and optional data attachment.
 */
export const aiLogger = {
    /**
     * Log informational messages
     */
    info: (message: string, data?: object): void => {
        if (import.meta.env.DEV) {
            console.log(`%c${LOG_PREFIX}`, LOG_STYLES.info, message, data ?? '');
        }
    },

    /**
     * Log error messages with optional error object
     */
    error: (message: string, error?: Error | unknown, data?: object): void => {
        console.error(
            `%c${LOG_PREFIX}`,
            LOG_STYLES.error,
            message,
            error instanceof Error ? error.message : error,
            data ?? ''
        );
    },

    /**
     * Log warning messages
     */
    warn: (message: string, data?: object): void => {
        if (import.meta.env.DEV) {
            console.warn(`%c${LOG_PREFIX}`, LOG_STYLES.warn, message, data ?? '');
        }
    },

    /**
     * Log success messages
     */
    success: (message: string, data?: object): void => {
        if (import.meta.env.DEV) {
            console.log(`%c${LOG_PREFIX}`, LOG_STYLES.success, message, data ?? '');
        }
    },
};
