import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { verifyMagicLinkSession, getCorsHeaders } from './shared/utils';

/**
 * POST /api/premium-interest — G3 (D-081): record Premium interest from the
 * upgrade screen. NO payment code (manual-billing era): this only records that
 * a signed-in user wants Premium, so the founders can follow up personally.
 *
 * Contract (docs/plans/2026-11-28-run35-g3-monthly-limits):
 *   caller auth : Bearer session token (verifyMagicLinkSession — F1 class)
 *   body        : { message?: string } (≤ 500 chars, optional)
 *   200         : { ok: true }
 *   400         : { error }   (bad JSON / message too long)
 *   401         : { error }   (no/invalid session — details never leaked)
 *   429         : { error }   (throttle: 5 requests/hour/user, in-memory)
 *   500         : { error }   (table missing until 005 applied / DB failure —
 *                              full detail logged server-side only, F19 class)
 * Writer is service_role; premium_interest has RLS ON + zero policies
 * (database/vps-migration/005_premium_interest.sql, owner-applied).
 */

const MAX_MESSAGE_LENGTH = 500;
const THROTTLE_LIMIT = 5;
const THROTTLE_WINDOW_MS = 60 * 60 * 1000;

// In-memory throttle (per isolate). Deliberately approximate: a burst across
// isolates may exceed it slightly, but it stops accidental hammering and is
// sufficient for a manual-billing interest button.
const hits = new Map<number, number[]>();

function throttled(userId: number): boolean {
    const now = Date.now();
    const windowStart = now - THROTTLE_WINDOW_MS;
    const recent = (hits.get(userId) ?? []).filter((t) => t > windowStart);
    if (recent.length >= THROTTLE_LIMIT) {
        hits.set(userId, recent);
        return true;
    }
    recent.push(now);
    hits.set(userId, recent);
    // Keep the map bounded: drop entries seen nowhere in the last window.
    if (hits.size > 1000) {
        for (const [uid, times] of hits) {
            if (!times.some((t) => t > windowStart)) hits.delete(uid);
        }
    }
    return false;
}

const handler: Handler = async (event: HandlerEvent) => {
    const headers = getCorsHeaders(event.headers['origin']);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed. Use POST.' }) };
    }

    const authHeader = event.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Missing or invalid authorization header' }) };
    }
    const userId = await verifyMagicLinkSession(authHeader.substring(7));
    if (!userId) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Invalid or expired session' }) };
    }

    if (throttled(userId)) {
        return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests. Please try again later.' }) };
    }

    let message = '';
    if (event.body) {
        try {
            const body = JSON.parse(event.body) as { message?: unknown };
            if (body.message !== undefined && body.message !== null) {
                if (typeof body.message !== 'string') {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'message must be a string' }) };
                }
                message = body.message.trim();
            }
        } catch {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
        }
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: `message must be at most ${MAX_MESSAGE_LENGTH} characters` }) };
    }

    try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseAdmin = createClient(
            supabaseUrl!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { global: { headers: { 'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY! } } }
        );

        // email copied server-side from the user's own row (never trusted from
        // the client); the insert carries the user_id for the follow-up.
        const { data: userRow } = await supabaseAdmin
            .from('users')
            .select('email')
            .eq('id', userId)
            .maybeSingle();

        const { error: insertError } = await supabaseAdmin
            .from('premium_interest')
            .insert({ user_id: userId, email: userRow?.email ?? null, message: message || null });

        if (insertError) {
            // e.g. 005 not applied yet (42P01 undefined_table) — log full, return generic.
            console.error('[Premium Interest] Insert failed:', insertError.code, insertError.message);
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not record your interest right now. Please try again later.' }) };
        }

        console.log('[Premium Interest] Recorded:', { userId });
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    } catch (error) {
        console.error('[Premium Interest] Function error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not record your interest right now. Please try again later.' }) };
    }
};

export { handler };
