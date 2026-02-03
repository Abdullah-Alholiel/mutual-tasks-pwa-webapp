// ============================================================================
// Retry Utility - Exponential Backoff Retry Logic
// ============================================================================
// Provides robust retry logic with exponential backoff for async operations.
// Used for API calls, WebSocket reconnection, and other transient failures.
//
// Features:
// - Configurable retry count and delays
// - Exponential backoff with jitter
// - Error filtering to determine retry eligibility
// - Cancellation support via AbortSignal
// ============================================================================

interface RetryOptions<T> {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: unknown) => boolean;
    onRetry?: (attempt: number, error: unknown, delay: number) => void;
    signal?: AbortSignal;
}

export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions<T> = {}
): Promise<T> {
    const {
        maxRetries = 3,
        initialDelay = 1000,
        maxDelay = 30000,
        shouldRetry = () => true,
        onRetry,
        signal
    } = options;

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        // Check for cancellation
        if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }

        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Check if we should retry
            if (attempt >= maxRetries || !shouldRetry(error)) {
                throw error;
            }

            // Calculate delay with exponential backoff and jitter
            const baseDelay = initialDelay * Math.pow(2, attempt);
            const jitter = Math.random() * 0.1 * baseDelay;
            const delay = Math.min(baseDelay + jitter, maxDelay);

            // Log retry attempt
            if (onRetry) {
                onRetry(attempt + 1, error, delay);
            }

            // Wait before retrying
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(resolve, delay);

                signal?.addEventListener('abort', () => {
                    clearTimeout(timeout);
                    reject(new DOMException('Aborted', 'AbortError'));
                });
            });
        }
    }

    throw lastError;
}

export interface RetryAsyncOptions {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
}

export function retryAsync<T extends (...args: Parameters<T>) => Promise<unknown>>(
    fn: T,
    options: RetryAsyncOptions = {}
): T {
    return (async (...args: Parameters<T>) => {
        return withRetry(() => fn(...args), options);
    }) as T;
}
