import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const AI_USAGE_LIMITS = {
    project_generation: 3,
    description_generation: 10,
} as const;

export type AIUsageType = keyof typeof AI_USAGE_LIMITS;

// F11: the quota day is ALWAYS UTC. Never derive it from a client-supplied
// timezone — that let the daily bucket stretch by ±12h across timezones.
export function getTodayDate(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'UTC' });
}

export async function checkRateLimit(
    supabaseAdmin: SupabaseClient,
    userId: number,
    usageType: AIUsageType
): Promise<{ allowed: boolean; remaining: number; limit: number; used: number }> {
    const today = getTodayDate();
    const limit = AI_USAGE_LIMITS[usageType];

    // Premium users bypass daily AI caps entirely (unlimited generations).
    const { data: userRow, error: premiumError } = await supabaseAdmin
        .from('users')
        .select('is_premium')
        .eq('id', userId)
        .maybeSingle();

    if (!premiumError && userRow?.is_premium) {
        console.log('[AI Rate Limit] Premium user — bypassing cap:', { userId, usageType });
        // Convention: remaining/limit === -1 means "premium / unlimited"
        return { allowed: true, remaining: -1, limit: -1, used: 0 };
    }

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
    usageType: AIUsageType
): Promise<void> {
    // F4: increment ATOMICALLY via the consume_ai_usage RPC (single INSERT ..
    // ON CONFLICT DO UPDATE, no read-then-write lost-update window).
    // Falls back to the legacy path only while the RPC is not yet applied
    // (003_consume_ai_usage_rpc.sql is owner-gated on prod).
    try {
        const { data, error: rpcError } = await supabaseAdmin
            .rpc('consume_ai_usage', { p_user_id: userId, p_usage_type: usageType });

        if (!rpcError) {
            console.log('[AI Usage] Atomic increment via RPC:', { userId, usageType, count: data });
            return;
        }

        // Function not present yet (404/PGRST202) → legacy fallback.
        // Anything else (network/permission) also falls back — the fallback
        // is today's proven behavior and the count must never be dropped.
        console.warn('[AI Usage] consume_ai_usage RPC unavailable, using legacy increment:', rpcError.message);
    } catch (rpcThrown) {
        console.warn('[AI Usage] consume_ai_usage RPC call threw, using legacy increment:', rpcThrown);
    }

    const today = getTodayDate();

    console.log('[AI Usage] incrementUsage called:', { userId, usageType, today });

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

        console.log('[Session] Querying sessions table for token...');
        const { data, error } = await supabase
            .from('sessions')
            .select('user_id, expires_at')
            .eq('token', token)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();

        console.log('[Session] Query result:', { data, error: error?.message || null });

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

// Origins allowed to call these endpoints from a browser. Netlify itself serves
// same-origin calls (Origin header absent), so the API paths need no wildcard.
// NOTE: update when the Cloudflare Pages domain goes live (P1-9).
const APP_ORIGIN_ALLOWLIST = [
    'https://social-momentum.netlify.app',
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:3000',
];

export function getCorsHeaders(origin?: string | null): { [key: string]: string } {
    const headers: { [key: string]: string } = {
        'Access-Control-Allow-Headers': 'Content-Type, authorization, x-user-timezone',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Vary': 'Origin',
    };
    // Same-origin requests (the PWA calling /api/* on its own host) send no Origin
    // header on many flows; only echo an allowlisted browser origin.
    if (origin && APP_ORIGIN_ALLOWLIST.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }
    return headers;
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

// ── Singleton Supabase admin client ─────────────────────────
// Service-role access for server-side authorization reads
// (push-target check etc.). Never import this from client code:
// the module lives under netlify/functions/ and is only bundled
// server-side. Key arrives via env binding, never VITE_-prefixed (F2).
let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
    if (adminClient) return adminClient;
    const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error('Supabase admin client not configured');
    }
    adminClient = createClient(url, key);
    return adminClient;
}
