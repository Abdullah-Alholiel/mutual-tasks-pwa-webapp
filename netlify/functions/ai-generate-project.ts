import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import {
    verifyMagicLinkSession,
    checkRateLimit,
    incrementUsage,
    getCorsHeaders,
    buildRateLimitResponse
} from './shared/utils';
import { generateProjectWithAI, useN8n, type ProviderDeps } from './shared/aiProviders';

const USAGE_TYPE = 'project_generation';

/** The Pages bridge installs the workerd `AI` binding into process.env (object).
 *  On Netlify there is no such binding — the value is absent or a string, and
 *  hasAiBinding() (via useN8n/auto) then routes to the legacy n8n path. */
function getAiBinding(): unknown {
    const v = (process.env as Record<string, unknown> | undefined)?.AI;
    return v !== null && typeof v === 'object' ? v : undefined;
}

function aiDeps(): ProviderDeps {
    return { aiBinding: getAiBinding(), env: process.env, fetchImpl: fetch, timeoutMs: 22_000 };
}

const handler: Handler = async (event: HandlerEvent) => {
    const headers = getCorsHeaders(event.headers['origin']);

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

        const rateLimit = await checkRateLimit(supabaseAdmin, userId, USAGE_TYPE);

        if (!rateLimit.allowed) {
            return buildRateLimitResponse(headers, rateLimit.limit);
        }

        // L4c: Workers AI (Pages `AI` binding) → OpenRouter fallback, with the legacy
        // n8n webhook kept for Netlify production (auto mode falls back when no AI
        // binding exists) and explicit AI_PROVIDER_MODE=n8n.
        if (!useN8n(aiDeps())) {
            const outcome = await generateProjectWithAI(aiDeps(), description.trim());

            if (outcome.ok) {
                // Measurement (README step 9): provider + real token counts in the logs
                // and on the response for staging verification.
                console.log('[AI Project] provider chain OK:', {
                    provider: outcome.provider,
                    model: outcome.model,
                    usage: outcome.usage ?? null,
                    attempts: outcome.attempts,
                });

                // F5: increment usage SERVER-SIDE on the same request as the generation.
                if (rateLimit.remaining !== -1) {
                    try {
                        await incrementUsage(supabaseAdmin, userId, USAGE_TYPE);
                    } catch (e) {
                        // Content already delivered — never fail the response on a
                        // usage-log failure. Over-count is safe, under-count is not.
                        console.error('[AI Project] Failed to increment usage:', e);
                    }
                    console.log('[AI Project] Usage incremented for userId:', userId);
                } else {
                    console.log('[AI Project] Premium user — no usage increment');
                }

                const remainingHeader = rateLimit.remaining === -1 ? -1 : Math.max(0, rateLimit.remaining - 1);
                const aiHeaders: Record<string, string> = {
                    'X-AI-Provider': outcome.provider,
                    'X-AI-Model': outcome.model,
                };
                if (outcome.usage) {
                    aiHeaders['X-AI-Usage'] = JSON.stringify(outcome.usage);
                }

                // Body: canonical project JSON — the client's direct-JSON branch
                // (data.name && data.tasks) validates it with no parser change.
                return {
                    statusCode: 200,
                    headers: {
                        ...headers,
                        ...aiHeaders,
                        'X-RateLimit-Limit': String(rateLimit.limit),
                        'X-RateLimit-Remaining': String(remainingHeader),
                        'X-RateLimit-Reset': String(Date.now() + 86400000),
                    },
                    body: JSON.stringify(outcome.project),
                };
            }

            // Everything exhausted (Workers AI free allowance spent + fallback failed):
            // distinct code, localized "AI help is back tomorrow" on the client,
            // NO usage counted.
            if (outcome.exhausted) {
                console.error('[AI Project] AI exhausted:', outcome.attempts);
                return {
                    statusCode: 503,
                    headers,
                    body: JSON.stringify({ error: 'AI_EXHAUSTED' }),
                };
            }

            // F19: full attempt detail logged server-side only; clients get the generic error.
            console.error('[AI Project] provider chain failed:', outcome.attempts, outcome.error);
            return {
                statusCode: 502,
                headers,
                body: JSON.stringify({ error: 'AI service unavailable' }),
            };
        }

        // ---------------- Legacy n8n path (Netlify production; unchanged) ----------------
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
            // F19: full detail logged server-side only; clients get the generic error.
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Failed to connect to AI service' })
            };
        }

        if (!response.ok) {
            const errText = await response.text();
            console.error('[AI Project] n8n Error:', response.status, errText);
            return {
                statusCode: 502,
                headers,
                body: JSON.stringify({ error: 'AI service unavailable' })
            };
        }

        const responseText = await response.text();
        console.log('[AI Project] Success, response length:', responseText.length);

        // F5: increment usage SERVER-SIDE on the same request as the generation
        // (counting previously relied on the client calling ai-confirm-usage —
        // a stale bundle or a user who never confirmed got unlimited generations).
        // Stale bundles that ALSO confirm will at worst double-count (over-count
        // is the safe direction); under-count is no longer possible.
        if (rateLimit.remaining !== -1) {
            try {
                await incrementUsage(supabaseAdmin, userId, USAGE_TYPE);
            } catch (e) {
                // Content already delivered — never fail the response on a
                // usage-log failure. Over-count is safe, under-count is not.
                console.error('[AI Project] Failed to increment usage:', e);
            }
            console.log('[AI Project] Usage incremented for userId:', userId);
        } else {
            console.log('[AI Project] Premium user — no usage increment');
        }

        const remainingHeader = rateLimit.remaining === -1 ? -1 : Math.max(0, rateLimit.remaining - 1);

        return {
            statusCode: 200,
            headers: {
                ...headers,
                'X-RateLimit-Limit': String(rateLimit.limit),
                'X-RateLimit-Remaining': String(remainingHeader),
                'X-RateLimit-Reset': String(Date.now() + 86400000),
            },
            body: responseText,
        };

    } catch (error) {
        console.error('[AI Project] Function error:', error);
        // F19: strip internal details — never leak upstream error text to clients.
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to generate project' }),
        };
    }
};

export { handler };
