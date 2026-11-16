// ============================================================================
// OneSignal non-blocking load tests (D-024 / lane L4, run 10)
// ============================================================================
// The contract under test: a hanging or blocked cdn.onesignal.com must never
// delay or blank the app. initializeOneSignal() resolves within the timeout
// even when the SDK module never settles, marks the visit failed (sticky,
// logged once), and every consumer helper degrades to "not ready" instead of
// throwing. When the SDK DOES settle in time, init runs and readiness flips.
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

const SERVICE_PATH = '../../src/lib/onesignal/oneSignalService';

// Deterministic fake SDK returned by the loader mock when it "loads".
function makeSdk() {
    return {
        init: vi.fn(async () => true),
        Notifications: { isPushSupported: vi.fn(() => true), requestPermission: vi.fn() },
        User: {
            externalId: null as string | null,
            PushSubscription: {
                optedIn: false,
                id: null as string | null,
                optIn: vi.fn(),
                optOut: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            },
        },
        login: vi.fn(),
        logout: vi.fn(),
    };
}

// How the loader mock behaves per test: 'hang' = never settles (hanging CDN),
// 'ok' = resolves with a fresh SDK, or a number = resolves after N ms.
let loaderMode: 'hang' | 'ok' | number = 'hang';
let lastSdk: ReturnType<typeof makeSdk> | null = null;

beforeEach(() => {
    vi.useFakeTimers();
    loaderMode = 'hang';
    lastSdk = null;
    // Fresh per test: afterEach's unstubAllEnvs clears it, so re-stub here.
    vi.stubEnv('VITE_ONESIGNAL_APP_ID', 'test-app-id-1234');
    if (!('requestIdleCallback' in window)) {
        (window as unknown as Record<string, unknown>).requestIdleCallback = (
            cb: () => void,
        ) => window.setTimeout(cb, 0);
    }
});

// NOTE: the path must be a LITERAL — vi.mock is hoisted above every const
// and a referenced variable would hit its TDZ.
vi.mock('../../src/lib/onesignal/sdkLoader', () => ({
    loadOneSignalModule: (): Promise<unknown> => {
        if (loaderMode === 'hang') {
            return new Promise<never>(() => { }); // the hanging CDN
        }
        const delay = typeof loaderMode === 'number' ? loaderMode : 0;
        return new Promise((resolve) => {
            setTimeout(() => resolve({ default: (lastSdk = makeSdk()) }), delay);
        });
    },
}));

afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    vi.unstubAllEnvs();
});

async function freshService() {
    const mod = await import(SERVICE_PATH);
    // jsdom always reports localhost, which would make every init path
    // vacuous — pretend we are on the Pages preview for these tests.
    mod.__setTestHost('staging.social-momentum-8zq.pages.dev');
    return mod;
}

// ...except the localhost test, which needs the guard ACTIVE.
async function freshLocalService() {
    const mod = await import(SERVICE_PATH);
    mod.__setTestHost('localhost');
    return mod;
}

// Flush the promise chain through fake timers until `cond` holds or we run out.
async function pumpUntil(cond: () => boolean, maxMs = 5000): Promise<void> {
    for (let t = 0; t < maxMs && !cond(); t += 25) {
        await vi.advanceTimersByTimeAsync(25);
    }
    expect(cond()).toBe(true);
}

describe('initializeOneSignal — non-blocking contract (D-024)', () => {
    it('resolves within the timeout when the SDK import NEVER settles (hanging CDN)', async () => {
        const svc = await freshService();
        let settled = false;
        const p = svc.initializeOneSignal().then(() => { settled = true; });
        await pumpUntil(() => settled, 5000);
        const state = svc.__getSdkLoadState();
        expect(state.loadFailedForVisit).toBe(true);
        expect(state.hasSdk).toBe(false);
        expect(state.isInitialized).toBe(false);
        void p;
    });

    it('is sticky: the second call returns immediately without re-racing the CDN', async () => {
        const svc = await freshService();
        let settled = false;
        const p1 = svc.initializeOneSignal().then(() => { settled = true; });
        await pumpUntil(() => settled);
        expect(svc.__getSdkLoadState().loadFailedForVisit).toBe(true);

        const then = vi.getTimerCount();
        await svc.initializeOneSignal();
        // No new timer was started for the second call (no re-race).
        expect(vi.getTimerCount()).toBe(then);
    });

    it('degrades helpers to not-ready instead of throwing when the load failed', async () => {
        const svc = await freshService();
        let settled = false;
        const p = svc.initializeOneSignal().then(() => { settled = true; });
        await pumpUntil(() => settled);
        expect(svc.isOneSignalReady()).toBe(false);
        expect(svc.isPushSupported()).toBe(false);
        expect(svc.isSubscribed()).toBe(false);
        expect(svc.getSubscriptionId()).toBeNull();
        expect(svc.getExternalUserId()).toBeNull();
        await expect(svc.removeExternalUserId()).resolves.toBeUndefined();
        const off = svc.onSubscriptionChange(() => { });
        expect(typeof off).toBe('function');
        void p;
    });

    it('ensurePushSubscription resolves (no hang) when the CDN is unreachable', async () => {
        const svc = await freshService();
        let settled = false;
        const p = svc.ensurePushSubscription('user-1').then(() => { settled = true; });
        await pumpUntil(() => settled, 6000);
        void p;
    });

    it('initializes and reports ready when the SDK settles in time', async () => {
        loaderMode = 'ok';
        const svc = await freshService();
        let settled = false;
        const p = svc.initializeOneSignal().then(() => { settled = true; });
        await pumpUntil(() => settled, 3000);
        const state = svc.__getSdkLoadState();
        expect(state.isInitialized).toBe(true);
        expect(state.hasSdk).toBe(true);
        expect(state.loadFailedForVisit).toBe(false);
        expect(svc.isOneSignalReady()).toBe(true);
        void p;
    });

    it('a slow-but-successful SDK (1.5 s) still initializes under the 2 s cap', async () => {
        loaderMode = 1500;
        const svc = await freshService();
        let settled = false;
        const p = svc.initializeOneSignal().then(() => { settled = true; });
        await pumpUntil(() => settled, 4000);
        expect(svc.__getSdkLoadState().isInitialized).toBe(true);
        void p;
    });

    it('returns early when no app id is configured', async () => {
        vi.stubEnv('VITE_ONESIGNAL_APP_ID', '');
        const svc = await freshService();
        await expect(svc.initializeOneSignal()).resolves.toBeUndefined();
        const state = svc.__getSdkLoadState();
        expect(state.hasSdk).toBe(false);
        expect(state.isInitialized).toBe(false);
    });

    it('returns early on localhost (guard active)', async () => {
        const svc = await freshLocalService();
        await expect(svc.initializeOneSignal()).resolves.toBeUndefined();
        expect(svc.__getSdkLoadState().hasSdk).toBe(false);
    });
});

describe('scheduleOneSignalInit', () => {
    it('starts nothing synchronously and finishes failed-sticky on a hanging CDN', async () => {
        const svc = await freshService();
        svc.scheduleOneSignalInit();
        // Nothing loaded synchronously
        expect(svc.__getSdkLoadState().hasSdk).toBe(false);
        await pumpUntil(() => svc.__getSdkLoadState().loadFailedForVisit, 8000);
    });

    it('initializes from the idle callback when the CDN is reachable', async () => {
        loaderMode = 'ok';
        const svc = await freshService();
        svc.scheduleOneSignalInit();
        await pumpUntil(() => svc.__getSdkLoadState().isInitialized, 8000);
        expect(lastSdk!.init).toHaveBeenCalledTimes(1);
    });
});

describe('module-shape guard', () => {
    it('react-onesignal stays OUT of the static import graph (import-time script injection)', async () => {
        // fs scan: no source file outside sdkLoader.ts may statically import react-onesignal
        const fs = await import('node:fs');
        const path = await import('node:path');
        const root = path.resolve(__dirname, '../../src');
        const offenders: string[] = [];
        const walk = (dir: string) => {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, e.name);
                if (e.isDirectory()) walk(full);
                else if (/\.(ts|tsx)$/.test(e.name)) {
                    const text = fs.readFileSync(full, 'utf8');
                    if (/from\s+['"]react-onesignal['"]/.test(text) && !full.includes('sdkLoader')) {
                        offenders.push(full);
                    }
                }
            }
        };
        walk(root);
        expect(offenders).toEqual([]);
    });
});

// Keep the Mock type import referenced (lint hygiene for strict configs).
export type { Mock };
