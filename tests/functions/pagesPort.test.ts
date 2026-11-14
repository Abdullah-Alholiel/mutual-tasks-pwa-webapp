// Pages Functions adapter (functions/api/_shared/adapter.ts): bridges the
// workerd Request to the Netlify HandlerEvent shape and back. The four API
// handlers stay in netlify/functions/ (single source of truth) — the Pages
// wrappers import them verbatim, so parity is structural, not asserted.
// Also verifies the Pages routing/control files match the client's /api/* paths.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');

const CLIENT_API_PATHS = [
    '/api/send-push-notification',
    '/api/ai-generate-project',
    '/api/ai-generated-description',
    '/api/ai-confirm-usage',
];

import { toNetlifyEvent, runNetlifyHandler, type NetlifyEvent } from '../../functions/api/_shared/adapter';
import { installEnv } from '../../functions/api/_shared/env';

describe('Pages ⇄ Netlify adapter bridge', () => {
    it('toNetlifyEvent maps method, lowercased headers, path and query', () => {
        const req = new Request('https://x.example/api/ai-confirm-usage?a=1&b=two', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-Timezone': 'Asia/Riyadh' },
            body: JSON.stringify({ usageType: 'project_generation' }),
        });
        const ev = toNetlifyEvent(req);
        expect(ev.httpMethod).toBe('POST');
        expect(ev.path).toBe('/api/ai-confirm-usage');
        expect(ev.headers['content-type']).toBe('application/json');
        // Netlify lowercases header keys — the client reads headers['origin'],
        // headers['authorization'], headers['x-user-timezone'] (lowercase).
        expect(ev.headers['x-user-timezone']).toBe('Asia/Riyadh');
        expect(ev.querystringParameters).toEqual({ a: '1', b: 'two' });
        expect(ev.isBase64Encoded).toBe(false);
    });

    it('GET with no body yields body=null and the handler receives the event', async () => {
        const seen: NetlifyEvent[] = [];
        const stub = async (event: unknown) => {
            seen.push(event as NetlifyEvent);
            return { statusCode: 405, headers: { 'x-a': 'b' }, body: '{"error":"Method not allowed"}' };
        };
        const res = await runNetlifyHandler(stub as never, new Request('https://x.example/api/x'), {});
        expect(seen[0].body).toBeNull();
        expect(res.status).toBe(405);
        expect(res.headers.get('x-a')).toBe('b');
        expect(await res.text()).toBe('{"error":"Method not allowed"}');
    });

    it('runNetlifyHandler passes the body text and maps status/headers/body back', async () => {
        let seenBody: string | null = 'untouched';
        const handler = async (event: { body: string | null }) => {
            seenBody = event.body;
            return { statusCode: 401, body: '{"error":"Unauthorized"}' };
        };
        const req = new Request('https://x.example/api/y', { method: 'POST', body: '{"k":1}' });
        const res = await runNetlifyHandler(handler as never, req, {});
        expect(seenBody).toBe('{"k":1}');
        expect(res.status).toBe(401);
        expect(await res.text()).toBe('{"error":"Unauthorized"}');
    });

    it('installEnv adds missing keys, never overwrites existing ones, tolerates junk', () => {
        const g = globalThis as { process?: { env: Record<string, string> } };
        g.process = { env: { EXISTING: 'keep' } };
        installEnv({ NEW_KEY: 'v1', EXISTING: 'would-overwrite', EMPTY: '' });
        expect(g.process.env.EXISTING).toBe('keep');
        expect(g.process.env.NEW_KEY).toBe('v1');
        expect(g.process.env.EMPTY).toBe(''); // empty string is still a string value
        installEnv(null);
        installEnv(42);
        installEnv({ NOT_A_STRING: 7 });
        expect(g.process.env.NOT_A_STRING).toBeUndefined();
    });

    it('a missing handler result body becomes an empty 200-shape Response (never throws)', async () => {
        const stub = async () => ({ statusCode: 204 });
        const res = await runNetlifyHandler(stub as never, new Request('https://x.example/api/z'), {});
        expect(res.status).toBe(204);
        expect(await res.text()).toBe('');
    });
});

describe('Pages port routing contract (parity with Netlify /api/*)', () => {
    it('functions/api/<fn>.ts exists and imports the NETLIFY handler verbatim for every client path', () => {
        for (const p of CLIENT_API_PATHS) {
            const fn = p.replace('/api/', '');
            const file = resolve(ROOT, `functions/api/${fn}.ts`);
            expect(existsSync(file), `missing Pages function for ${p}`).toBe(true);
            const src = readFileSync(file, 'utf8');
            expect(src).toContain(`from '../../netlify/functions/${fn}'`);
            expect(src).toContain('onRequest');
        }
    });

    it('the adapter import in each Pages function resolves to the shared bridge', () => {
        for (const p of CLIENT_API_PATHS) {
            const fn = p.replace('/api/', '');
            const src = readFileSync(resolve(ROOT, `functions/api/${fn}.ts`), 'utf8');
            expect(src).toContain("_shared/adapter");
        }
    });

    it('scripts/pages-config.mjs generates _routes.json serving /api/* first and excluding static assets', () => {
        const script = readFileSync(resolve(ROOT, 'scripts/pages-config.mjs'), 'utf8');
        expect(script).toContain("'/api/*'");           // functions invoked for API paths
        expect(script).toContain("'/*'");               // SPA fallback included
        expect(script).toContain('_headers');           // hardened security headers written
        expect(script).toContain('wildcardExcludes');   // hashed asset dirs excluded
    });
});
