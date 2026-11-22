// ============================================================================
// OneSignal Push Notification Service (non-blocking load — D-024)
// ============================================================================
// The OneSignal SDK must NEVER delay or blank the app:
//  - index.html does not load the SDK (removed 2026-11-15, run 10).
//  - react-onesignal injects the CDN script AT MODULE-IMPORT TIME, so the
//    module is only ever loaded through a dynamic import() below — never a
//    static import — and that import is raced against a hard timeout.
//  - If cdn.onesignal.com hangs or is blocked, initialization gives up and
//    push simply stays OFF for this visit; the app renders normally.
//  - A failed load is sticky for the page visit (no repeated timeout stalls);
//    non-timeout init failures stay retryable on the next call.
// ============================================================================

// Lazily-bound SDK instance. Typed through the module shape so no static
// import of 'react-onesignal' ever exists in the graph entry.
import { loadOneSignalModule, type OneSignalSdk } from './sdkLoader';

const CDN_SDK_HOST_HINT = 'cdn.onesignal.com';
// Hard cap on the SDK load + init steps. The owner's iPhone showed a 5.4 s
// first-load stall when the script rode the document parse (L4 evidence);
// anything slower than 2 s is treated as "unreachable this visit".
export const SDK_LOAD_TIMEOUT_MS = 2000;

// Timeout sentinel: a unique symbol, NOT undefined — the SDK's init() may
// legitimately resolve undefined and must not be misread as a timeout.
const TIMED_OUT = Symbol('onesignal-load-timed-out');

// Environment variable for OneSignal App ID (read lazily so tests can vary it)
function appId(): string {
    return (import.meta.env.VITE_ONESIGNAL_APP_ID || import.meta.env.ONESIGNAL_APP_ID) as string;
}

// Track initialization state
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;
let loadedSdk: OneSignalSdk | null = null;
// Sticky: CDN import timed out (or rejected) — do not retry this page visit.
let loadFailedForVisit = false;
let loadFailureLogged = false;
// Test-only host override (jsdom always reports localhost, which would make
// every init path vacuous in unit tests). Null in production.
let testHostOverride: string | null = null;

function resolveHost(): string {
    return testHostOverride ?? window.location.hostname;
}

function markLoadFailure(reason: unknown): void {
    loadFailedForVisit = true;
    if (!loadFailureLogged) {
        loadFailureLogged = true;
        console.warn(
            `[OneSignal] SDK unavailable (${reason}) — push stays off for this visit; app unaffected.`,
        );
    }
}

/**
 * Race a promise against the SDK timeout. On timeout resolves the TIMED_OUT
 * sentinel instead of rejecting — callers compare against it explicitly.
 */
async function withLoadTimeout<T>(p: Promise<T>, timeoutMs: number): Promise<T | typeof TIMED_OUT> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
    });
    try {
        return await Promise.race([p, timeout]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

/**
 * Dynamic-import the SDK via the single-site loader (this import is what
 * injects the CDN script), raced against the timeout.
 */
async function importSdk(timeoutMs: number): Promise<{ default: OneSignalSdk } | typeof TIMED_OUT> {
    return withLoadTimeout(loadOneSignalModule(), timeoutMs);
}

/**
 * Check if OneSignal is initialized and ready
 */
export function isOneSignalReady(): boolean {
    return (
        isInitialized &&
        !!loadedSdk &&
        !!appId() &&
        resolveHost() !== 'localhost'
    );
}

/**
 * Initialize OneSignal SDK — non-blocking, timeout-bounded.
 * Resolves (never rejects) even when the CDN is unreachable; callers may
 * still .catch() defensively.
 */
export async function initializeOneSignal(opts?: { loadTimeoutMs?: number }): Promise<void> {
    const timeoutMs = opts?.loadTimeoutMs ?? SDK_LOAD_TIMEOUT_MS;

    // Already fully initialized
    if (isInitialized) {
        return;
    }

    // Sticky failure: CDN never answered this visit — resolve immediately,
    // silently (logged once in markLoadFailure).
    if (loadFailedForVisit) {
        return;
    }

    // Validate App ID (no config → push off, app fine)
    if (!appId()) {
        console.error('[OneSignal] ONESIGNAL_APP_ID not configured');
        return;
    }

    // Skip on localhost (test override lets unit tests exercise the real path)
    if (resolveHost() === 'localhost') {
        return;
    }

    // Dedupe concurrent callers
    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = (async () => {
        try {
            // Step 1: load the SDK module (this injects the CDN script),
            // raced against the timeout so a hanging CDN cannot stall the app.
            const mod = await importSdk(timeoutMs);
            if (mod === TIMED_OUT || !mod?.default) {
                markLoadFailure(
                    mod === TIMED_OUT
                        ? `import did not settle within ${timeoutMs} ms`
                        : 'SDK module empty',
                );
                return;
            }
            const sdk: OneSignalSdk = mod.default;


            // Step 2: init, also raced — if it does not settle in time, treat
            // this attempt as failed but leave NON-sticky so a later call
            // retries. OneSignal tolerates re-init, so a late-settling first
            // init followed by a retry is safe (review finding, run 11).
            const initResult = await withLoadTimeout(
                sdk.init({
                    appId: appId(),
                    allowLocalhostAsSecureOrigin: true,
                    serviceWorkerPath: '/OneSignalSDKWorker.js',
                }),
                timeoutMs,
            );
            if (initResult === TIMED_OUT) {
                console.warn('[OneSignal] init did not settle in time — push off this visit');
                return;
            }

            loadedSdk = sdk;
            isInitialized = true;
            console.log('[OneSignal] Initialized successfully');
        } catch (loadError) {
            // Import outright rejected (DNS fail, 404, CSP block) — same
            // handling as a hang: sticky for this visit, app unaffected.
            markLoadFailure(loadError);
        } finally {
            // Allow a retry on the next explicit call unless the failure is
            // sticky (CDN unreachable) — those return early above.
            initializationPromise = null;
        }
    })();

    return initializationPromise;
}

/**
 * Schedule initialization AFTER first paint / when the browser is idle.
 * Called once from the app shell instead of the removed <script defer> tag.
 * Never throws; never runs synchronously.
 */
export function scheduleOneSignalInit(): void {
    const start = () => {
        initializeOneSignal().catch((err) => {
            console.warn('[OneSignal] Deferred init error (non-fatal):', err);
        });
    };

    // After the document has painted, wait for idle (with a hard cap so a
    // never-idle tab still gets push within a few seconds).
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => start(), { timeout: 4000 });
    } else {
        setTimeout(start, 2000);
    }
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

    // Wait for/trigger initialization (timeout-bounded, never hangs the app)
    if (initializationPromise) {
        await initializationPromise;
    } else {
        await initializeOneSignal();
    }

    if (!isOneSignalReady() || !loadedSdk) {
        console.log('[OneSignal] Not available (unreachable, not configured, or localhost)');
        return;
    }
    const OneSignal = loadedSdk;

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
        await loadedSdk!.logout();
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
    return loadedSdk!.Notifications.isPushSupported();
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
    return loadedSdk!.User.PushSubscription.optedIn ?? false;
}

/**
 * Get the OneSignal subscription ID
 */
export function getSubscriptionId(): string | null {
    if (!isOneSignalReady()) return null;
    return loadedSdk!.User.PushSubscription.id ?? null;
}

/**
 * Get the current external user ID
 */
export function getExternalUserId(): string | null {
    if (!isOneSignalReady()) return null;
    return loadedSdk!.User.externalId ?? null;
}

/**
 * Manually request push permission (for UI button)
 */
export async function requestPushPermission(): Promise<boolean> {
    if (!isOneSignalReady()) return false;
    const OneSignal = loadedSdk!;

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
        await loadedSdk!.User.PushSubscription.optOut();
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
    const OneSignal = loadedSdk!;

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
    if (!isOneSignalReady() || !loadedSdk) return () => { };

    const handler = () => {
        callback(loadedSdk!.User.PushSubscription.optedIn ?? false);
    };

    loadedSdk.User.PushSubscription.addEventListener('change', handler);
    return () => loadedSdk!.User.PushSubscription.removeEventListener('change', handler);
}

// Test/inspection hooks (not part of the app contract)
export function __getSdkLoadState() {
    return {
        isInitialized,
        hasSdk: !!loadedSdk,
        loadFailedForVisit,
        cdnHint: CDN_SDK_HOST_HINT,
    };
}

/** TEST-ONLY: override the hostname the service sees (jsdom = localhost). */
export function __setTestHost(host: string | null): void {
    testHostOverride = host;
}
