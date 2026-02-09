// ============================================================================
// OneSignal Push Notification API Utility
// ============================================================================
// Sends push notifications via Netlify serverless function
// The API key is securely stored server-side
// ============================================================================

export interface PushNotificationPayload {
    /** Target user's external ID (Supabase user ID) */
    externalUserId: string | number;
    /** Notification title */
    title: string;
    /** Notification body message */
    message: string;
    /** Optional URL to open when clicked */
    url?: string;
    /** Optional icon URL */
    icon?: string;
    /** Optional data payload */
    data?: Record<string, unknown>;
}

/**
 * Send a push notification to a specific user via Netlify serverless function
 * The function securely holds the OneSignal REST API key
 * 
 * Note: This will fail gracefully on localhost since Netlify functions require
 * either `netlify dev` or deployed environment.
 */
export async function sendPushNotification(payload: PushNotificationPayload): Promise<boolean> {
    // Skip on localhost where Netlify functions aren't available
    const isLocalhost = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

    if (isLocalhost) {
        console.debug('[Push] Skipped on localhost - Netlify functions not available');
        return false;
    }

    try {
        const response = await fetch('/.netlify/functions/send-push-notification', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        // Handle 404 (function not found) - common on localhost
        if (response.status === 404) {
            console.warn('[Push] Netlify function not found (404)');
            return false;
        }

        // Safely parse JSON response
        let result;
        try {
            const text = await response.text();
            result = text ? JSON.parse(text) : { success: false };
        } catch {
            console.warn('[Push] Failed to parse response');
            return false;
        }

        if (!response.ok || !result.success) {
            console.error('[Push] Failed:', result);
            return false;
        }

        return true;
    } catch (error) {
        // Network errors are expected on localhost
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.debug('[Push] Network error (localhost):', (error as Error).message);
        } else {
            console.error('[Push] Error:', error);
        }
        return false;
    }
}

/**
 * Send multiple push notifications in batch
 */
export async function sendPushNotificationBatch(
    payloads: PushNotificationPayload[]
): Promise<{ success: number; failed: number }> {
    const results = await Promise.allSettled(
        payloads.map(payload => sendPushNotification(payload))
    );

    return results.reduce(
        (acc, result) => {
            if (result.status === 'fulfilled' && result.value) {
                acc.success++;
            } else {
                acc.failed++;
            }
            return acc;
        },
        { success: 0, failed: 0 }
    );
}

