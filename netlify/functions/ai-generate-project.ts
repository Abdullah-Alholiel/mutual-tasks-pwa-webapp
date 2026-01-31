import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import {
    verifyMagicLinkSession,
    checkRateLimit,
    getCorsHeaders,
    buildRateLimitResponse,
    AI_USAGE_LIMITS
} from './shared/utils';

const USAGE_TYPE = 'project_generation';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
    const headers = getCorsHeaders();

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed. Use POST.' }) };
    }

    try {
        let description: string | undefined;
        if (event.body) {
            try {
                const body = JSON.parse(event.body);
                description = body.description;
            } catch {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
            }
        }

        if (!description || typeof description !== 'string' || !description.trim()) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required parameter: description' }) };
        }

        const authHeader = event.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Missing or invalid authorization header' }) };
        }
        const sessionToken = authHeader.substring(7);

        const userTimezone = event.headers['x-user-timezone'] || 'UTC';

        const userId = await verifyMagicLinkSession(sessionToken);
        if (!userId) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Invalid or expired session' }) };
        }

        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseAdmin = createClient(
            supabaseUrl!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { global: { headers: { 'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY! } } }
        );

        const rateLimit = await checkRateLimit(supabaseAdmin, userId, USAGE_TYPE, userTimezone);

        if (!rateLimit.allowed) {
            return buildRateLimitResponse(headers, rateLimit.limit);
        }

        const n8nUrl = process.env.N8N_PROJECT_WEBHOOK_URL;
        if (!n8nUrl) {
            console.error('[AI Project] Missing N8N_PROJECT_WEBHOOK_URL');
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error: Missing Project Webhook URL' }) };
        }

        const secretKey = process.env.x_momentum_secret;

        console.log('[AI Project] Calling n8n:', {
            urlPrefix: n8nUrl.substring(0, 50) + '...',
            hasSecret: !!secretKey,
            descriptionLength: description.length
        });

        let response;
        try {
            response = await fetch(n8nUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-momentum-secret': secretKey || '',
                    'x_momentum_secret': secretKey || '',
                },
                body: JSON.stringify({ description: description.trim() }),
            });
        } catch (fetchError) {
            console.error('[AI Project] Fetch to n8n failed:', fetchError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'Failed to connect to AI service',
                    details: fetchError instanceof Error ? fetchError.message : 'Network error'
                })
            };
        }

        if (!response.ok) {
            const errText = await response.text();
            console.error('[AI Project] n8n Error:', response.status, errText);
            return {
                statusCode: 502,
                headers,
                body: JSON.stringify({ error: 'AI service unavailable', details: response.statusText })
            };
        }

        const responseText = await response.text();
        console.log('[AI Project] Success, response length:', responseText.length);

        return {
            statusCode: 200,
            headers: {
                ...headers,
                'X-RateLimit-Limit': String(rateLimit.limit),
                'X-RateLimit-Remaining': String(rateLimit.remaining),
                'X-RateLimit-Reset': String(Date.now() + 86400000),
            },
            body: responseText,
        };

    } catch (error) {
        console.error('[AI Project] Function error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to generate project',
                details: error instanceof Error ? error.message : 'Unknown error',
            }),
        };
    }
};

export { handler };
