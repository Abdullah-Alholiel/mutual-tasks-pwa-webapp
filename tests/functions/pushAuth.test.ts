// F1 + P1-6b regression tests: push endpoint must reject unauthenticated
// callers AND authenticated callers targeting users they have no
// relationship with. Runs the TypeScript function source directly under
// vitest (jsdom-free, node fetch).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyMock = vi.fn();
const fetchMock = vi.fn();
const canNotifyMock = vi.fn();

vi.mock('../../netlify/functions/shared/utils', () => ({
    verifyMagicLinkSession: (...args: unknown[]) => verifyMock(...args),
    getCorsHeaders: (origin?: string | null) => ({
        'Access-Control-Allow-Headers': 'Content-Type, authorization, x-user-timezone',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        ...(origin && { 'Access-Control-Allow-Origin': origin }),
    }),
    getSupabaseAdmin: () => ({ from: () => { throw new Error('admin client should be mocked away'); } }),
}));

vi.mock('../../netlify/functions/shared/pushAuth', () => ({
    canNotifyTarget: (...args: unknown[]) => canNotifyMock(...args),
}));

// Netlify Handler types reference ambient netlify globals — keep tsc happy in tests
// by casting the event/context args at call sites.
import type { Handler } from '@netlify/functions';
import { handler } from '../../netlify/functions/send-push-notification';
const pushHandler = handler as Handler;

type HandlerResult = { statusCode: number; body: string };
const call = (event: Record<string, unknown>): Promise<HandlerResult> =>
    pushHandler(event as unknown as Parameters<Handler>[0], {} as never) as Promise<HandlerResult>;

const mkEvent = (overrides: Record<string, unknown> = {}) =>
    ({
        httpMethod: 'POST',
        headers: {} as Record<string, string>,
        body: JSON.stringify({ externalUserId: 42, title: 'T', message: 'M' }),
        ...overrides,
    });

describe('send-push-notification caller auth (F1) + target auth (P1-6b)', () => {
    beforeEach(() => {
        verifyMock.mockReset();
        fetchMock.mockReset();
        canNotifyMock.mockReset();
        // default: relationship verified — target-auth tests override this
        canNotifyMock.mockResolvedValue(true);
        vi.stubGlobal('fetch', fetchMock);
        vi.stubEnv('ONESIGNAL_APP_ID', 'test-app-id');
        vi.stubEnv('ONESIGNAL_REST_API_KEY', 'test-rest-key');
    });

    it('401 when no Authorization header', async () => {
        const res = await call(mkEvent());
        expect(res.statusCode).toBe(401);
        const body = JSON.parse(res.body);
        expect(Object.keys(body)).toEqual(['error']);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('401 when token invalid/expired — OneSignal never called', async () => {
        verifyMock.mockResolvedValue(null);
        const res = await call(mkEvent({ headers: { authorization: 'Bearer bad' } }));
        expect(res.statusCode).toBe(401);
        expect(verifyMock).toHaveBeenCalledWith('bad');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('403 when caller has no relationship with the target (P1-6b) — OneSignal never called', async () => {
        verifyMock.mockResolvedValue(42);
        canNotifyMock.mockResolvedValue(false);
        const res = await call(
            mkEvent({ headers: { authorization: 'Bearer good' }, body: JSON.stringify({ externalUserId: 777, title: 'spoof', message: 'you won crypto' }) })
        );
        expect(res.statusCode).toBe(403);
        expect(canNotifyMock).toHaveBeenCalled();
        const body = JSON.parse(res.body);
        expect(Object.keys(body)).toEqual(['error']);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('passes caller + numeric target to canNotifyTarget and calls OneSignal when allowed', async () => {
        verifyMock.mockResolvedValue(42);
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'os1', recipients: 1 }), { status: 200 }));
        const res = await call(
            mkEvent({ headers: { authorization: 'Bearer good' }, body: JSON.stringify({ externalUserId: 99, title: 'T', message: 'M' }) })
        );
        expect(canNotifyMock).toHaveBeenCalledWith(expect.anything(), 42, 99);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
    });

    it('400 when externalUserId is not a number (no OneSignal call)', async () => {
        verifyMock.mockResolvedValue(42);
        const res = await call(
            mkEvent({ headers: { authorization: 'Bearer good' }, body: JSON.stringify({ externalUserId: 'not-a-number', title: 'T', message: 'M' }) })
        );
        expect(res.statusCode).toBe(400);
        expect(canNotifyMock).not.toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('missing fields → 400 before authorization', async () => {
        verifyMock.mockResolvedValue(42);
        const res = await call(
            mkEvent({ headers: { authorization: 'Bearer good' }, body: JSON.stringify({ externalUserId: 42 }) })
        );
        expect(res.statusCode).toBe(400);
        expect(canNotifyMock).not.toHaveBeenCalled();
    });

    it('OPTIONS preflight returns 200', async () => {
        const res = await call(mkEvent({ httpMethod: 'OPTIONS' }));
        expect(res.statusCode).toBe(200);
    });

    it('OneSignal failure → 502 generic error (F19: no internals in body)', async () => {
        verifyMock.mockResolvedValue(42);
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ errors: ['boom', 'secret-detail'] }), { status: 500 }));
        const res = await call(mkEvent({ headers: { authorization: 'Bearer good' } }));
        expect(res.statusCode).toBe(502);
        const body = JSON.parse(res.body);
        expect(Object.keys(body)).toEqual(['error']);
        expect(JSON.stringify(body)).not.toContain('secret-detail');
    });

    it('not-subscribed → 200 success:false (unchanged contract)', async () => {
        verifyMock.mockResolvedValue(42);
        fetchMock.mockResolvedValue(
            new Response(JSON.stringify({ errors: ['All included players are not subscribed'] }), { status: 200 })
        );
        const res = await call(mkEvent({ headers: { authorization: 'Bearer good' } }));
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(false);
    });
});
