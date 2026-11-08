// F1 regression test: push endpoint must reject unauthenticated callers.
// Runs the TypeScript function source directly under vitest (jsdom-free, node fetch).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('../../netlify/functions/shared/utils', () => ({
    verifyMagicLinkSession: (...args: unknown[]) => verifyMock(...args),
    getCorsHeaders: (origin?: string | null) => ({
        'Access-Control-Allow-Headers': 'Content-Type, authorization, x-user-timezone',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        ...(origin && { 'Access-Control-Allow-Origin': origin }),
    }),
}));

// Netlify Handler types reference ambient netlify globals — keep tsc happy in tests
// by casting the event/context args at call sites.
import type { Handler } from '@netlify/functions';
import { handler } from '../../netlify/functions/send-push-notification';
const pushHandler = handler as Handler;

const mkEvent = (overrides: Record<string, unknown> = {}) =>
    ({
        httpMethod: 'POST',
        headers: {} as Record<string, string>,
        body: JSON.stringify({ externalUserId: 'u1', title: 'T', message: 'M' }),
        ...overrides,
    }) as unknown as Parameters<Handler>[0];

describe('send-push-notification caller auth (F1)', () => {
    beforeEach(() => {
        verifyMock.mockReset();
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
        vi.stubEnv('ONESIGNAL_APP_ID', 'test-app-id');
        vi.stubEnv('ONESIGNAL_REST_API_KEY', 'test-rest-key');
    });

    it('401 when no Authorization header', async () => {
        const res = await pushHandler(mkEvent(), {} as never);
        expect(res.statusCode).toBe(401);
        const body = JSON.parse(res.body);
        expect(Object.keys(body)).toEqual(['error']);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('401 when token invalid/expired — OneSignal never called', async () => {
        verifyMock.mockResolvedValue(null);
        const res = await pushHandler(mkEvent({ headers: { authorization: 'Bearer bad' } }), {} as never);
        expect(res.statusCode).toBe(401);
        expect(verifyMock).toHaveBeenCalledWith('bad');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('calls OneSignal only with a valid session', async () => {
        verifyMock.mockResolvedValue(42);
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'os1', recipients: 1 }), { status: 200 }));
        const res = await handler(
            mkEvent({ headers: { authorization: 'Bearer good' } }),
            {} as never
        );
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body).toEqual({ success: true, id: 'os1', recipients: 1 });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const init = fetchMock.mock.calls[0][1];
        expect(init.headers['Authorization']).toMatch(/^Basic /);
    });

    it('never leaks OneSignal internals on upstream failure (F19)', async () => {
        verifyMock.mockResolvedValue(42);
        fetchMock.mockResolvedValue(
            new Response(JSON.stringify({ errors: ['secret upstream detail'] }), { status: 500 })
        );
        const res = await handler(
            mkEvent({ headers: { authorization: 'Bearer good' } }),
            {} as never
        );
        expect(res.statusCode).toBe(502);
        const body = JSON.parse(res.body);
        expect(Object.keys(body)).toEqual(['error']);
        expect(JSON.stringify(body)).not.toContain('secret upstream detail');
    });

    it('preflight OPTIONS needs no auth', async () => {
        const res = await pushHandler(mkEvent({ httpMethod: 'OPTIONS', body: undefined }), {} as never);
        expect(res.statusCode).toBe(200);
    });
});
