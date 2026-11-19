// Route contract test: the client calls /api/<fn>; production (Netlify redirects)
// and dev (vite proxy rewrite) must both land on /.netlify/functions/<fn>.
// Guards against SPA-fallback swallow regressions (2026-11-08: live 404 HTML).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');

const CLIENT_API_PATHS = [
    '/api/send-push-notification',
    '/api/ai-generate-project',
    '/api/ai-generated-description',
    '/api/ai-confirm-usage',
];

describe('/api/* route contract', () => {
    it('netlify.toml maps every /api path to its function BEFORE the SPA fallback', () => {
        const toml = readFileSync(resolve(ROOT, 'netlify.toml'), 'utf8');

        const spaIdx = toml.indexOf('to = "/index.html"');
        expect(spaIdx).toBeGreaterThan(-1);

        for (const p of CLIENT_API_PATHS) {
            const fn = p.replace('/api/', '');
            const rule = `from = "${p}"\n  to = "/.netlify/functions/${fn}"`;
            const ruleIdx = toml.indexOf(rule);
            expect(ruleIdx, `missing redirect for ${p}`).toBeGreaterThan(-1);
            expect(ruleIdx, `${p} redirect must precede SPA fallback`).toBeLessThan(spaIdx);
        }
    });

    // D-054 (run 18): NO public/_redirects, deliberately. Two facts:
    //  - Netlify (production today, 16 real users) gives a _redirects FILE
    //    precedence over netlify.toml [[redirects]] — a splat in public/_redirects
    //    would shadow the four /api/* function rules in Netlify production.
    //  - Cloudflare Pages needs no SPA-fallback redirect: unmatched navigations
    //    serve index.html natively (live-verified 2026-11-19: /privacy -> 200 on
    //    the preview), and Pages Functions keep answering /api/* regardless
    //    (default _routes include /*; _redirects rules apply to static responses).
    it('no public/_redirects anywhere (Netlify would shadow /api redirects; Pages SPA-falls-back natively)', () => {
        expect(existsSync(resolve(ROOT, 'public/_redirects'))).toBe(false);
    });

    it('vite dev proxy rewrites /api/* to the functions server', () => {
        const vite = readFileSync(resolve(ROOT, 'vite.config.ts'), 'utf8');
        expect(vite).toMatch(/'\/api':\s*{[\s\S]*?rewrite:/);
    });
});
