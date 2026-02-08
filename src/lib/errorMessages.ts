// ============================================================================
// AI Error Messages - Centralized Error Handling for AI Features
// ============================================================================

/**
 * Tailored error messages for different AI service failure scenarios
 */
export const AI_ERROR_MESSAGES = {
    // Rate Limit Errors
    LIMIT_EXCEEDED_PROJECT: {
        title: 'Daily Limit Reached',
        description: "You've used all 3 AI project generations for today. Try again tomorrow!",
    },
    LIMIT_EXCEEDED_DESCRIPTION: {
        title: 'Daily Limit Reached',
        description: "You've used all 10 AI description generations for today. Try again tomorrow!",
    },
    LIMIT_WARNING_PROJECT: (remaining: number) => ({
        title: 'Limited Uses Remaining',
        description: `You have ${remaining} AI project generation${remaining === 1 ? '' : 's'} left today.`,
    }),
    LIMIT_WARNING_DESCRIPTION: (remaining: number) => ({
        title: 'Limited Uses Remaining',
        description: `You have ${remaining} AI description generation${remaining === 1 ? '' : 's'} left today.`,
    }),

    // Server/AI Service Errors
    SERVER_DOWN: {
        title: 'AI Service Unavailable',
        description: 'Our AI is taking a short break. Please try again in a few minutes.',
    },
    SERVER_OVERLOADED: {
        title: 'AI Service Busy',
        description: 'High demand right now. Please wait a moment and try again.',
    },
    SERVER_ERROR: {
        title: 'AI Generation Failed',
        description: 'Something went wrong with the AI service. Please try again.',
    },
    SERVER_MAINTENANCE: {
        title: 'Service Maintenance',
        description: 'AI service is undergoing maintenance. Please try again later.',
    },

    // Network/Connection Errors
    NETWORK_ERROR: {
        title: 'Connection Issue',
        description: 'Unable to reach the AI service. Please check your internet connection.',
    },
    OFFLINE: {
        title: 'You\'re Offline',
        description: 'No internet connection detected. Please connect and try again.',
    },
    TIMEOUT: {
        title: 'Taking Too Long',
        description: 'The AI is being slow right now. Please tap try again!',
    },
    CONNECTION_REFUSED: {
        title: 'Service Unreachable',
        description: 'Could not connect to the AI service. Please try again later.',
    },

    // Database Errors
    DATABASE_ERROR: {
        title: 'Database Error',
        description: 'Failed to save your data. Please try again in a moment.',
    },
    DATABASE_UNAVAILABLE: {
        title: 'Database Unavailable',
        description: 'Our database is temporarily unavailable. Your work may not be saved.',
    },
    DATABASE_TIMEOUT: {
        title: 'Database Slow',
        description: 'Database is responding slowly. Please wait and try again.',
    },

    // Authentication Errors
    AUTH_FAILED: {
        title: 'Authentication Error',
        description: 'Please log in again to use AI features.',
    },
    NOT_LOGGED_IN: {
        title: 'Login Required',
        description: 'Please log in to use AI features.',
    },
    SESSION_EXPIRED: {
        title: 'Session Expired',
        description: 'Your session has expired. Please refresh the page and log in again.',
    },

    // Quota/Billing Errors
    QUOTA_EXCEEDED: {
        title: 'Service Quota Exceeded',
        description: 'AI service quota has been reached. Please try again later.',
    },

    // Configuration Errors
    CONFIG_ERROR: {
        title: 'Configuration Error',
        description: 'AI service is not properly configured. Please contact support.',
    },

    // Parse/Response Errors
    INVALID_RESPONSE: {
        title: 'Invalid AI Response',
        description: 'The AI returned an unexpected response. Please try again.',
    },
    PARSE_ERROR: {
        title: 'Processing Error',
        description: 'Failed to process the AI response. Please try again.',
    },
    EMPTY_RESPONSE: {
        title: 'No Response',
        description: 'The AI did not return a result. Please try again with a different prompt.',
    },

    // Input Errors
    INPUT_TOO_LONG: {
        title: 'Input Too Long',
        description: 'Your description is too long. Please shorten it and try again.',
    },
    INPUT_INVALID: {
        title: 'Invalid Input',
        description: 'Please check your input and try again.',
    },

    // Generic Fallback
    UNKNOWN: {
        title: 'Something Went Wrong',
        description: 'An unexpected error occurred. Please try again later.',
    },
} as const;

/**
 * Error message type
 */
export interface AIErrorMessage {
    title: string;
    description: string;
}

/**
 * Check if the browser is offline
 */
export function isOffline(): boolean {
    return typeof navigator !== 'undefined' && !navigator.onLine;
}

/**
 * Categorize an error and return the appropriate message
 */
export function getAIErrorMessage(
    error: unknown,
    context?: 'project' | 'description'
): AIErrorMessage {
    // Check offline first
    if (isOffline()) {
        return AI_ERROR_MESSAGES.OFFLINE;
    }

    // Handle string errors (sometimes thrown directly)
    const errorMessage = error instanceof Error
        ? error.message
        : typeof error === 'string'
            ? error
            : '';

    const lowerMessage = errorMessage.toLowerCase();

    // Rate limit errors (custom)
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('limit exceeded')) {
        return context === 'project'
            ? AI_ERROR_MESSAGES.LIMIT_EXCEEDED_PROJECT
            : AI_ERROR_MESSAGES.LIMIT_EXCEEDED_DESCRIPTION;
    }

    // Quota errors
    if (lowerMessage.includes('quota') || lowerMessage.includes('billing') || lowerMessage.includes('payment')) {
        return AI_ERROR_MESSAGES.QUOTA_EXCEEDED;
    }

    // Database errors
    if (
        lowerMessage.includes('database') ||
        lowerMessage.includes('supabase') ||
        lowerMessage.includes('pgrst') ||
        lowerMessage.includes('postgres') ||
        lowerMessage.includes('db ') ||
        lowerMessage.includes('insert') ||
        lowerMessage.includes('update') ||
        lowerMessage.includes('constraint')
    ) {
        if (lowerMessage.includes('timeout')) {
            return AI_ERROR_MESSAGES.DATABASE_TIMEOUT;
        }
        if (lowerMessage.includes('unavailable') || lowerMessage.includes('connection')) {
            return AI_ERROR_MESSAGES.DATABASE_UNAVAILABLE;
        }
        return AI_ERROR_MESSAGES.DATABASE_ERROR;
    }

    // Server errors (500, 502, 503, 504)
    if (lowerMessage.includes('500') || lowerMessage.includes('internal server')) {
        return AI_ERROR_MESSAGES.SERVER_ERROR;
    }
    if (lowerMessage.includes('502') || lowerMessage.includes('bad gateway')) {
        return AI_ERROR_MESSAGES.SERVER_DOWN;
    }
    if (lowerMessage.includes('503') || lowerMessage.includes('service unavailable')) {
        return AI_ERROR_MESSAGES.SERVER_OVERLOADED;
    }
    if (lowerMessage.includes('504') || lowerMessage.includes('gateway timeout')) {
        return AI_ERROR_MESSAGES.TIMEOUT;
    }

    // Auth errors (401, 403)
    if (lowerMessage.includes('401') || lowerMessage.includes('unauthorized')) {
        return AI_ERROR_MESSAGES.AUTH_FAILED;
    }
    if (lowerMessage.includes('403') || lowerMessage.includes('forbidden')) {
        return AI_ERROR_MESSAGES.AUTH_FAILED;
    }
    if (lowerMessage.includes('session') && (lowerMessage.includes('expired') || lowerMessage.includes('invalid'))) {
        return AI_ERROR_MESSAGES.SESSION_EXPIRED;
    }

    // Network errors
    if (lowerMessage.includes('econnrefused') || lowerMessage.includes('enotfound')) {
        return AI_ERROR_MESSAGES.CONNECTION_REFUSED;
    }
    if (
        lowerMessage.includes('network') ||
        lowerMessage.includes('failed to fetch') ||
        lowerMessage.includes('fetch failed') ||
        lowerMessage.includes('connection')
    ) {
        return AI_ERROR_MESSAGES.NETWORK_ERROR;
    }
    if (lowerMessage.includes('offline')) {
        return AI_ERROR_MESSAGES.OFFLINE;
    }

    // Timeout
    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out') || lowerMessage.includes('aborted')) {
        return AI_ERROR_MESSAGES.TIMEOUT;
    }

    // Configuration errors
    if (
        lowerMessage.includes('config') ||
        lowerMessage.includes('not configured') ||
        lowerMessage.includes('missing') ||
        lowerMessage.includes('webhook')
    ) {
        return AI_ERROR_MESSAGES.CONFIG_ERROR;
    }

    // Parse errors
    if (
        lowerMessage.includes('parse') ||
        lowerMessage.includes('json') ||
        lowerMessage.includes('invalid response') ||
        lowerMessage.includes('unexpected token')
    ) {
        return AI_ERROR_MESSAGES.PARSE_ERROR;
    }

    // Empty/no response
    if (lowerMessage.includes('empty') || lowerMessage.includes('no response') || lowerMessage.includes('no description')) {
        return AI_ERROR_MESSAGES.EMPTY_RESPONSE;
    }

    // Input errors
    if (lowerMessage.includes('too long') || lowerMessage.includes('too large') || lowerMessage.includes('payload')) {
        return AI_ERROR_MESSAGES.INPUT_TOO_LONG;
    }

    // Default
    return AI_ERROR_MESSAGES.UNKNOWN;
}

/**
 * Check if an error is recoverable (user can retry)
 */
export function isRecoverableError(error: unknown): boolean {
    const message = getAIErrorMessage(error);
    // Rate limits and quota are not recoverable today
    const nonRecoverableTitles: string[] = [
        AI_ERROR_MESSAGES.LIMIT_EXCEEDED_PROJECT.title,
        AI_ERROR_MESSAGES.LIMIT_EXCEEDED_DESCRIPTION.title,
        AI_ERROR_MESSAGES.QUOTA_EXCEEDED.title,
        AI_ERROR_MESSAGES.CONFIG_ERROR.title,
    ];
    return !nonRecoverableTitles.includes(message.title);
}

/**
 * Get a human-friendly error message based on error type
 * This is useful for displaying in toasts
 */
export function getToastErrorMessage(error: unknown, context?: 'project' | 'description'): {
    title: string;
    description: string;
    canRetry: boolean;
} {
    const errorMsg = getAIErrorMessage(error, context);
    return {
        ...errorMsg,
        canRetry: isRecoverableError(error),
    };
}
