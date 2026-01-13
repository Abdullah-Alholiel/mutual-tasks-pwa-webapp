// ============================================================================
// OneSignal Push Notification API Utility
// ============================================================================
// Sends push notifications via OneSignal REST API
// Used server-side or client-side when creating notifications
// ============================================================================

const ONESIGNAL_APP_ID = (import.meta.env.VITE_ONESIGNAL_APP_ID || import.meta.env.ONESIGNAL_APP_ID) as string;
const ONESIGNAL_REST_API_KEY = (import.meta.env.VITE_ONESIGNAL_REST_API_KEY || import.meta.env.ONESIGNAL_REST_API_KEY) as string;

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
 * Send a push notification to a specific user via OneSignal REST API
 * Note: This requires the REST API key to be configured
 */
export async function sendPushNotification(payload: PushNotificationPayload): Promise<boolean> {
    // Skip if not configured
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
        console.warn('[OneSignal Push] REST API not configured. Skipping push notification.');
        return false;
    }

    try {
        const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
            },
            body: JSON.stringify({
                app_id: ONESIGNAL_APP_ID,
                // Target by external user ID
                include_aliases: {
                    external_id: [String(payload.externalUserId)],
                },
                target_channel: 'push',
                // Notification content
                headings: { en: payload.title },
                contents: { en: payload.message },
                // Optional URL
                ...(payload.url && { url: payload.url }),
                // Optional icon (defaults to app icon)
                small_icon: payload.icon || '/icons/icon-192x192.png',
                large_icon: payload.icon || '/icons/icon-192x192.png',
                // Optional data payload
                ...(payload.data && { data: payload.data }),
                // iOS specific
                ios_badgeType: 'Increase',
                ios_badgeCount: 1,
            }),
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('[OneSignal Push] Failed to send notification:', response.status, errorData);
            return false;
        }

        const result = await response.json();
        console.log('[OneSignal Push] Notification sent successfully:', result.id);
        return true;
    } catch (error) {
        console.error('[OneSignal Push] Error sending notification:', error);
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
