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
 * Should be called once at app startup, after authentication is ready
 */
export async function initializeOneSignal(): Promise<void> {
    console.log('🔔 [OneSignal] ========== INITIALIZATION START ==========');
    console.log('🔔 [OneSignal] Current URL:', window.location.href);
    console.log('🔔 [OneSignal] Protocol:', window.location.protocol);
    console.log('🔔 [OneSignal] Is HTTPS:', window.location.protocol === 'https:');
    console.log('🔔 [OneSignal] Is Localhost:', window.location.hostname === 'localhost');
    console.log('🔔 [OneSignal] DEV mode:', import.meta.env.DEV);
    console.log('🔔 [OneSignal] PROD mode:', import.meta.env.PROD);

    // Return existing promise if already initializing
    if (initializationPromise) {
        console.log('🔔 [OneSignal] Already initializing, returning existing promise');
        return initializationPromise;
    }

    // Skip if already initialized
    if (isInitialized) {
        console.log('🔔 [OneSignal] Already initialized, skipping');
        return Promise.resolve();
    }

    // Validate App ID
    console.log('🔔 [OneSignal] App ID from env:', ONESIGNAL_APP_ID ? `${ONESIGNAL_APP_ID}` : 'MISSING');
    console.log('🔔 [OneSignal] VITE_ONESIGNAL_APP_ID:', import.meta.env.VITE_ONESIGNAL_APP_ID || 'NOT SET');
    console.log('🔔 [OneSignal] ONESIGNAL_APP_ID:', import.meta.env.ONESIGNAL_APP_ID || 'NOT SET');

    if (!ONESIGNAL_APP_ID) {
        console.error('❌ [OneSignal] ONESIGNAL_APP_ID not configured. Push notifications disabled.');
        console.log('🔔 [OneSignal] ========== INITIALIZATION ABORTED ==========');
        return Promise.resolve();
    }

    // Check browser support
    console.log('🔔 [OneSignal] Checking browser support...');
    console.log('🔔 [OneSignal] Service Worker supported:', 'serviceWorker' in navigator);
    console.log('🔔 [OneSignal] Push API supported:', 'PushManager' in window);
    console.log('🔔 [OneSignal] Notification API supported:', 'Notification' in window);

    if ('Notification' in window) {
        console.log('🔔 [OneSignal] Current notification permission:', Notification.permission);
    }

    initializationPromise = (async () => {
        try {
            console.log('🔔 [OneSignal] Calling OneSignal.init()...');

            await OneSignal.init({
                appId: ONESIGNAL_APP_ID,
                // Safari web ID (optional, for Safari desktop)
                safari_web_id: undefined,
                // Allow localhost for development
                allowLocalhostAsSecureOrigin: true, // Always allow for debugging
                // Service worker configuration
                serviceWorkerPath: '/OneSignalSDKWorker.js',
                // Prompt options
                promptOptions: {
                    slidedown: {
                        prompts: [
                            {
                                type: 'push',
                                autoPrompt: true, // Automatically show the permission prompt
                                text: {
                                    actionMessage: 'Get notified about task updates, friend requests, and more!',
                                    acceptButton: 'Allow',
                                    cancelButton: 'Later',
                                },
                                delay: {
                                    pageViews: 1,
                                    timeDelay: 3,
                                },
                            },
                        ],
                    },
                },
            });

            isInitialized = true;
            console.log('✅ [OneSignal] Initialized successfully!');

            // Check subscription state after init
            console.log('🔔 [OneSignal] Checking post-init state...');
            console.log('🔔 [OneSignal] isPushSupported:', OneSignal.Notifications.isPushSupported());
            console.log('🔔 [OneSignal] permission:', OneSignal.Notifications.permission);
            console.log('🔔 [OneSignal] optedIn:', OneSignal.User.PushSubscription.optedIn);
            console.log('🔔 [OneSignal] subscriptionId:', OneSignal.User.PushSubscription.id);

            // Always enable debug logging for troubleshooting
            console.log('🔔 [OneSignal] Enabling debug mode...');
            OneSignal.Debug.setLogLevel('trace');

            console.log('🔔 [OneSignal] ========== INITIALIZATION COMPLETE ==========');
        } catch (error) {
            console.error('❌ [OneSignal] Initialization failed:', error);
            console.log('🔔 [OneSignal] ========== INITIALIZATION FAILED ==========');
            throw error;
        }
    })();

    return initializationPromise;
}

/**
 * Check if OneSignal is initialized and ready
 */
export function isOneSignalReady(): boolean {
    return isInitialized && !!ONESIGNAL_APP_ID;
}

/**
 * Set external user ID to link OneSignal subscription with app user
 * This allows targeting specific users for push notifications
 */
export async function setExternalUserId(userId: string | number): Promise<void> {
    if (!isOneSignalReady()) {
        console.warn('[OneSignal] Cannot set external user ID - not initialized');
        return;
    }

    try {
        await OneSignal.login(String(userId));
        console.log('[OneSignal] External user ID set:', userId);
    } catch (error) {
        console.error('[OneSignal] Failed to set external user ID:', error);
    }
}

/**
 * Remove external user ID on logout
 */
export async function removeExternalUserId(): Promise<void> {
    if (!isOneSignalReady()) return;

    try {
        await OneSignal.logout();
        console.log('[OneSignal] External user ID removed');
    } catch (error) {
        console.error('[OneSignal] Failed to remove external user ID:', error);
    }
}

/**
 * Check if push notifications are supported on this device/browser
 */
export function isPushSupported(): boolean {
    return OneSignal.Notifications.isPushSupported();
}

/**
 * Get current notification permission state
 * Returns: 'default' | 'granted' | 'denied'
 */
export async function getPermissionState(): Promise<NotificationPermission> {
    if (!isOneSignalReady()) return 'default';
    return OneSignal.Notifications.permission ? 'granted' : 'default';
}

/**
 * Check if user is currently subscribed to push notifications
 */
export async function isSubscribed(): Promise<boolean> {
    if (!isOneSignalReady()) return false;
    return OneSignal.User.PushSubscription.optedIn ?? false;
}

/**
 * Get the OneSignal player ID (subscription ID)
 */
export async function getPlayerId(): Promise<string | null> {
    if (!isOneSignalReady()) return null;
    return OneSignal.User.PushSubscription.id ?? null;
}

/**
 * Request push notification permission and subscribe
 * Returns true if successful, false otherwise
 */
export async function requestPushPermission(): Promise<boolean> {
    if (!isOneSignalReady()) {
        console.warn('[OneSignal] Cannot request permission - not initialized');
        return false;
    }

    try {
        // Show the native permission prompt
        await OneSignal.Notifications.requestPermission();

        // Opt-in to push
        await OneSignal.User.PushSubscription.optIn();

        const subscribed = await isSubscribed();
        console.log('[OneSignal] Push permission result:', subscribed ? 'subscribed' : 'not subscribed');
        return subscribed;
    } catch (error) {
        console.error('[OneSignal] Failed to request push permission:', error);
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
        console.log('[OneSignal] Unsubscribed from push');
    } catch (error) {
        console.error('[OneSignal] Failed to unsubscribe:', error);
    }
}

/**
 * Add a listener for subscription changes
 */
export function onSubscriptionChange(callback: (isSubscribed: boolean) => void): () => void {
    if (!isOneSignalReady()) return () => { };

    const handler = () => {
        callback(OneSignal.User.PushSubscription.optedIn ?? false);
    };

    OneSignal.User.PushSubscription.addEventListener('change', handler);

    return () => {
        OneSignal.User.PushSubscription.removeEventListener('change', handler);
    };
}

/**
 * Send a tag to OneSignal for user segmentation
 */
export async function setTag(key: string, value: string): Promise<void> {
    if (!isOneSignalReady()) return;

    try {
        await OneSignal.User.addTag(key, value);
    } catch (error) {
        console.error('[OneSignal] Failed to set tag:', error);
    }
}

/**
 * Remove a tag from OneSignal
 */
export async function removeTag(key: string): Promise<void> {
    if (!isOneSignalReady()) return;

    try {
        await OneSignal.User.removeTag(key);
    } catch (error) {
        console.error('[OneSignal] Failed to remove tag:', error);
    }
}

// Export OneSignal instance for advanced use cases
export { OneSignal };
