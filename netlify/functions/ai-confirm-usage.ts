import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import {
    verifyMagicLinkSession,
    incrementUsage,
    getCorsHeaders,
    AI_USAGE_LIMITS,
    getTodayDate,
    type AIUsageType
} from './shared/utils';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
    const headers = getCorsHeaders();

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed. Use POST.' }) };
    }

    try {
        let usageType: AIUsageType | undefined;

        if (event.body) {
            try {
                const body = JSON.parse(event.body);
                usageType = body.usageType as AIUsageType;
            } catch {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
            }
        }

        if (!usageType || (usageType !== 'project_generation' && usageType !== 'description_generation')) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid usage type. Must be project_generation or description_generation' }) };
        }

        const authHeader = event.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Missing or invalid authorization header' }) };
        }
        const sessionToken = authHeader.substring(7);

        const userTimezone = event.headers['x-user-timezone'] || 'UTC';

        console.log('[AI Confirm Usage] Starting usage confirmation:', { usageType, userTimezone });

        const userId = await verifyMagicLinkSession(sessionToken);
        if (!userId) {
            console.log('[AI Confirm Usage] Session verification failed');
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Invalid or expired session' }) };
        }

        console.log('[AI Confirm Usage] Session verified for user:', userId);

        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseAdmin = createClient(
            supabaseUrl!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { global: { headers: { 'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY! } } }
        );

        const usageDate = getTodayDate(userTimezone);
        console.log('[AI Confirm Usage] About to increment usage:', { userId, usageType, usageDate, userTimezone });

        await incrementUsage(supabaseAdmin, userId, usageType, userTimezone);

        console.log('[AI Confirm Usage] Usage recorded successfully:', { userId, usageType, usageDate });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Usage recorded successfully',
                usageDate: usageDate,
                userId: userId,
                usageType: usageType
            }),
        };

    } catch (error) {
        console.error('[AI Confirm Usage] Function error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to record usage',
                details: error instanceof Error ? error.message : 'Unknown error',
            }),
        };
    }
};

export { handler };
