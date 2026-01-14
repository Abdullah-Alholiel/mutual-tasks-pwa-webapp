// ============================================================================
// OneSignal Push Notification Service
// ============================================================================
// Centralized service for managing OneSignal Web Push notifications.
// Handles initialization, subscription management, and external user ID sync.
// Supports multiple devices per user.
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
 * - External ID was previously assigned to different user
 * - Multiple devices per user (each device gets its own subscription)
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
        const currentExternalId = OneSignal.User.externalId;

        console.log('[OneSignal] Current state:', {
            permission,
            optedIn,
            subscriptionId: subscriptionId?.substring(0, 15),
            currentExternalId,
            targetUserId: userId,
        });

        // If already correctly assigned to THIS user, skip
        if (String(currentExternalId) === String(userId) && optedIn && subscriptionId) {
            console.log('[OneSignal] ✅ Already correctly configured for user:', userId);
            return;
        }

        // Step 1: Handle permission
        if (permission === 'default') {
            console.log('[OneSignal] Requesting native permission...');
            const result = await Notification.requestPermission();
            console.log('[OneSignal] Native permission result:', result);
            if (result !== 'granted') {
                console.log('[OneSignal] Permission not granted');
                return;
            }
        } else if (permission === 'denied') {
            console.log('[OneSignal] Permission denied - user must enable in browser settings');
            return;
        }

        // Step 2: Ensure opted in
        if (!optedIn) {
            console.log('[OneSignal] Opting in to push...');
            try {
                await OneSignal.User.PushSubscription.optIn();
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (optInError) {
                console.log('[OneSignal] OptIn note:', optInError);
            }
        }

        // Step 3: Handle external ID assignment
        // If a DIFFERENT user is assigned, we need to clear and reassign
        if (currentExternalId && String(currentExternalId) !== String(userId)) {
            console.log('[OneSignal] Subscription belongs to different user:', currentExternalId);
            console.log('[OneSignal] Attempting to reassign to user:', userId);

            // Logout to clear previous assignment
            try {
                await OneSignal.logout();
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (e) {
                console.log('[OneSignal] Logout note:', e);
            }
        }

        // Step 4: Login with user ID
        console.log('[OneSignal] Logging in with external user ID:', userId);
        let loginSuccess = false;

        try {
            await OneSignal.login(String(userId));
            await new Promise(resolve => setTimeout(resolve, 1000));
            loginSuccess = true;
        } catch (loginError: unknown) {
            console.error('[OneSignal] Login failed:', loginError);

            // If login fails, the subscription is "stuck" with previoususer
            // Force a fresh subscription by opting out and back in
            console.log('[OneSignal] Attempting subscription reset...');
            try {
                await OneSignal.User.PushSubscription.optOut();
                await new Promise(resolve => setTimeout(resolve, 500));
                await OneSignal.User.PushSubscription.optIn();
                await new Promise(resolve => setTimeout(resolve, 500));
                await OneSignal.login(String(userId));
                await new Promise(resolve => setTimeout(resolve, 1000));
                loginSuccess = true;
                console.log('[OneSignal] Subscription reset successful');
            } catch (resetError) {
                console.error('[OneSignal] Subscription reset failed:', resetError);
            }
        }

        // Verify final state
        const finalSubscriptionId = OneSignal.User.PushSubscription.id;
        const finalOptedIn = OneSignal.User.PushSubscription.optedIn;
        const finalExternalId = OneSignal.User.externalId;

        console.log('[OneSignal] Final subscription state:', {
            requestedUserId: userId,
            assignedExternalId: finalExternalId,
            subscriptionId: finalSubscriptionId?.substring(0, 15),
            optedIn: finalOptedIn,
            loginSuccess,
        });

        // Log result
        if (String(finalExternalId) === String(userId) && finalSubscriptionId) {
            console.log('[OneSignal] ✅ Push subscription linked to user:', userId);
        } else if (finalSubscriptionId && finalOptedIn) {
            console.warn('[OneSignal] ⚠️ Subscription active but external ID may not match');
            console.warn('[OneSignal] Push notifications may not target this user correctly');
            console.warn('[OneSignal] Try clearing site data and re-subscribing');
        } else {
            console.error('[OneSignal] ❌ No active subscription');
        }

    } catch (error) {
        console.error('[OneSignal] Error in ensurePushSubscription:', error);
    }
}

/**
 * Set external user ID - alias for ensurePushSubscription
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
 * Get the current external user ID
 */
export function getExternalUserId(): string | null {
    if (!isOneSignalReady()) return null;
    return OneSignal.User.externalId ?? null;
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
 * Force reset subscription (opt out + opt in)
 * Use when subscription is stuck or corrupted
 */
export async function resetSubscription(): Promise<void> {
    if (!isOneSignalReady()) return;

    try {
        console.log('[OneSignal] Resetting subscription...');
        await OneSignal.User.PushSubscription.optOut();
        await new Promise(resolve => setTimeout(resolve, 500));
        await OneSignal.User.PushSubscription.optIn();
        console.log('[OneSignal] Subscription reset complete');
    } catch (error) {
        console.error('[OneSignal] Subscription reset failed:', error);
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
