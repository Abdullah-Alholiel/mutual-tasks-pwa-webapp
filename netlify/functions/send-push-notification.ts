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

        console.log('[send-push-notification] Received request:', {
            externalUserId,
            title,
            message: message?.substring(0, 50),
        });

        if (!externalUserId || !title || !message) {
            console.error('[send-push-notification] Missing fields:', { externalUserId, title, message });
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: externalUserId, title, message' }),
            };
        }

        const oneSignalPayload = {
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
        };

        console.log('[send-push-notification] Sending to OneSignal:', JSON.stringify(oneSignalPayload));

        // Call OneSignal REST API
        const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
            },
            body: JSON.stringify(oneSignalPayload),
        });

        const responseText = await response.text();
        console.log('[send-push-notification] OneSignal response:', response.status, responseText);

        if (!response.ok) {
            console.error('[send-push-notification] OneSignal error:', response.status, responseText);
            return {
                statusCode: response.status,
                headers,
                body: JSON.stringify({ error: 'Failed to send push notification', details: responseText }),
            };
        }

        const result = JSON.parse(responseText);

        // Check for the common "not subscribed" error
        if (result.errors && result.errors.includes('All included players are not subscribed')) {
            console.error('[send-push-notification] ⚠️ EXTERNAL ID NOT FOUND:', externalUserId);
            console.error('[send-push-notification] This means no OneSignal subscription has external_id:', externalUserId);
            console.error('[send-push-notification] The user needs to log in on the deployed site to link their subscription');
            return {
                statusCode: 200, // Return 200 as it's not a server error
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'No subscription found for user',
                    externalUserId,
                    hint: 'User must log in on deployed site to create/link subscription'
                }),
            };
        }

        console.log('[send-push-notification] ✅ Success! Recipients:', result.recipients, 'ID:', result.id);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, id: result.id, recipients: result.recipients }),
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
