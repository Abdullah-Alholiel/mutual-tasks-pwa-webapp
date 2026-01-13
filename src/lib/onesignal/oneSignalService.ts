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
        console.error('❌ [OneSignal] ONESIGNAL_APP_ID not configured. Push notifications disabled.');
        return Promise.resolve();
    }

    // Skip on localhost to prevent "Can only be used on: https://..." error
    if (window.location.hostname === 'localhost') {
        return Promise.resolve();
    }

    initializationPromise = (async () => {
        try {

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
            console.log('✅ [OneSignal] Initialized successfully');

            // Enable debug logging only in development
            if (import.meta.env.DEV) {
                OneSignal.Debug.setLogLevel('trace');
            }
        } catch (error) {
            console.error('❌ [OneSignal] Initialization failed:', error);
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
    // Wait for initialization to complete first
    if (initializationPromise) {
        await initializationPromise;
    }

    if (!isOneSignalReady()) {
        // Try to initialize if not ready
        await initializeOneSignal();
    }

    if (!isOneSignalReady()) {
        // Still not ready - likely on localhost or not configured
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
