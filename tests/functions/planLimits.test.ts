// G3 (D-081): monthly plan-limit + premium-interest contract tests.
// utils.checkRateLimit runs against a MOCKED supabaseAdmin (no network, no
// prod); premium-interest runs with shared/utils session/CORS stubbed and the
// admin client mocked at the module boundary (aiPort.test.ts pattern).
// Never touches a real database.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- mocks ------------------------------------------------------------------
const verifyMock = vi.fn();
const sbFrom = vi.fn();

vi.mock('../../netlify/functions/shared/utils', async (importOriginal) => {
    // Partial mock: real checkRateLimit under test; only session + CORS stubbed.
    const actual = await importOriginal<typeof import('../../netlify/functions/shared/utils')>();
    return {
        ...actual,
        verifyMagicLinkSession: (...args: unknown[]) => verifyMock(...args),
        getCorsHeaders: (origin?: string | null) => ({
            'Access-Control-Allow-Headers': 'Content-Type, authorization, x-user-timezone',
            ...(origin && { 'Access-Control-Allow-Origin': origin }),
        }),
    };
});

vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({ from: sbFrom }),
}));

// Owner numbers MUST stay exactly these (D-081/D-078; DECISIONS.md 2026-11-16).
import { PLAN_LIMITS } from '../../src/lib/planLimits';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('G3 contract: owner numbers are exact (never invented, never drifted)', () => {
    it('free tier: 3 projects + 20 descriptions per month', () => {
        expect(PLAN_LIMITS.free.project_generation).toBe(3);
        expect(PLAN_LIMITS.free.description_generation).toBe(20);
    });
    it('premium tier: 100 projects + 1000 descriptions per month', () => {
        expect(PLAN_LIMITS.premium.project_generation).toBe(100);
        expect(PLAN_LIMITS.premium.description_generation).toBe(1000);
    });
});

// ---- utils.checkRateLimit monthly window ------------------------------------

// Minimal chainable PostgREST builder: every builder method returns the chain;
// the chain is thenable and resolves to `result` (the {data, error} envelope,
// exactly what the supabase-js client awaits to). maybeSingle() resolves too.
type Envelope = { data: unknown; error: unknown };
function chainable(result: Envelope) {
    const terminal = Promise.resolve(result);
    const chain: Record<string, unknown> = {};
    const wrap = () => chain;
    chain.select = wrap;
    chain.eq = wrap;
    chain.gte = wrap;
    chain.lt = wrap;
    chain.maybeSingle = () => terminal;
    chain.then = (fn: unknown, rej?: unknown) => terminal.then(fn as never, rej as never);
    chain.catch = (rej: unknown) => terminal.catch(rej as never);
    return chain;
}

function adminWith(users: Envelope, usage: Envelope): SupabaseClient {
    return {
        from: (table: string) => (table === 'users' ? chainable(users) : chainable(usage)),
    } as unknown as SupabaseClient;
}

describe('G3: checkRateLimit monthly window + tier caps', () => {
    beforeEach(() => {
        sbFrom.mockReset();
        vi.restoreAllMocks();
    });

    it('free user: sums the month rows and reports remaining against 3', async () => {
        const { checkRateLimit } = await import('../../netlify/functions/shared/utils');
        // Two daily rows inside the current UTC month (6 total) → 3-6 → blocked.
        const admin = adminWith(
            { data: { is_premium: false }, error: null },
            { data: [{ count: 2 }, { count: 4 }], error: null }
        );
        const out = await checkRateLimit(admin, 7, 'project_generation');
        expect(out.limit).toBe(3);
        expect(out.used).toBe(6);
        expect(out.allowed).toBe(false);
        expect(out.remaining).toBe(0);
    });

    it('free user under the monthly cap: allowed with real remaining', async () => {
        const { checkRateLimit } = await import('../../netlify/functions/shared/utils');
        const admin = adminWith(
            { data: { is_premium: false }, error: null },
            { data: [{ count: 1 }], error: null }
        );
        const out = await checkRateLimit(admin, 7, 'project_generation');
        expect(out.allowed).toBe(true);
        expect(out.remaining).toBe(2);
        expect(out.limit).toBe(3);
    });

    it('premium user is capped at 100 (the -1 unlimited bypass is retired)', async () => {
        const { checkRateLimit } = await import('../../netlify/functions/shared/utils');
        const admin = adminWith(
            { data: { is_premium: true }, error: null },
            { data: [{ count: 100 }], error: null }
        );
        const out = await checkRateLimit(admin, 7, 'project_generation');
        expect(out.limit).toBe(100);
        expect(out.allowed).toBe(false);
    });

    it('premium user mid-month: real remaining out of 100', async () => {
        const { checkRateLimit } = await import('../../netlify/functions/shared/utils');
        const admin = adminWith(
            { data: { is_premium: true }, error: null },
            { data: [{ count: 42 }], error: null }
        );
        const out = await checkRateLimit(admin, 7, 'project_generation');
        expect(out.limit).toBe(100);
        expect(out.used).toBe(42);
        expect(out.remaining).toBe(58);
        expect(out.allowed).toBe(true);
    });

    it('premium read failure defaults to the FREE tier (stricter side)', async () => {
        const { checkRateLimit } = await import('../../netlify/functions/shared/utils');
        const admin = {
            from: (table: string) =>
                table === 'users'
                    ? chainable({ data: null, error: { code: 'PGRST301', message: 'jwt expired' } })
                    : chainable({ data: [{ count: 0 }], error: null }),
        } as unknown as SupabaseClient;
        const out = await checkRateLimit(admin, 7, 'project_generation');
        expect(out.limit).toBe(3); // free limit, never premium-by-accident
    });

    it('usage read failure → blocked with used=0 (fail closed, never a bypass)', async () => {
        const { checkRateLimit } = await import('../../netlify/functions/shared/utils');
        const admin = {
            from: () => chainable({ data: null, error: { code: 'PGRST301', message: 'x' } }),
        } as unknown as SupabaseClient;
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const out = await checkRateLimit(admin, 7, 'project_generation');
        expect(out.allowed).toBe(false);
        expect(out.used).toBe(0);
        spy.mockRestore();
    });
});

// ---- premium-interest endpoint ----------------------------------------------

type HandlerResult = { statusCode: number; headers: Record<string, string>; body: string };
const call = (h: unknown, event: Record<string, unknown>): Promise<HandlerResult> =>
    (h as (e: unknown, c: unknown) => Promise<HandlerResult>)(event, {});

const authedEvent = (body: Record<string, unknown> | undefined) => ({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer good-token' },
    body: body === undefined ? undefined : JSON.stringify(body),
});

describe('G3: POST /api/premium-interest (D-081)', () => {
    beforeEach(() => {
        verifyMock.mockReset();
        sbFrom.mockReset();
        vi.restoreAllMocks();
    });

    const loadHandler = async () => (await import('../../netlify/functions/premium-interest')).handler;

    it('401 without auth header', async () => {
        const handler = await loadHandler();
        const res = await call(handler, { httpMethod: 'POST', headers: {}, body: undefined });
        expect(res.statusCode).toBe(401);
        expect(Object.keys(JSON.parse(res.body))).toEqual(['error']);
    });

    it('401 when the session token is invalid', async () => {
        verifyMock.mockResolvedValue(null);
        const handler = await loadHandler();
        const res = await call(handler, authedEvent({}));
        expect(res.statusCode).toBe(401);
    });

    it('400 when message exceeds 500 chars', async () => {
        verifyMock.mockResolvedValue(42);
        const handler = await loadHandler();
        const res = await call(handler, authedEvent({ message: 'x'.repeat(501) }));
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain('500');
    });

    it('invalid JSON body → 400, exactly {error}', async () => {
        verifyMock.mockResolvedValue(42);
        const handler = await loadHandler();
        const res = await call(handler, { httpMethod: 'POST', headers: { authorization: 'Bearer t' }, body: '{nope' });
        expect(res.statusCode).toBe(400);
        expect(Object.keys(JSON.parse(res.body))).toEqual(['error']);
    });

    it('200 {ok:true} on a successful insert (insert carries user_id + email)', async () => {
        verifyMock.mockResolvedValue(42);
        const insertMock = vi.fn().mockResolvedValue({ error: null });
        sbFrom.mockImplementation((table: string) => {
            if (table === 'users') {
                return {
                    select: () => ({
                        eq: () => ({
                            maybeSingle: () => Promise.resolve({ data: { email: 'u@x.co' }, error: null }),
                        }),
                    }),
                };
            }
            return { insert: insertMock };
        });
        const mod = await import('../../netlify/functions/premium-interest');
        const res = await call(mod.handler, authedEvent({ message: 'handle: qa-bot' }));
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toEqual({ ok: true });
        const arg = insertMock.mock.calls[0][0] as Record<string, unknown>;
        expect(arg.user_id).toBe(42);
        expect(arg.email).toBe('u@x.co');
        expect(arg.message).toBe('handle: qa-bot');
    });

    it('insert failure → 500 generic (no DB detail leaked), full detail logged', async () => {
        verifyMock.mockResolvedValue(42);
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        sbFrom.mockImplementation((table: string) => {
            if (table === 'users') {
                return {
                    select: () => ({
                        eq: () => ({
                            maybeSingle: () => Promise.resolve({ data: { email: 'u@x.co' }, error: null }),
                        }),
                    }),
                };
            }
            return {
                insert: vi.fn().mockResolvedValue({
                    error: { code: '42P01', message: 'relation "premium_interest" does not exist' },
                }),
            };
        });
        const mod = await import('../../netlify/functions/premium-interest');
        const res = await call(mod.handler, authedEvent({}));
        expect(res.statusCode).toBe(500);
        const body = JSON.parse(res.body);
        expect(Object.keys(body)).toEqual(['error']);
        expect(body.error).not.toContain('42P01');
        expect(res.body).not.toContain('premium_interest');
        expect(errSpy.mock.calls.some((c) => c.map(String).join(' ').includes('42P01'))).toBe(true);
        errSpy.mockRestore();
    });

    it('405 on GET', async () => {
        const handler = await loadHandler();
        const res = await call(handler, { httpMethod: 'GET', headers: {}, body: undefined });
        expect(res.statusCode).toBe(405);
    });

    it('OPTIONS preflight returns 200 empty', async () => {
        const handler = await loadHandler();
        const res = await call(handler, { httpMethod: 'OPTIONS', headers: {}, body: undefined });
        expect(res.statusCode).toBe(200);
    });
});
