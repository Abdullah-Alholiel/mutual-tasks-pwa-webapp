import type { Handler, HandlerEvent } from '@netlify/functions';
import { verifyMagicLinkSession, getCorsHeaders, getSupabaseAdmin } from './shared/utils';
import { canNotifyTarget } from './shared/pushAuth';

/**
 * Netlify Serverless Function to Send Push Notifications via OneSignal
 *
 * Caller authentication (F1): every POST must carry a valid Momentum session
 * token (Authorization: Bearer <momentum_session_token>). Anonymous callers get
 * 401 before any OneSignal work happens.
 *
 * Error responses never include upstream internals (F19): OneSignal response
 * text is logged server-side only; clients get generic `{ error }` bodies.
 */
const handler: Handler = async (event: HandlerEvent) => {
    const headers = getCorsHeaders(event.headers['origin']);

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

    // Caller auth (F1) — same session verification as the AI functions
    const authHeader = event.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Unauthorized: Missing or invalid authorization header' }),
        };
    }
    const sessionToken = authHeader.substring(7);
    const userId = await verifyMagicLinkSession(sessionToken);
    if (!userId) {
        console.warn('[send-push-notification] Rejected unauthenticated request');
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Unauthorized: Invalid or expired session' }),
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

        console.log('[send-push-notification] Authenticated request:', {
            userId,
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

        // Push-target authorization (P1-6b): the caller may only notify users
        // they have a real relationship with (self, accepted friend either
        // direction, or a shared active project). Verified from the DB —
        // caller-supplied context is never trusted for authorization.
        const targetId = Number(externalUserId);
        if (!Number.isFinite(targetId)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: externalUserId, title, message' }),
            };
        }
        const allowed = await canNotifyTarget(getSupabaseAdmin(), userId, targetId);
        if (!allowed) {
            console.warn('[send-push-notification] Target authorization denied:', { userId, targetId });
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'Not allowed to notify this user' }),
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
            // F19: full detail logged above; clients get a generic error only.
            console.error('[send-push-notification] OneSignal error:', response.status, responseText);
            return {
                statusCode: 502,
                headers,
                body: JSON.stringify({ error: 'Failed to send push notification' }),
            };
        }

        const result = JSON.parse(responseText);

        // Check for the common "not subscribed" error
        if (result.errors && result.errors.includes('All included players are not subscribed')) {
            console.error('[send-push-notification] ⚠️ EXTERNAL ID NOT FOUND:', externalUserId);
            console.error('[send-push-notification] This means no OneSignal subscription has external_id:', externalUserId);
            return {
                statusCode: 200, // Not a server error — the user just has no subscription
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'No subscription found for user',
                    externalUserId,
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
