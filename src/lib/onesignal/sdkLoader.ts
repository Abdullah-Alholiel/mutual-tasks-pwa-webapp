// ============================================================================
// OneSignal SDK loader — the ONLY dynamic import of 'react-onesignal'.
// ============================================================================
// Isolated behind a function so:
//  - nothing else in the app graph can pull the module statically (the module
//    injects the CDN script at import time), and
//  - tests can simulate a hanging cdn.onesignal.com by patching this loader
//    (see tests/lib/oneSignalService.test.ts) without module-resolution tricks.
// ============================================================================

type OneSignalSdk = (typeof import('react-onesignal'))['default'];

export type { OneSignalSdk };

export function loadOneSignalModule(): Promise<{ default: OneSignalSdk }> {
    return import('react-onesignal');
}
