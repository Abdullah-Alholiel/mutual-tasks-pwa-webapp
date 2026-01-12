// ============================================================================
// AI Usage Limits Utilities
// ============================================================================

import { getDatabaseClient } from '@/db';
import type { AIUsageType } from '@/db/aiUsage';

export type { AIUsageType };
export { AI_USAGE_LIMITS } from '@/db/aiUsage';

/**
 * Check if user can perform an AI action (under daily limit)
 */
export async function checkUsageLimit(userId: number, type: AIUsageType): Promise<{
    allowed: boolean;
    remaining: number;
    limit: number;
    used: number;
}> {
    const db = getDatabaseClient();
    return db.aiUsage.checkLimit(userId, type);
}

/**
 * Increment usage count after successful action
 */
export async function incrementUsage(userId: number, type: AIUsageType): Promise<void> {
    const db = getDatabaseClient();
    return db.aiUsage.incrementUsage(userId, type);
}

/**
 * Get current usage for today
 */
export async function getUsageCount(userId: number, type: AIUsageType): Promise<number> {
    const db = getDatabaseClient();
    return db.aiUsage.getUsageForToday(userId, type);
}
