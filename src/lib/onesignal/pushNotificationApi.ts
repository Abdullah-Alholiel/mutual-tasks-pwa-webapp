// ============================================================================
// OneSignal Push Notification API Utility
// ============================================================================
// Sends push notifications via the Express API server
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
 * Send a push notification to a specific user via the Express API server.
 * The server securely holds the OneSignal REST API key.
 * Requires authentication via Bearer token in the Authorization header.
 */
export async function sendPushNotification(payload: PushNotificationPayload): Promise<boolean> {
    try {
        const response = await fetch('/api/send-push-notification', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        // Handle 404 (endpoint not available — e.g. dev without API server)
        if (response.status === 404) {
            console.warn('[Push] API endpoint not found (404)');
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
        console.error('[Push] Error:', error);
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

