// ============================================================================
// Request Deduplicator - Prevent Duplicate Operations
// ============================================================================

/**
 * Prevents duplicate concurrent requests for the same operation.
 * If a request with the same key is already in progress, returns the existing promise.
 * 
 * @example
 * // In TaskCard
 * const handleComplete = () => deduplicator.deduplicate(
 *   `complete-${taskId}`,
 *   async () => await completeTask(taskId)
 * );
 */
class RequestDeduplicator {
    private pendingRequests = new Map<string, Promise<unknown>>();

    /**
     * Deduplicate a request by key
     * @param key - Unique identifier for the operation
     * @param operation - Async operation to execute
     * @returns Promise resolving to the operation result
     */
    async deduplicate<T>(
        key: string,
        operation: () => Promise<T>
    ): Promise<T> {
        // If request already pending, return it
        const existing = this.pendingRequests.get(key);
        if (existing) {
            console.log(`[Deduplicator] Reusing pending request for: ${key}`);
            return existing as Promise<T>;
        }

        // Start new request
        const promise = operation();
        this.pendingRequests.set(key, promise);

        // Cleanup on completion
        promise
            .finally(() => {
                this.pendingRequests.delete(key);
            })
            .catch(() => {
                // Error handled by caller, just cleanup
            });

        return promise;
    }

    /**
     * Check if a request is currently pending
     * @param key - Unique identifier for the operation
     */
    isPending(key: string): boolean {
        return this.pendingRequests.has(key);
    }

    /**
     * Get count of pending requests (for debugging)
     */
    getPendingCount(): number {
        return this.pendingRequests.size;
    }

    /**
     * Clear all pending requests (use with caution)
     */
    clear(): void {
        this.pendingRequests.clear();
    }
}

// Export singleton instance
export const deduplicator = new RequestDeduplicator();

/**
 * Higher-order function to wrap an async function with deduplication
 * 
 * @example
 * const safeComplete = withDeduplication(
 *   (taskId: number) => `complete-${taskId}`,
 *   async (taskId: number) => await completeTask(taskId)
 * );
 */
export function withDeduplication<T extends (...args: unknown[]) => Promise<unknown>>(
    keyFn: (...args: Parameters<T>) => string,
    fn: T
): T {
    return (async (...args: Parameters<T>) => {
        const key = keyFn(...args);
        return deduplicator.deduplicate(key, () => fn(...args));
    }) as T;
}
