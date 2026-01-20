// ============================================================================
// Performance Monitoring - Track Slow Operations
// ============================================================================

export interface PerformanceMetric {
    name: string;
    duration: number;
    timestamp: number;
    metadata?: Record<string, unknown>;
    success: boolean;
}

/**
 * Simple performance monitoring for identifying slow operations.
 * Logs warnings for operations exceeding threshold.
 * 
 * @example
 * // Wrap database operation
 * const result = await perf.measure('tasks.create', async () => {
 *   return await db.tasks.create(taskData);
 * }, { taskType: 'habit' });
 */
class PerformanceMonitor {
    private metrics: PerformanceMetric[] = [];
    private readonly maxMetrics = 100; // Keep last 100 metrics
    private readonly slowThreshold = 1000; // 1 second

    /**
     * Measure the duration of an async operation
     * @param name - Name of the operation being measured
     * @param fn - Async function to execute and measure
     * @param metadata - Optional metadata to include with the metric
     */
    async measure<T>(
        name: string,
        fn: () => Promise<T>,
        metadata?: Record<string, unknown>
    ): Promise<T> {
        const start = performance.now();
        let success = true;

        try {
            const result = await fn();
            return result;
        } catch (error) {
            success = false;
            throw error;
        } finally {
            const duration = performance.now() - start;

            const metric: PerformanceMetric = {
                name,
                duration,
                timestamp: Date.now(),
                metadata,
                success,
            };

            this.addMetric(metric);

            // Log slow operations
            if (duration > this.slowThreshold) {
                console.warn(
                    `[Perf] Slow operation: ${name} (${duration.toFixed(0)}ms)`,
                    metadata
                );
            }
        }
    }

    /**
     * Add a metric to the collection
     */
    private addMetric(metric: PerformanceMetric): void {
        this.metrics.push(metric);

        // Keep only the last N metrics
        if (this.metrics.length > this.maxMetrics) {
            this.metrics = this.metrics.slice(-this.maxMetrics);
        }
    }

    /**
     * Get operations that exceeded the slow threshold
     * @param threshold - Custom threshold in milliseconds (default: 1000)
     */
    getSlowOperations(threshold: number = this.slowThreshold): PerformanceMetric[] {
        return this.metrics.filter(m => m.duration > threshold);
    }

    /**
     * Get average duration for a specific operation
     * @param name - Operation name to get average for
     */
    getAverageDuration(name: string): number | null {
        const matching = this.metrics.filter(m => m.name === name);
        if (matching.length === 0) return null;

        const total = matching.reduce((sum, m) => sum + m.duration, 0);
        return total / matching.length;
    }

    /**
     * Get all collected metrics
     */
    getMetrics(): PerformanceMetric[] {
        return [...this.metrics];
    }

    /**
     * Clear all metrics
     */
    clear(): void {
        this.metrics = [];
    }

    /**
     * Get summary statistics
     */
    getSummary(): {
        totalOperations: number;
        slowOperations: number;
        averageDuration: number;
        failedOperations: number;
    } {
        const total = this.metrics.length;
        const slow = this.metrics.filter(m => m.duration > this.slowThreshold).length;
        const failed = this.metrics.filter(m => !m.success).length;
        const avgDuration = total > 0
            ? this.metrics.reduce((sum, m) => sum + m.duration, 0) / total
            : 0;

        return {
            totalOperations: total,
            slowOperations: slow,
            averageDuration: Math.round(avgDuration),
            failedOperations: failed,
        };
    }
}

// Export singleton instance
export const perf = new PerformanceMonitor();
