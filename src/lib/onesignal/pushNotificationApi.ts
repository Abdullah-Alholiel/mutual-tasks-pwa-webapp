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
 */
export async function sendPushNotification(payload: PushNotificationPayload): Promise<boolean> {
    try {
        const response = await fetch('/.netlify/functions/send-push-notification', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

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

