// ============================================================================
// AI Usage Repository - Database Access for AI Usage Tracking
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export type AIUsageType = 'project_generation' | 'description_generation';

export interface AIUsageLog {
    id: number;
    userId: number;
    usageType: AIUsageType;
    usageDate: string; // YYYY-MM-DD format
    count: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface AIUsageLimits {
    project_generation: number;
    description_generation: number;
}

// Daily limits
export const AI_USAGE_LIMITS: AIUsageLimits = {
    project_generation: 3,
    description_generation: 5,
};

// ============================================================================
// Repository
// ============================================================================

export class AIUsageRepository {
    constructor(private supabase: SupabaseClient) { }

    /**
     * Get today's date in YYYY-MM-DD format (user's local timezone)
     */
    private getTodayDate(): string {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * Get the usage count for a user and type for today
     */
    async getUsageForToday(userId: number, type: AIUsageType): Promise<number> {
        const today = this.getTodayDate();

        const { data, error } = await this.supabase
            .from('ai_usage_logs')
            .select('count')
            .eq('user_id', userId)
            .eq('usage_type', type)
            .eq('usage_date', today)
            .single();

        if (error) {
            // PGRST116 means no rows found, which is fine
            if (error.code === 'PGRST116') {
                return 0;
            }
            console.error('[AIUsageRepository] Error getting usage:', error);
            return 0;
        }

        return data?.count ?? 0;
    }

    /**
     * Check if user can perform the action (under limit)
     */
    async checkLimit(userId: number, type: AIUsageType): Promise<{
        allowed: boolean;
        remaining: number;
        limit: number;
        used: number;
    }> {
        const limit = AI_USAGE_LIMITS[type];
        const used = await this.getUsageForToday(userId, type);
        const remaining = Math.max(0, limit - used);

        return {
            allowed: used < limit,
            remaining,
            limit,
            used,
        };
    }

    /**
     * Increment usage count for a user and type
     * Uses UPSERT to handle first-time and increments
     */
    async incrementUsage(userId: number, type: AIUsageType): Promise<void> {
        const today = this.getTodayDate();

        // First, try to get existing record
        const { data: existing } = await this.supabase
            .from('ai_usage_logs')
            .select('id, count')
            .eq('user_id', userId)
            .eq('usage_type', type)
            .eq('usage_date', today)
            .single();

        if (existing) {
            // Update existing record
            const { error } = await this.supabase
                .from('ai_usage_logs')
                .update({
                    count: existing.count + 1,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);

            if (error) {
                console.error('[AIUsageRepository] Error incrementing usage:', error);
                throw new Error('Failed to update usage count');
            }
        } else {
            // Insert new record
            const { error } = await this.supabase
                .from('ai_usage_logs')
                .insert({
                    user_id: userId,
                    usage_type: type,
                    usage_date: today,
                    count: 1,
                });

            if (error) {
                console.error('[AIUsageRepository] Error inserting usage:', error);
                throw new Error('Failed to record usage');
            }
        }
    }
}
