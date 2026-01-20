// ============================================================================
// Custom Error Classes - Standardized Error Handling
// ============================================================================

/**
 * Database operation error
 */
export class DatabaseError extends Error {
    constructor(message: string, public code?: string) {
        super(message);
        this.name = 'DatabaseError';
    }
}

/**
 * Input validation error
 */
export class ValidationError extends Error {
    constructor(message: string, public field?: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

/**
 * Resource not found error
 */
export class NotFoundError extends Error {
    constructor(resource: string, id: number | string) {
        super(`${resource} with id ${id} not found`);
        this.name = 'NotFoundError';
    }
}

/**
 * Authentication/Authorization error
 */
export class AuthError extends Error {
    constructor(message: string = 'Authentication required') {
        super(message);
        this.name = 'AuthError';
    }
}

/**
 * Type guard to check if an error is an AppError with optional code
 */
export function isAppError(error: unknown): error is Error & { code?: string } {
    return error instanceof Error;
}

/**
 * Type guard for DatabaseError
 */
export function isDatabaseError(error: unknown): error is DatabaseError {
    return error instanceof DatabaseError;
}

/**
 * Type guard for NotFoundError
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
    return error instanceof NotFoundError;
}

/**
 * Extract error message safely from unknown error
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
        return String(error.message);
    }
    return 'An unexpected error occurred';
}
