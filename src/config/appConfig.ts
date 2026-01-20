// ============================================================================
// Application Configuration - Centralized Constants
// ============================================================================

/**
 * Performance configuration for UI responsiveness
 */
export const PERFORMANCE_CONFIG = {
    /** Virtualization settings for large lists */
    VIRTUALIZATION: {
        ITEM_HEIGHT: 180,
        OVERSCAN: 3,
        THRESHOLD: 15, // Number of items before enabling virtualization
    },

    /** React Query caching durations */
    CACHING: {
        // User data - long cache (changes infrequently)
        USER_DATA_STALE_TIME: 1000 * 60 * 10, // 10 minutes
        USER_DATA_GC_TIME: 1000 * 60 * 30, // 30 minutes

        // Task data - short cache (changes frequently)
        TASK_DATA_STALE_TIME: 1000 * 30, // 30 seconds
        TASK_DATA_GC_TIME: 1000 * 60 * 5, // 5 minutes

        // Project data - medium cache
        PROJECT_DATA_STALE_TIME: 1000 * 60 * 5, // 5 minutes
        PROJECT_DATA_GC_TIME: 1000 * 60 * 15, // 15 minutes

        // Completion logs - medium cache (changes less frequently than tasks)
        COMPLETION_DATA_STALE_TIME: 1000 * 60 * 2, // 2 minutes

        // Search data - short cache (user expects fresh results)
        SEARCH_DATA_STALE_TIME: 1000 * 60 * 1, // 1 minute
        SEARCH_DATA_GC_TIME: 1000 * 60 * 5, // 5 minutes
    },

    /** Realtime subscription settings */
    REALTIME: {
        INVALIDATION_DELAY: 1000, // 1 second delay before invalidating queries
        RECONNECT_TIMEOUT: 5000, // 5 seconds
    },
} as const;

/**
 * Task-specific configuration
 */
export const TASK_CONFIG = {
    /** Default occurrence counts for recurring tasks by pattern */
    DEFAULT_RECURRING_COUNT: {
        Daily: 30,
        weekly: 5,
        custom: 10,
    } as const,

    /** Default duration in days for recurring task generation */
    DEFAULT_RECURRING_DURATION_DAYS: 30,

    /** Maximum occurrences allowed for any recurring task */
    MAX_RECURRING_OCCURRENCES: 365,

    /** Base XP for task completion */
    BASE_XP: 200,

    /** XP for recovered tasks (fixed amount) */
    RECOVERED_XP: 100,
} as const;


