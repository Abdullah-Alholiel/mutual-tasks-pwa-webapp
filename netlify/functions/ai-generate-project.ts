import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

/**
 * Netlify Serverless Function to Securely Proxy AI Project Generation Requests
 * 
 * This function runs on the server (Netlify), so it can safely access
 * environment variables like x_momentum_secret without exposing them to the client.
 */
const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
    // CORS Headers for security
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-momentum-session, x-momentum-secret',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: '',
        };
    }

    // Only accept POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed. Use POST.' }),
        };
    }

    try {
        // Parse request body
        let description: string | undefined;

        if (event.body) {
            try {
                const body = JSON.parse(event.body);
                description = body.description;
            } catch {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid JSON body' }),
                };
            }
        }

        if (!description || typeof description !== 'string' || !description.trim()) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required parameter: description' }),
            };
        }

        const n8nUrl = process.env.N8N_PROJECT_WEBHOOK_URL;
        const secretKey = process.env.x_momentum_secret;

        console.log('[Netlify Function] AI Project Generation - Starting...');
        console.log('[Netlify Function] Description length:', description.length);
        console.log('[Netlify Function] n8n URL defined:', !!n8nUrl);

        if (!n8nUrl) {
            console.error('[Netlify Function] Missing N8N_PROJECT_WEBHOOK_URL');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Server configuration error: Missing Project Webhook URL' }),
            };
        }

        // Call n8n Webhook with POST body
        const response = await fetch(n8nUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-momentum-secret': secretKey || '',
                'x_momentum_secret': secretKey || '', // Fallback for specific n8n config
            },
            body: JSON.stringify({ description: description.trim() }),
        });

        console.log('[Netlify Function] n8n Response Status:', response.status);

        if (!response.ok) {
            const errText = await response.text();
            console.error('[Netlify Function] n8n Error Body:', errText);
            throw new Error(`n8n responded with ${response.status}: ${response.statusText}`);
        }

        // Get response text (should be JSON with project data)
        const responseText = await response.text();
        console.log('[Netlify Function] Response length:', responseText.length);

        return {
            statusCode: 200,
            headers,
            body: responseText, // Return raw response, frontend handles parsing
        };

    } catch (error) {
        console.error('Function execution failed:', error);
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
