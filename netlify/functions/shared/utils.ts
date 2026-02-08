import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const AI_USAGE_LIMITS = {
    project_generation: 3,
    description_generation: 5,
} as const;

export type AIUsageType = keyof typeof AI_USAGE_LIMITS;

export function getTodayDate(timezone: string = 'UTC'): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
}

export async function checkRateLimit(
    supabaseAdmin: SupabaseClient,
    userId: number,
    usageType: AIUsageType,
    timezone: string = 'UTC'
): Promise<{ allowed: boolean; remaining: number; limit: number; used: number }> {
    const today = getTodayDate(timezone);
    const limit = AI_USAGE_LIMITS[usageType];

    const { data, error } = await supabaseAdmin
        .from('ai_usage_logs')
        .select('count')
        .eq('user_id', userId)
        .eq('usage_type', usageType)
        .eq('usage_date', today)
        .maybeSingle();

    if (error) {
        console.error('[AI Rate Limit] Failed to check usage:', error.code, error.message);
        return { allowed: false, remaining: 0, limit, used: 0 };
    }

    const used = data?.count ?? 0;
    console.log('[AI Rate Limit] Usage check:', { userId, usageType, today, used, limit, remaining: Math.max(0, limit - used) });

    return {
        allowed: used < limit,
        remaining: Math.max(0, limit - used),
        limit,
        used
    };
}

export async function incrementUsage(
    supabaseAdmin: SupabaseClient,
    userId: number,
    usageType: AIUsageType,
    timezone: string = 'UTC'
): Promise<void> {
    const today = getTodayDate(timezone);

    console.log('[AI Usage] incrementUsage called:', { userId, usageType, today, timezone });

    const { data: existing, error: fetchError } = await supabaseAdmin
        .from('ai_usage_logs')
        .select('id, count')
        .eq('user_id', userId)
        .eq('usage_type', usageType)
        .eq('usage_date', today)
        .maybeSingle();

    if (fetchError) {
        console.error('[AI Usage] Failed to fetch usage record:', fetchError);
        throw new Error('Failed to check usage record');
    }

    console.log('[AI Usage] Existing record lookup:', { found: !!existing, existing });

    if (existing) {
        console.log('[AI Usage] Updating existing record:', { id: existing.id, currentCount: existing.count, newCount: existing.count + 1 });

        const { error: updateError } = await supabaseAdmin
            .from('ai_usage_logs')
            .update({
                count: existing.count + 1,
                updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);

        if (updateError) {
            console.error('[AI Usage] Failed to update usage:', updateError);
            throw new Error('Failed to update usage count');
        }

        console.log('[AI Usage] Successfully updated record');
    } else {
        console.log('[AI Usage] No existing record, inserting new one:', { userId, usageType, today });

        const { data: insertedData, error: insertError } = await supabaseAdmin
            .from('ai_usage_logs')
            .insert({
                user_id: userId,
                usage_type: usageType,
                usage_date: today,
                count: 1,
            })
            .select()
            .single();

        if (insertError) {
            console.error('[AI Usage] Failed to insert usage:', insertError);
            throw new Error('Failed to record usage');
        }

        console.log('[AI Usage] Successfully inserted new record:', insertedData);
    }
}

export async function verifyMagicLinkSession(token: string): Promise<number | null> {
    console.log('[Session] Verifying magic link session token');

    try {
        // Use VITE_SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL as fallback)
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        console.log('[Session] Env vars check:', {
            hasViteUrl: !!process.env.VITE_SUPABASE_URL,
            hasNextUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            hasSupabaseUrl: !!process.env.SUPABASE_URL,
            hasServiceKey: !!serviceRoleKey,
            urlUsed: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING'
        });

        if (!supabaseUrl || !serviceRoleKey) {
            console.error('[Session] Missing SUPABASE_URL or SERVICE_ROLE_KEY env vars');
            return null;
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);

        const { data, error } = await supabase
            .from('sessions')
            .select('user_id, expires_at')
            .eq('token', token)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();

        if (error) {
            console.error('[Session] Verification failed:', error.code, error.message);
            return null;
        }

        if (!data) {
            console.error('[Session] Token not found or expired in database');
            return null;
        }

        console.log('[Session] Session verified successfully for user ID:', data.user_id);
        return data.user_id;
    } catch (err) {
        console.error('[Session] Unexpected error during verification:', err);
        return null;
    }
}

export function getCorsHeaders(): { [key: string]: string } {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, authorization, x-user-timezone',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
}

export function buildRateLimitResponse(
    headers: Record<string, string>,
    limit: number
): { statusCode: number; headers: Record<string, string>; body: string } {
    return {
        statusCode: 429,
        headers: { ...headers, 'X-RateLimit-Remaining': '0', 'X-RateLimit-Limit': String(limit) },
        body: JSON.stringify({
            error: 'Rate limit exceeded',
            message: `You've used all ${limit} AI generations for today. Try again tomorrow!`,
            limit,
            remaining: 0,
        }),
    };
}
