// P1-8 / F19 regression tests: AI function error responses must never leak
// upstream details — every error body is exactly { error: string }.
// Runs the TypeScript function source directly under vitest (jsdom-free).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyMock = vi.fn();
const rateLimitMock = vi.fn();
const incrementMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('../../netlify/functions/shared/utils', () => ({
    verifyMagicLinkSession: (...args: unknown[]) => verifyMock(...args),
    checkRateLimit: (...args: unknown[]) => rateLimitMock(...args),
    incrementUsage: (...args: unknown[]) => incrementMock(...args),
    getCorsHeaders: (origin?: string | null) => ({
        'Access-Control-Allow-Headers': 'Content-Type, authorization, x-user-timezone',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        ...(origin && { 'Access-Control-Allow-Origin': origin }),
    }),
    buildRateLimitResponse: (headers: Record<string, string>, limit: number) => ({
        statusCode: 429,
        headers,
        body: JSON.stringify({ error: 'Rate limit exceeded', limit, remaining: 0 }),
    }),
    AI_USAGE_LIMITS: { project_generation: 3, description_generation: 10 },
    getTodayDate: () => '2026-11-10',
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({ from: () => { throw new Error('admin client must be mocked away'); } }),
}));

import type { Handler } from '@netlify/functions';
import { handler as projectHandler } from '../../netlify/functions/ai-generate-project';
import { handler as descriptionHandler } from '../../netlify/functions/ai-generated-description';

type HandlerResult = { statusCode: number; headers: Record<string, string>; body: string };
const call = (h: Handler, event: Record<string, unknown>): Promise<HandlerResult> =>
    h(event as unknown as Parameters<Handler>[0], {} as never) as Promise<HandlerResult>;

const authedEvent = (body: Record<string, unknown>) => ({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer good-token' },
    body: JSON.stringify(body),
});

const okResponse = (text: string) => new Response(text, { status: 200 });

describe('F19: AI function error bodies expose exactly {error}', () => {
    beforeEach(() => {
        verifyMock.mockReset();
        rateLimitMock.mockReset();
        incrementMock.mockReset();
        fetchMock.mockReset();
        verifyMock.mockResolvedValue(42);
        rateLimitMock.mockResolvedValue({ allowed: true, limit: 3, remaining: 2 });
        vi.stubGlobal('fetch', fetchMock);
        vi.stubEnv('SUPABASE_URL', 'https://supabase.test');
        vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
        vi.stubEnv('x_momentum_secret', 'test-secret');
        vi.stubEnv('N8N_PROJECT_WEBHOOK_URL', 'https://n8n.test/webhook/project');
        vi.stubEnv('N8N_DESCRIPTION_WEBHOOK_URL', 'https://n8n.test/webhook/description');
    });

    it('ai-generate-project: 200 happy path passes n8n body through untouched', async () => {
        fetchMock.mockResolvedValue(okResponse('{"name":"Deep Work"}'));
        const res = await call(projectHandler as Handler, authedEvent({ description: 'build a reading habit' }));
        expect(res.statusCode).toBe(200);
        expect(res.body).toBe('{"name":"Deep Work"}');
        // F5: usage increments server-side on the SAME request as generation;
        // the header reports the post-increment remaining (2 of 3 used 1).
        expect(incrementMock).toHaveBeenCalledTimes(1);
        expect(res.headers['X-RateLimit-Remaining']).toBe('1');
    });

    it('ai-generate-project: 200 premium path skips increment and reports -1 unlimited', async () => {
        rateLimitMock.mockResolvedValue({ allowed: true, remaining: -1, limit: -1, used: 0 });
        fetchMock.mockResolvedValue(okResponse('{"name":"Deep Work"}'));
        const res = await call(projectHandler as Handler, authedEvent({ description: 'x' }));
        expect(res.statusCode).toBe(200);
        expect(incrementMock).not.toHaveBeenCalled();
        expect(res.headers['X-RateLimit-Remaining']).toBe('-1');
    });

    it('ai-generate-project: n8n fetch failure → 500, no details field, no upstream text', async () => {
        fetchMock.mockRejectedValue(new Error('ECONNREFUSED 10.0.0.12:5678'));
        const res = await call(projectHandler as Handler, authedEvent({ description: 'x' }));
        expect(res.statusCode).toBe(500);
        const body = JSON.parse(res.body);
        expect(Object.keys(body)).toEqual(['error']);
        expect(res.body).not.toContain('ECONNREFUSED');
    });

    it('ai-generate-project: n8n 5xx → 502, exactly {error}', async () => {
        fetchMock.mockResolvedValue(new Response('{"boom":true}', { status: 500, statusText: 'Internal Server Error' }));
        const res = await call(projectHandler as Handler, authedEvent({ description: 'x' }));
        expect(res.statusCode).toBe(502);
        expect(Object.keys(JSON.parse(res.body))).toEqual(['error']);
    });

    it('ai-generate-project: unexpected internal throw → 500, exactly {error}', async () => {
        rateLimitMock.mockRejectedValue(new Error('PGRST301 jwt expired (internal)'));
        const res = await call(projectHandler as Handler, authedEvent({ description: 'x' }));
        expect(res.statusCode).toBe(500);
        const body = JSON.parse(res.body);
        expect(Object.keys(body)).toEqual(['error']);
        expect(res.body).not.toContain('PGRST301');
    });

    it('ai-generated-description: n8n fetch failure → 500, exactly {error}', async () => {
        fetchMock.mockRejectedValue(new Error('getaddrinfo ENOTFOUND n8n.internal'));
        const res = await call(descriptionHandler as Handler, authedEvent({ title: 'Morning run', type: 'task' }));
        expect(res.statusCode).toBe(500);
        const body = JSON.parse(res.body);
        expect(Object.keys(body)).toEqual(['error']);
        expect(res.body).not.toContain('ENOTFOUND');
    });

    it('ai-generated-description: n8n 5xx → 502, exactly {error}', async () => {
        fetchMock.mockResolvedValue(new Response('upstream down', { status: 503, statusText: 'Service Unavailable' }));
        const res = await call(descriptionHandler as Handler, authedEvent({ title: 'Morning run' }));
        expect(res.statusCode).toBe(502);
        expect(Object.keys(JSON.parse(res.body))).toEqual(['error']);
    });

    it('ai-generated-description: 401 on bad session, exactly {error}, n8n never called', async () => {
        verifyMock.mockResolvedValue(null);
        const res = await call(descriptionHandler as Handler, authedEvent({ title: 'x' }));
        expect(res.statusCode).toBe(401);
        expect(Object.keys(JSON.parse(res.body))).toEqual(['error']);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('ai-generated-description: 200 success increments usage once and reports remaining-1', async () => {
        fetchMock.mockResolvedValue(okResponse('Run 20 minutes daily.'));
        const res = await call(descriptionHandler as Handler, authedEvent({ title: 'Morning run' }));
        expect(res.statusCode).toBe(200);
        expect(incrementMock).toHaveBeenCalledTimes(1);
        expect(res.headers['X-RateLimit-Remaining']).toBe('1');
    });
});

describe('P1-7: atomic quota (F4/F5/F11)', () => {
    beforeEach(() => {
        verifyMock.mockReset();
        rateLimitMock.mockReset();
        incrementMock.mockReset();
        fetchMock.mockReset();
        verifyMock.mockResolvedValue(42);
        rateLimitMock.mockResolvedValue({ allowed: true, limit: 3, remaining: 2 });
        vi.stubGlobal('fetch', fetchMock);
        vi.stubEnv('SUPABASE_URL', 'https://supabase.test');
        vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
        vi.stubEnv('x_momentum_secret', 'test-secret');
        vi.stubEnv('N8N_PROJECT_WEBHOOK_URL', 'https://n8n.test/webhook/project');
        vi.stubEnv('N8N_DESCRIPTION_WEBHOOK_URL', 'https://n8n.test/webhook/description');
    });

    it('ai-generate-project: usage-log failure still returns 200 content (over-count is safe, never fail delivery)', async () => {
        incrementMock.mockRejectedValue(new Error('ai_usage_logs down (internal)'));
        fetchMock.mockResolvedValue(okResponse('{"name":"Deep Work"}'));
        const res = await call(projectHandler as Handler, authedEvent({ description: 'x' }));
        expect(res.statusCode).toBe(200);
        expect(res.body).toBe('{"name":"Deep Work"}');
        expect(res.body).not.toContain('ai_usage_logs down');
    });

    it('ai-generate-project: n8n failure must NOT increment usage (F5 — pay only for delivered content)', async () => {
        fetchMock.mockResolvedValue(new Response('{"boom":true}', { status: 502, statusText: 'Bad Gateway' }));
        const res = await call(projectHandler as Handler, authedEvent({ description: 'x' }));
        expect(res.statusCode).toBe(502);
        expect(incrementMock).not.toHaveBeenCalled();
    });

    it('ai-confirm-usage: still accepts legacy client timezone header and returns UTC usageDate (F11)', async () => {
        const { handler: confirmHandler } = await import('../../netlify/functions/ai-confirm-usage');
        const res = await call(confirmHandler as Handler, {
            httpMethod: 'POST',
            headers: { authorization: 'Bearer good-token', 'x-user-timezone': 'Pacific/Kiritimati' },
            body: JSON.stringify({ usageType: 'project_generation' }),
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        // F11: quota day is fixed UTC, never the client-supplied +14h timezone.
        expect(body.usageDate).toBe('2026-11-10');
        expect(incrementMock).toHaveBeenCalledTimes(1);
        expect(incrementMock).toHaveBeenCalledWith(
            expect.anything(), 42, 'project_generation'
        );
    });
});
