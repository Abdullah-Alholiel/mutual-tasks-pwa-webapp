// ============================================================================
// OneSignal Push Notification Service
// ============================================================================
// Centralized service for managing OneSignal Web Push notifications.
// Handles initialization, subscription management, and external user ID sync.
// ============================================================================

import OneSignal from 'react-onesignal';

// Environment variable for OneSignal App ID
const ONESIGNAL_APP_ID = (import.meta.env.VITE_ONESIGNAL_APP_ID || import.meta.env.ONESIGNAL_APP_ID) as string;

// Track initialization state
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize OneSignal SDK
 * Should be called once at app startup
 */
export async function initializeOneSignal(): Promise<void> {
    // Return existing promise if already initializing
    if (initializationPromise) {
        return initializationPromise;
    }

    // Skip if already initialized
    if (isInitialized) {
        return Promise.resolve();
    }

    // Validate App ID
    if (!ONESIGNAL_APP_ID) {
        console.error('[OneSignal] ONESIGNAL_APP_ID not configured');
        return Promise.resolve();
    }

    // Skip on localhost
    if (window.location.hostname === 'localhost') {
        return Promise.resolve();
    }

    initializationPromise = (async () => {
        try {
            await OneSignal.init({
                appId: ONESIGNAL_APP_ID,
                allowLocalhostAsSecureOrigin: true,
                serviceWorkerPath: '/OneSignalSDKWorker.js',
            });

            isInitialized = true;
            console.log('[OneSignal] Initialized successfully');
        } catch (error) {
            console.error('[OneSignal] Initialization failed:', error);
            throw error;
        }
    })();

    return initializationPromise;
}

/**
 * Check if OneSignal is initialized and ready
 */
export function isOneSignalReady(): boolean {
    return isInitialized && !!ONESIGNAL_APP_ID && window.location.hostname !== 'localhost';
}

/**
 * Ensure user is subscribed and linked to their app user ID
 * This is the main function to call after user authentication
 * 
 * Handles edge cases:
 * - User previously dismissed the prompt
 * - Subscription was deleted from OneSignal dashboard
 * - Permission granted but not opted in
 */
export async function ensurePushSubscription(userId: string | number): Promise<void> {
    console.log('[OneSignal] ensurePushSubscription called for user:', userId);

    // Wait for/trigger initialization
    if (initializationPromise) {
        await initializationPromise;
    } else {
        await initializeOneSignal();
    }

    if (!isOneSignalReady()) {
        console.log('[OneSignal] Not available (localhost or not configured)');
        return;
    }

    try {
        const isPushSupported = OneSignal.Notifications.isPushSupported();
        if (!isPushSupported) {
            console.log('[OneSignal] Push not supported on this browser');
            return;
        }

        // Check current state
        const permission = Notification.permission;
        const optedIn = OneSignal.User.PushSubscription.optedIn;
        const subscriptionId = OneSignal.User.PushSubscription.id;

        console.log('[OneSignal] Current state:', {
            permission,
            optedIn,
            subscriptionId: subscriptionId?.substring(0, 15)
        });

        // Step 1: Handle permission
        if (permission === 'default') {
            // Use native browser API to bypass OneSignal's "previously dismissed" check
            console.log('[OneSignal] Requesting native permission...');
            const result = await Notification.requestPermission();
            console.log('[OneSignal] Native permission result:', result);
        } else if (permission === 'denied') {
            console.log('[OneSignal] Permission denied - user must enable in browser settings');
            return;
        }

        // Step 2: Force opt-in if permission granted
        const currentPermission = Notification.permission;
        if (currentPermission === 'granted') {
            // Always try to opt in - this recreates subscription if it was deleted
            console.log('[OneSignal] Forcing opt-in...');
            try {
                await OneSignal.User.PushSubscription.optIn();
            } catch (optInError) {
                console.log('[OneSignal] OptIn error (may be already opted in):', optInError);
            }
        }

        // Step 3: Set external user ID (login)
        console.log('[OneSignal] Setting external user ID:', userId);
        await OneSignal.login(String(userId));

        // Wait a moment for subscription to register
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify final state
        const finalSubscriptionId = OneSignal.User.PushSubscription.id;
        const finalOptedIn = OneSignal.User.PushSubscription.optedIn;

        console.log('[OneSignal] ✅ Push subscription complete:', {
            userId,
            subscriptionId: finalSubscriptionId?.substring(0, 15),
            optedIn: finalOptedIn,
        });

        // If no subscription ID, there's an issue
        if (!finalSubscriptionId) {
            console.warn('[OneSignal] ⚠️ No subscription ID - subscription may not have been created');
        }

    } catch (error) {
        console.error('[OneSignal] Error in ensurePushSubscription:', error);
    }
}

/**
 * Set external user ID - wrapper for backward compatibility
 */
export async function setExternalUserId(userId: string | number): Promise<void> {
    return ensurePushSubscription(userId);
}

/**
 * Remove external user ID on logout
 */
export async function removeExternalUserId(): Promise<void> {
    if (!isOneSignalReady()) return;

    try {
        await OneSignal.logout();
        console.log('[OneSignal] Logged out');
    } catch (error) {
        console.error('[OneSignal] Logout failed:', error);
    }
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
    if (!isOneSignalReady()) return false;
    return OneSignal.Notifications.isPushSupported();
}

/**
 * Get current notification permission state
 */
export function getPermissionState(): NotificationPermission {
    return Notification.permission;
}

/**
 * Check if user is currently subscribed
 */
export function isSubscribed(): boolean {
    if (!isOneSignalReady()) return false;
    return OneSignal.User.PushSubscription.optedIn ?? false;
}

/**
 * Get the OneSignal subscription ID
 */
export function getSubscriptionId(): string | null {
    if (!isOneSignalReady()) return null;
    return OneSignal.User.PushSubscription.id ?? null;
}

/**
 * Manually request push permission (for UI button)
 */
export async function requestPushPermission(): Promise<boolean> {
    if (!isOneSignalReady()) return false;

    try {
        await OneSignal.Notifications.requestPermission();
        await OneSignal.User.PushSubscription.optIn();
        return OneSignal.User.PushSubscription.optedIn ?? false;
    } catch (error) {
        console.error('[OneSignal] Permission request failed:', error);
        return false;
    }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<void> {
    if (!isOneSignalReady()) return;

    try {
        await OneSignal.User.PushSubscription.optOut();
    } catch (error) {
        console.error('[OneSignal] Unsubscribe failed:', error);
    }
}

/**
 * Add listener for subscription changes
 */
export function onSubscriptionChange(callback: (isSubscribed: boolean) => void): () => void {
    if (!isOneSignalReady()) return () => { };

    const handler = () => {
        callback(OneSignal.User.PushSubscription.optedIn ?? false);
    };

    OneSignal.User.PushSubscription.addEventListener('change', handler);
    return () => OneSignal.User.PushSubscription.removeEventListener('change', handler);
}

// Export OneSignal instance for advanced use cases
export { OneSignal };
