import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

/**
 * Netlify Serverless Function to Send Push Notifications via OneSignal
 * 
 * This function runs on Netlify's servers and securely accesses the
 * ONESIGNAL_REST_API_KEY environment variable without exposing it to clients.
 */
const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json',
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    // Get secrets from environment
    const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
    const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
        console.error('[send-push-notification] Missing OneSignal configuration');
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Push notification service not configured' }),
        };
    }

    try {
        const payload = JSON.parse(event.body || '{}');
        const { externalUserId, title, message, url, icon, data } = payload;

        if (!externalUserId || !title || !message) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: externalUserId, title, message' }),
            };
        }

        // Call OneSignal REST API
        const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
            },
            body: JSON.stringify({
                app_id: ONESIGNAL_APP_ID,
                include_aliases: {
                    external_id: [String(externalUserId)],
                },
                target_channel: 'push',
                headings: { en: title },
                contents: { en: message },
                ...(url && { url }),
                small_icon: icon || '/icons/icon-192x192.png',
                large_icon: icon || '/icons/icon-192x192.png',
                ...(data && { data }),
                ios_badgeType: 'Increase',
                ios_badgeCount: 1,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[send-push-notification] OneSignal error:', response.status, errorText);
            return {
                statusCode: response.status,
                headers,
                body: JSON.stringify({ error: 'Failed to send push notification', details: errorText }),
            };
        }

        const result = await response.json();
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, id: result.id }),
        };

    } catch (error) {
        console.error('[send-push-notification] Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' }),
        };
    }
};

export { handler };
