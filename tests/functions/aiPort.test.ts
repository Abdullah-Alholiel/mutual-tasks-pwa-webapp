// L4c (run 19): AI off n8n — provider chain + handler mode-gate tests.
// Matrix per plans/ai-port/README.md step 7 (mocked providers, no network):
//   primary ok · primary bad JSON → backup CF model · CF throws → OpenRouter ·
//   all fail → clear error + NO usage counted · exhaustion → AI_EXHAUSTED ·
//   n8n legacy preserved (auto without binding, explicit n8n mode) ·
//   installEnv passes OBJECT bindings (the workerd AI binding).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---- shared/utils mock (handler tests) ------------------------------------
const verifyMock = vi.fn();
const rateLimitMock = vi.fn();
const incrementMock = vi.fn();

vi.mock('../../netlify/functions/shared/utils', () => ({
    verifyMagicLinkSession: (...args: unknown[]) => verifyMock(...args),
    checkRateLimit: (...args: unknown[]) => rateLimitMock(...args),
    incrementUsage: (...args: unknown[]) => incrementMock(...args),
    getCorsHeaders: (origin?: string | null) => ({
        'Access-Control-Allow-Headers': 'Content-Type, authorization, x-user-timezone',
        ...(origin && { 'Access-Control-Allow-Origin': origin }),
    }),
    buildRateLimitResponse: (headers: Record<string, string>, limit: number) => ({
        statusCode: 429, headers, body: JSON.stringify({ error: 'Rate limit exceeded', limit, remaining: 0 }),
    }),
    AI_USAGE_LIMITS: { project_generation: 3, description_generation: 10 },
    getTodayDate: () => '2026-11-20',
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({ from: () => { throw new Error('admin client must be mocked away'); } }),
}));

import type { Handler } from '@netlify/functions';
import { handler as projectHandler } from '../../netlify/functions/ai-generate-project';
import { handler as descriptionHandler } from '../../netlify/functions/ai-generated-description';
import {
    generateProjectWithAI,
    generateDescriptionWithAI,
    validateProject,
    extractJsonCandidate,
    extractWorkersAiText,
    isExhaustionText,
    useN8n,
    hasAiBinding,
    workersAiRestConfig,
    DEFAULT_OPENROUTER_MODEL,
    PROJECT_USER_TEMPLATE,
    DESCRIPTION_PROMPT,
} from '../../netlify/functions/shared/aiProviders';
import { installEnv } from '../../functions/api/_shared/env';

type HandlerResult = { statusCode: number; headers: Record<string, string>; body: string };
const call = (h: Handler, event: Record<string, unknown>): Promise<HandlerResult> =>
    h(event as unknown as Parameters<Handler>[0], {} as never) as Promise<HandlerResult>;

const GOOD_PROJECT_TEXT = JSON.stringify({
    name: 'Morning Routine',
    description: 'Build a solid start to the day',
    icon: 'Coffee',
    color: 'hsl(142, 76%, 36%)',
    isPublic: true,
    tasks: [
        { title: 'Wake at 6', description: 'No snooze', daysFromNow: 0, type: 'one_off' },
        { title: 'Journal', description: 'Three lines minimum', daysFromNow: 1, type: 'habit', recurrencePattern: 'Daily' },
    ],
});

/** Workers AI binding stub: llama shape ({response}) by default. */
function cfBinding(responses: Array<unknown>, opts?: { throwOn?: Array<Error> }) {
    let i = 0;
    return {
        run: vi.fn(async () => {
            const t = opts?.throwOn?.[i];
            if (t) { i++; throw t; }
            const r = responses[Math.min(i, responses.length - 1)];
            i++;
            return r;
        }),
    };
}

const okProject = { response: GOOD_PROJECT_TEXT };
const badProject = { response: 'Here is your project! I hope you like it.' };
const gptOssShape = { choices: [{ message: { content: GOOD_PROJECT_TEXT } }] };
const usage = { usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 } };

// Keep timeouts tiny so exhausted/timeout paths run fast.
const fastDeps = (aiBinding: unknown, env?: Record<string, string | undefined>, fetchImpl?: typeof fetch) =>
    ({ aiBinding, env, fetchImpl, timeoutMs: 50 });

let envOwner: NodeJS.Process;

beforeEach(() => {
    vi.clearAllMocks();
    verifyMock.mockResolvedValue(42);
    rateLimitMock.mockResolvedValue({ allowed: true, limit: 3, remaining: 2 });
    incrementMock.mockResolvedValue(undefined);
    // Node coerces process.env values to STRINGS (an object binding becomes
    // "[object Object]") — workerd's `process` shim from installEnv does NOT.
    // Stub process with a plain object so handler tests exercise the same
    // object-binding behavior the Pages bridge produces in production.
    envOwner = { ...process };
    (globalThis as Record<string, unknown>).process = { env: {} as Record<string, unknown> };
});

afterEach(() => {
    (globalThis as Record<string, unknown>).process = envOwner;
    delete (globalThis.process as NodeJS.Process).env.AI;
    delete process.env.AI_PROVIDER_MODE;
    delete process.env.OPENROUTER_API_KEY;
});

describe('L4c provider chain — project generation', () => {
    it('primary ok: llama shape parses, provider/model/usage reported, one attempt', async () => {
        const binding = cfBinding([{ ...okProject, ...usage }]);
        const out = await generateProjectWithAI(fastDeps(binding), 'Learn guitar in 30 days');
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.project.name).toBe('Morning Routine');
        expect(out.project.tasks).toHaveLength(2);
        expect(out.project.tasks[1].type).toBe('habit');
        expect(out.provider).toBe('workers-ai');
        expect(out.model).toContain('llama-3.3');
        expect(out.usage?.total_tokens).toBe(300);
        expect(out.attempts).toEqual(['primary:ok']);
    });

    it('primary bad JSON → backup gpt-oss model (OpenAI shape) succeeds', async () => {
        const binding = cfBinding([badProject, gptOssShape]);
        const out = await generateProjectWithAI(fastDeps(binding), 'Plan a wedding');
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.project.tasks.length).toBeGreaterThan(0);
        expect(out.model).toContain('gpt-oss');
        // 'primary:ok' = text extracted fine; the CHAIN continued because it held
        // no valid project JSON — validation drives the retry, not extraction.
        expect(out.attempts).toEqual(['primary:ok', 'backup:ok']);
    });

    it('CF throws → OpenRouter fallback (mocked fetch) succeeds', async () => {
        const binding = cfBinding([], { throwOn: [new Error('workers-ai down')] });
        const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
            new Response(JSON.stringify({ choices: [{ message: { content: GOOD_PROJECT_TEXT } }], usage: { total_tokens: 250 } }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }));
        const out = await generateProjectWithAI(fastDeps(binding, { OPENROUTER_API_KEY: 'test-key' }, fetchMock as unknown as typeof fetch), 'Learn guitar');
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.provider).toBe('openrouter');
        expect(out.model).toBe(DEFAULT_OPENROUTER_MODEL);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toBe('https://openrouter.ai/api/v1/chat/completions');
        expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer test-key' });
        expect(out.attempts).toEqual(['primary:error', 'backup:invalid-content', `openrouter:${DEFAULT_OPENROUTER_MODEL}:ok`]);
    });

    it('all fail → AI_NO_VALID_RESPONSE, fallback attempted, disabled switch honored', async () => {
        const binding = cfBinding([badProject, badProject]);
        const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response('{"choices":[{"message":{"content":"nope"}}]}', { status: 200 }));
        const out = await generateProjectWithAI(fastDeps(binding, { OPENROUTER_API_KEY: 'k' }, fetchMock as unknown as typeof fetch), 'x');
        expect(out.ok).toBe(false);
        if (out.ok) return;
        expect(out.error).toBe('AI_NO_VALID_RESPONSE');
        expect(out.attempts.some(a => a.includes('openrouter'))).toBe(true);

        const out2 = await generateProjectWithAI(fastDeps(binding, { OPENROUTER_API_KEY: 'k', AI_FALLBACK_ENABLED: 'false' }, fetchMock as unknown as typeof fetch), 'x');
        expect(out2.ok).toBe(false);
        if (!out2.ok) return;
        expect(out2.attempts).toContain('openrouter:skipped-disabled-or-no-key');
    });

    it('exhaustion: skips remaining CF attempts, tries fallback, reports exhausted, NO usage path', async () => {
        const binding = cfBinding([], { throwOn: [new Error('Free allowance exceeded — neurons spent for today')] });
        const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response('{"choices":[{"message":{"content":""}}]}', { status: 200 }));
        const out = await generateProjectWithAI(fastDeps(binding, { OPENROUTER_API_KEY: 'k' }, fetchMock as unknown as typeof fetch), 'x');
        expect(out.ok).toBe(false);
        if (out.ok) return;
        expect(out.exhausted).toBe(true);
        expect(out.error).toBe('AI_EXHAUSTED');
        // Only ONE CF call: exhaustion skips the backup model.
        expect(binding.run).toHaveBeenCalledTimes(1);
        expect(out.attempts).toEqual(['primary:exhausted', `openrouter:${DEFAULT_OPENROUTER_MODEL}:invalid-content`]);
    });

    it('mode=n8n short-circuits the chain even WITH a binding', async () => {
        const binding = cfBinding([okProject]);
        const out = await generateProjectWithAI(fastDeps(binding, { AI_PROVIDER_MODE: 'n8n' }), 'x');
        expect(out.ok).toBe(false);
        if (!out.ok) return;
        expect(out.error).toBe('N8N_MODE');
        expect(binding.run).not.toHaveBeenCalled();
    });
});

describe('L4c provider chain — description generation', () => {
    it('mistral primary ok returns plain text; prompt carries type + language rule', async () => {
        const binding = cfBinding([{ response: 'Set up your guitar, tuner, and a 20-minute daily slot.', ...usage }]);
        const out = await generateDescriptionWithAI(fastDeps(binding), 'Learn guitar', 'task');
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.text).toContain('guitar');
        expect(out.usage?.prompt_tokens).toBe(100);
        expect(DESCRIPTION_PROMPT('تعلم الغيتار', 'project')).toContain('"تعلم الغيتار"');
        expect(DESCRIPTION_PROMPT('x', 'task')).toContain("Write in the same language as the user's text.");
        expect(PROJECT_USER_TEMPLATE('وصف بالعربية')).toContain('وصف بالعربية');
    });
});

describe('L4c handler mode gate (real handlers + mocked utils)', () => {
    const post = (body: unknown) => ({
        httpMethod: 'POST',
        headers: { origin: 'https://x.example', authorization: 'Bearer tok' },
        body: JSON.stringify(body),
    });

    it('auto + binding: handler returns canonical project JSON + AI headers + increments usage', async () => {
        (process.env as Record<string, unknown>).AI = cfBinding([{ ...okProject, ...usage }]);
        const res = await call(projectHandler, post({ description: 'Learn guitar in 30 days' }));
        expect(res.statusCode).toBe(200);
        const data = JSON.parse(res.body);
        expect(data.name).toBe('Morning Routine');
        expect(Array.isArray(data.tasks)).toBe(true);
        expect(res.headers['X-AI-Provider']).toBe('workers-ai');
        expect(JSON.parse(res.headers['X-AI-Usage']).total_tokens).toBe(300);
        expect(incrementMock).toHaveBeenCalledTimes(1);
    });

    it('auto + binding + exhaustion: 503 AI_EXHAUSTED, usage NOT counted', async () => {
        (process.env as Record<string, unknown>).AI = cfBinding([], { throwOn: [new Error('Free allowance exceeded')] });
        const res = await call(projectHandler, post({ description: 'x' }));
        expect(res.statusCode).toBe(503);
        expect(JSON.parse(res.body).error).toBe('AI_EXHAUSTED');
        expect(incrementMock).not.toHaveBeenCalled();
    });

    it('auto WITHOUT binding: legacy n8n fetch path (Netlify parity, real fetch mocked)', async () => {
        const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(GOOD_PROJECT_TEXT, { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        process.env.N8N_PROJECT_WEBHOOK_URL = 'https://n8n.example/webhook';
        process.env.x_momentum_secret = 's3cret';
        try {
            const res = await call(projectHandler, post({ description: 'Learn guitar' }));
            expect(res.statusCode).toBe(200);
            const [url, init] = fetchMock.mock.calls[0];
            expect(String(url)).toBe('https://n8n.example/webhook');
            expect((init as RequestInit).headers).toMatchObject({ 'x-momentum-secret': 's3cret', 'x_momentum_secret': 's3cret' });
            expect(incrementMock).toHaveBeenCalledTimes(1);
            expect(JSON.parse(res.body).name).toBe('Morning Routine');
        } finally {
            vi.unstubAllGlobals();
            delete process.env.N8N_PROJECT_WEBHOOK_URL;
            delete process.env.x_momentum_secret;
        }
    });

    it('auto + binding: description handler returns {description} body (client first branch)', async () => {
        (process.env as Record<string, unknown>).AI = cfBinding([{ response: 'A focused 20-minute daily practice.' }]);
        const res = await call(descriptionHandler, post({ title: 'Learn guitar', type: 'task' }));
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).description).toContain('20-minute');
        expect(res.headers['X-AI-Provider']).toBe('workers-ai');
        expect(incrementMock).toHaveBeenCalledTimes(1);
    });

    it('rate limit still blocks BEFORE any provider call', async () => {
        (process.env as Record<string, unknown>).AI = cfBinding([okProject]);
        rateLimitMock.mockResolvedValue({ allowed: false, limit: 3, remaining: 0 });
        const res = await call(projectHandler, post({ description: 'x' }));
        expect(res.statusCode).toBe(429);
    });
});

describe('L4c helpers', () => {
    it('useN8n / hasAiBinding matrix', () => {
        expect(hasAiBinding({ aiBinding: cfBinding([]) })).toBe(true);
        expect(hasAiBinding({ aiBinding: undefined })).toBe(false);
        expect(hasAiBinding({ aiBinding: 'a string binding (never an object)' })).toBe(false);
        expect(useN8n({ aiBinding: undefined })).toBe(true); // Netlify prod keeps working
        expect(useN8n({ aiBinding: cfBinding([]) })).toBe(false);
        expect(useN8n({ aiBinding: cfBinding([]), env: { AI_PROVIDER_MODE: 'n8n' } })).toBe(true);
        expect(useN8n({ aiBinding: undefined, env: { AI_PROVIDER_MODE: 'workers' } })).toBe(false);
    });

    it('extractWorkersAiText handles both shapes and rejects empties', () => {
        expect(extractWorkersAiText({ response: 'hi' }).text).toBe('hi');
        expect(extractWorkersAiText(gptOssShape).text).toContain('Morning');
        expect(extractWorkersAiText({ response: '   ' }).text?.trim()).toBe('');
        expect(extractWorkersAiText({ choices: [] }).text).toBeUndefined();
    });

    it('isExhaustionText catches allowance/quota markers, not generic errors', () => {
        expect(isExhaustionText('Free allowance exceeded')).toBe(true);
        expect(isExhaustionText('Rate limit exceeded: free-models-per-day')).toBe(true);
        expect(isExhaustionText('you exceeded your quota')).toBe(true);
        // Reviewer MINOR fix: bare '429' inside an unrelated error body must NOT
        // classify as exhaustion (model ids / trace ids can contain it).
        expect(isExhaustionText('Error 429 upstream: model trace abc429')).toBe(false);
        expect(isExhaustionText('network hiccup')).toBe(false);
    });

    it('chain budget: exhaustion → fallback → AI_EXHAUSTED within the chain deadline (≤ client 45s)', async () => {
        const binding = cfBinding([], { throwOn: [new Error('Free allowance exceeded')] });
        const fetchMock = vi.fn(async (_u: string | URL | Request, _i?: RequestInit) =>
            new Response('{"choices":[{"message":{"content":""}}]}', { status: 200 }));
        const t0 = Date.now();
        const out = await generateProjectWithAI(fastDeps(binding, { OPENROUTER_API_KEY: 'k' }, fetchMock as unknown as typeof fetch), 'x');
        const elapsed = Date.now() - t0;
        expect(out.ok).toBe(false);
        if (out.ok) return;
        expect(out.error).toBe('AI_EXHAUSTED');
        expect(elapsed).toBeLessThan(45_000);
    });

    it('validateProject coerces off-list icon/color to allowed values (server-side)', () => {
        const v = validateProject({ name: 'n', tasks: [{ title: 't' }], icon: 'NotAnIcon', color: 'rgb(1,2,3)' });
        expect(v?.icon).toBe('Target');
        expect(v?.color).toBe('hsl(199, 89%, 48%)');
        const v2 = validateProject({ name: 'n', tasks: [{ title: 't' }], icon: 'Rocket', color: 'hsl(32, 95%, 58%)' });
        expect(v2?.icon).toBe('Rocket');
        expect(v2?.color).toBe('hsl(32, 95%, 58%)');
    });

    it('validateProject clamps and rejects empty task lists / bad names', () => {
        expect(validateProject(JSON.parse(GOOD_PROJECT_TEXT))?.name).toBe('Morning Routine');
        expect(validateProject({ name: 'x', tasks: [] })).toBeUndefined();
        expect(validateProject({ name: '  ', tasks: [{ title: 'a' }] })).toBeUndefined();
        const long = validateProject({ name: 'n'.repeat(99), tasks: [{ title: 't'.repeat(300), daysFromNow: -5, type: 'habit', recurrencePattern: 'Weekly' }] });
        expect(long?.name.length).toBeLessThanOrEqual(50);
        expect(long?.tasks[0].title.length).toBeLessThanOrEqual(100);
        expect(long?.tasks[0].daysFromNow).toBe(0);
        expect(long?.tasks[0].recurrencePattern).toBeUndefined(); // Weekly not allowed
    });

    it('extractJsonCandidate strips markdown fences', () => {
        expect(extractJsonCandidate('```json\n{"a":1}\n```')).toBe('{"a":1}');
    });

    it('installEnv passes OBJECT bindings through (workerd AI binding)', () => {
        const binding = { run: () => Promise.resolve({}) };
        installEnv({ AI: binding, SOMETHING: 'str' });
        expect((process.env as Record<string, unknown>).AI).toBe(binding);
        expect(process.env.SOMETHING).toBe('str');
        delete (process.env as Record<string, unknown>).AI;
        delete process.env.SOMETHING;
    });
});

// ============================================================================
// D-080 (run 34): Workers AI REST path — api.cloudflare.com/.../ai/run/{model}
// with CF_ACCOUNT_ID + CF_AI_TOKEN when the env.AI binding is absent (Direct
// Upload deployments never receive the binding). Mocked fetch only; the token
// material must never leak into errors, logs, or attempt entries.
// ============================================================================
describe('D-080 Workers AI REST path', () => {
    /** Mock fetch answering the REST envelope { success, result }. */
    function cfRestFetch(result: unknown, status = 200) {
        return vi.fn(async (_u: string | URL | Request, _i?: RequestInit) =>
            status === 200
                ? new Response(JSON.stringify({ success: true, result }), { status: 200 })
                : new Response(JSON.stringify({ success: false, errors: [{ message: 'auth error' }] }), { status }));
    }

    afterEach(() => {
        delete process.env.CF_ACCOUNT_ID;
        delete process.env.CF_AI_TOKEN;
    });

    it('config gate: both secrets → config; either/both missing → undefined', () => {
        expect(workersAiRestConfig({ CF_ACCOUNT_ID: 'acct', CF_AI_TOKEN: 'tok' })).toEqual({ accountId: 'acct', apiToken: 'tok' });
        expect(workersAiRestConfig({ CF_ACCOUNT_ID: 'acct', CF_AI_TOKEN: '  tok  ' })).toEqual({ accountId: 'acct', apiToken: 'tok' });
        expect(workersAiRestConfig({ CF_ACCOUNT_ID: 'acct' })).toBeUndefined();
        expect(workersAiRestConfig({ CF_AI_TOKEN: 'tok' })).toBeUndefined();
        expect(workersAiRestConfig({})).toBeUndefined();
        expect(workersAiRestConfig(undefined)).toBeUndefined();
    });

    it('useN8n matrix: REST secrets → Workers AI (no binding needed); neither → n8n', () => {
        expect(useN8n({ aiBinding: undefined, env: { CF_ACCOUNT_ID: 'a', CF_AI_TOKEN: 't' } })).toBe(false);
        expect(useN8n({ aiBinding: cfBinding([]), env: { CF_ACCOUNT_ID: 'a', CF_AI_TOKEN: 't' } })).toBe(false);
        expect(useN8n({ aiBinding: undefined, env: {} })).toBe(true); // legacy preserved
        expect(useN8n({ aiBinding: undefined, env: { AI_PROVIDER_MODE: 'n8n', CF_ACCOUNT_ID: 'a', CF_AI_TOKEN: 't' } })).toBe(true); // explicit n8n wins
        expect(useN8n({ aiBinding: undefined, env: { AI_PROVIDER_MODE: 'workers' } })).toBe(false);
    });

    it('REST success: llama shape unwrapped from {result}, bearer token sent, provider reported', async () => {
        const fetchMock = cfRestFetch({ response: GOOD_PROJECT_TEXT });
        const out = await generateProjectWithAI(
            fastDeps(undefined, { CF_ACCOUNT_ID: 'acct-1', CF_AI_TOKEN: 'tok-secret-value' }, fetchMock as unknown as typeof fetch),
            'Learn guitar in 30 days',
        );
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.project.name).toBe('Morning Routine');
        expect(out.provider).toBe('workers-ai');
        expect(out.model).toBe('@cf/meta/llama-3.3-70b-instruct-fp8-fast');
        expect(out.attempts.join(' ')).toContain('primary:ok');
        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toBe('https://api.cloudflare.com/client/v4/accounts/acct-1/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast');
        expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok-secret-value' });
    });

    it('REST gpt-oss shape: OpenAI-style choices inside {result} parse via the same extractor', async () => {
        const fetchMock = cfRestFetch(gptOssShape);
        const out = await generateDescriptionWithAI(
            fastDeps(undefined, { CF_ACCOUNT_ID: 'a', CF_AI_TOKEN: 't' }, fetchMock as unknown as typeof fetch),
            'Learn guitar', 'task',
        );
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.text).toContain('Morning');
        expect(out.provider).toBe('workers-ai');
    });

    it('REST primary fails (4xx) → backup model tried over REST → OpenRouter untouched without its key', async () => {
        const fetchMock = vi.fn(async (u: string | URL | Request, _i?: RequestInit) =>
            String(u).includes('llama-3.3-70b-instruct-fp8-fast')
                ? new Response('{"success":false,"errors":[{"message":"model unavailable"}]}', { status: 404 })
                : new Response(JSON.stringify({ success: true, result: { response: GOOD_PROJECT_TEXT } }), { status: 200 }));
        const out = await generateProjectWithAI(
            fastDeps(undefined, { CF_ACCOUNT_ID: 'a', CF_AI_TOKEN: 't' }, fetchMock as unknown as typeof fetch),
            'Learn guitar in 30 days',
        );
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.model).toBe('@cf/openai/gpt-oss-120b');
        expect(out.attempts.join(' ')).toContain('primary:error');
        expect(out.attempts.join(' ')).toContain('backup:ok');
        const calledUrls = fetchMock.mock.calls.map((c) => String(c[0]));
        expect(calledUrls.some((u) => u.includes('openrouter.ai'))).toBe(false);
    });

    it('REST 429 rate limit → exhaustion classification → AI_EXHAUSTED (free allowance spent)', async () => {
        const fetchMock = vi.fn(async (_u: string | URL | Request, _i?: RequestInit) =>
            new Response('{"success":false,"errors":[{"message":"free allowance exceeded"}]}', { status: 429 }));
        const out = await generateProjectWithAI(
            fastDeps(undefined, { CF_ACCOUNT_ID: 'a', CF_AI_TOKEN: 't', OPENROUTER_API_KEY: 'k' }, fetchMock as unknown as typeof fetch),
            'Learn guitar in 30 days',
        );
        expect(out.ok).toBe(false);
        if (out.ok) return;
        expect(out.error).toBe('AI_EXHAUSTED');
        expect(out.exhausted).toBe(true);
    });

    it('REST failure messages never carry the token material (F19 sweep)', async () => {
        const TOKEN = 'cf-super-secret-token-material';
        const fetchMock = vi.fn(async (_u: string | URL | Request, i?: RequestInit) => {
            // Echo the Authorization header into the error body, like a hostile
            // upstream might — the caller must still not propagate it.
            const auth = (i?.headers as Record<string, string>)?.Authorization ?? '';
            return new Response(JSON.stringify({ errors: [{ message: `bad token ${auth}` }] }), { status: 403 });
        });
        const out = await generateProjectWithAI(
            fastDeps(undefined, { CF_ACCOUNT_ID: 'a', CF_AI_TOKEN: TOKEN }, fetchMock as unknown as typeof fetch),
            'Learn guitar in 30 days',
        );
        expect(out.ok).toBe(false);
        if (out.ok) return;
        expect(JSON.stringify(out)).not.toContain(TOKEN);
    });

    it('missing secrets → REST skipped, chain falls to OpenRouter when its key exists', async () => {
        const fetchMock = cfRestFetch({ response: GOOD_PROJECT_TEXT });
        const out = await generateProjectWithAI(
            fastDeps(undefined, { OPENROUTER_API_KEY: 'k' }, fetchMock as unknown as typeof fetch),
            'Learn guitar in 30 days',
        );
        // No binding + no REST secrets → auto mode routes to n8n → chain refused.
        expect(out.ok).toBe(false);
        if (out.ok) return;
        expect(out.error).toBe('N8N_MODE');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('n8n legacy contract intact: auto mode without binding and without secrets routes to n8n', () => {
        expect(useN8n({ aiBinding: undefined })).toBe(true);
        expect(useN8n({ aiBinding: undefined, env: { CF_ACCOUNT_ID: 'a' } })).toBe(true); // token missing
    });
});
