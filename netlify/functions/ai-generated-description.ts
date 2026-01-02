import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

/**
 * Netlify Serverless Function to Securely Proxy AI Gen Requests
 * 
 * This function runs on the server (Netlify), so it can safely access
 * environment variables like x_momentum_secret without exposing them to the client.
 */
const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
    // CORS Headers for security
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-momentum-session, x-momentum-secret',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        const { type, project_title } = event.queryStringParameters || {};

        if (!type || !project_title) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required parameters: type, project_title' })
            };
        }

        const n8nUrl = process.env.N8N_WEBHOOK_URL;
        const secretKey = process.env.x_momentum_secret;

        console.log('[Netlify Function] Starting execution...');
        console.log('[Netlify Function] Params:', { type, n8nUrlDefined: !!n8nUrl });

        if (!n8nUrl) {
            console.error('[Netlify Function] Missing N8N_WEBHOOK_URL');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Server configuration error: Missing Webhook URL' })
            };
        }

        // Construct query parameters
        const params = new URLSearchParams({
            type: type,
            project_title: project_title
        });

        const fullUrl = `${n8nUrl}?${params.toString()}`;
        console.log('[Netlify Function] Fetching URL (masked):', fullUrl.replace(secretKey || 'xxx', '***'));

        // Call n8n Webhook
        const response = await fetch(fullUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-momentum-secret': secretKey || '',
                'x_momentum_secret': secretKey || '' // Fallback for specific n8n config
            }
        });

        console.log('[Netlify Function] n8n Response Status:', response.status);

        if (!response.ok) {
            const errText = await response.text();
            console.error('[Netlify Function] n8n Error Body:', errText);
            throw new Error(`n8n responded with ${response.status}: ${response.statusText}`);
        }

        // Get response text (it might be JSON or plain text)
        const responseText = await response.text();

        return {
            statusCode: 200,
            headers,
            body: responseText // Return raw response, frontend handles parsing
        };

    } catch (error) {
        console.error('Function execution failed:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to generate description',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        };
    }
};

export { handler };
