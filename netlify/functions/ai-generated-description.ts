import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import {
    verifyMagicLinkSession,
    checkRateLimit,
    incrementUsage,
    getCorsHeaders,
    buildRateLimitResponse,
    AI_USAGE_LIMITS,
    getTodayDate
} from './shared/utils';

const USAGE_TYPE = 'description_generation';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
    const headers = getCorsHeaders();

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        console.log('[AI Description] Method not allowed:', event.httpMethod);
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed. Use POST.' }) };
    }

    try {
        let title: string | undefined;
        let type: 'task' | 'project' = 'task';

        if (event.body) {
            try {
                const body = JSON.parse(event.body);
                title = body.title;
                type = body.type || 'task';
            } catch {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
            }
        }

        if (!title || typeof title !== 'string' || !title.trim()) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required parameter: title' }) };
        }

        const authHeader = event.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('[AI Description] Missing authorization header');
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Missing or invalid authorization header' }) };
        }
        const sessionToken = authHeader.substring(7);

        const userTimezone = event.headers['x-user-timezone'] || 'UTC';
        const usageDate = getTodayDate(userTimezone);

        console.log('[AI Description] Starting generation:', { type, titleLength: title.length, timezone: userTimezone, usageDate });

        const userId = await verifyMagicLinkSession(sessionToken);
        if (!userId) {
            console.log('[AI Description] Session verification failed');
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Invalid or expired session' }) };
        }

        console.log('[AI Description] Session verified for user:', userId);

        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseAdmin = createClient(
            supabaseUrl!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { global: { headers: { 'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY! } } }
        );

        const rateLimit = await checkRateLimit(supabaseAdmin, userId, USAGE_TYPE as any, userTimezone);
        console.log('[AI Description] Rate limit check:', rateLimit);

        if (!rateLimit.allowed) {
            console.log('[AI Description] Rate limit exceeded for user:', userId);
            return buildRateLimitResponse(headers, rateLimit.limit);
        }

        const n8nUrl = process.env.N8N_DESCRIPTION_WEBHOOK_URL;
        if (!n8nUrl) {
            console.error('[AI Description] Missing N8N_DESCRIPTION_WEBHOOK_URL');
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error: Missing Description Webhook URL' }) };
        }

        const secretKey = process.env.x_momentum_secret;

        console.log('[AI Description] Calling n8n:', {
            urlPrefix: n8nUrl.substring(0, 50) + '...',
            hasSecret: !!secretKey,
            title: title.trim().substring(0, 50)
        });

        const response = await fetch(n8nUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-momentum-secret': secretKey || '',
                'x_momentum_secret': secretKey || '',
            },
            body: JSON.stringify({
                title: title.trim(),
                project_title: title.trim(), // Added to match n8n prompt
                type
            }),
            cache: 'no-store',
        });

        console.log('[AI Description] n8n response status:', response.status);

        if (!response.ok) {
            const errText = await response.text();
            console.error('[AI Description] n8n Error:', response.status, errText);
            return {
                statusCode: 502,
                headers,
                body: JSON.stringify({ error: 'AI service unavailable', details: response.statusText })
            };
        }

        const responseText = await response.text();
        console.log('[AI Description] n8n success, response length:', responseText.length);

        // CHECK: Is the response actually valid content?
        if (!responseText || responseText.trim().length === 0) {
            console.warn('[AI Description] n8n returned an empty response. Usage NOT incremented.');
            return {
                statusCode: 204, // No Content
                headers,
                body: ''
            };
        }

        // ONLY increment usage if we have valid content
        try {
            await incrementUsage(supabaseAdmin, userId, USAGE_TYPE as any, userTimezone);
            console.log('[AI Description] Usage incremented for userId:', userId, 'date:', usageDate);
        } catch (e) {
            console.error('[AI Description] Failed to increment usage:', e);
            // We still return the content even if usage logging fails
        }

        return {
            statusCode: 200,
            headers: {
                ...headers,
                'X-RateLimit-Limit': String(rateLimit.limit),
                'X-RateLimit-Remaining': String(rateLimit.remaining - 1),
                'X-RateLimit-Reset': String(Date.now() + 86400000),
            },
            body: responseText,
        };

    } catch (error) {
        console.error('[AI Description] Function error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to generate description',
                details: error instanceof Error ? error.message : 'Unknown error',
            }),
        };
    }
};

export { handler };
