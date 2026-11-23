// D-054 (run 18): Pages control files in the repo.
//
//  - public/_headers is the CANONICAL security-headers source for Cloudflare
//    Pages: vite copies it into dist/ on every build, so the headers ship no
//    matter how the deploy is made (run 8's pages-config.mjs generator only ran
//    on `npm run pages:build`; plain `vite build` + wrangler uploads shipped NO
//    headers at all — live preview verified headerless 2026-11-19).
//  - NO public/_redirects: see tests/functions/apiRoute.test.ts (Netlify
//    precedence + Pages native SPA fallback).
//  - NO wrangler.toml / wrangler.jsonc: the owner set 10 env vars (4 of them
//    secret_text) and the Workers-AI binding in the Cloudflare dashboard. Per
//    CF docs a Pages wrangler file with pages_build_output_dir becomes the
//    project's source of truth — the next deploy would drop every
//    dashboard-defined binding the file does not declare. Secrets are
//    owner-only; the factory must never re-declare them. Deploys stay
//    `wrangler pages deploy dist --project-name social-momentum` (explicit
//    flags, no config file).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');

const MUST_HAVE_HEADERS = [
    'X-Frame-Options: DENY',
    'X-Content-Type-Options: nosniff',
    'X-XSS-Protection: 1; mode=block',
    'Referrer-Policy: strict-origin-when-cross-origin',
    'Permissions-Policy: camera=(), microphone=(), geolocation=()',
];

describe('Pages control files (D-054)', () => {
    it('public/_headers exists (canonical, copied into every build)', () => {
        expect(existsSync(resolve(ROOT, 'public/_headers'))).toBe(true);
    });

    it('public/_headers carries all security headers, CSP hardened (no unsafe-eval, no n8n host)', () => {
        const h = readFileSync(resolve(ROOT, 'public/_headers'), 'utf8');
        for (const line of MUST_HAVE_HEADERS) {
            expect(h).toContain(line);
        }
        const csp = h.split('\n').find((l) => l.trim().startsWith('Content-Security-Policy:'));
        expect(csp, 'CSP header present').toBeTruthy();
        expect(csp).toContain("default-src 'self'");
        expect(csp).not.toContain('unsafe-eval');                     // F7
        expect(csp).not.toContain('n8n');                             // F14
        expect(csp).toContain('https://sb.145.241.109.213.sslip.io'); // VPS gateway
        expect(csp).toContain('https://cdn.onesignal.com');
    });

    it('public/_headers covers the whole site (single /* rule, valid format)', () => {
        const h = readFileSync(resolve(ROOT, 'public/_headers'), 'utf8');
        const lines = h.split('\n').filter((l) => l.trim() !== '');
        expect(lines[0].trim()).toBe('/*');
        // every other line is a "Name: value" pair on a single line
        for (const l of lines.slice(1)) {
            expect(l.trim()).toMatch(/^[A-Za-z-]+: \S/);
        }
    });

    it('CSP is the exact hardened policy (F7/F14 removed, VPS gateway + OneSignal allowed)', () => {
        const h = readFileSync(resolve(ROOT, 'public/_headers'), 'utf8');
        const csp = h.split('\n').find((l) => l.trim().startsWith('Content-Security-Policy:'));
        const expected = 'Content-Security-Policy: default-src \'self\'; script-src \'self\' \'unsafe-inline\' https://cdn.onesignal.com https://api.onesignal.com https://cdn.jsdelivr.net; style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com; img-src \'self\' data: https: blob:; font-src \'self\' https://fonts.gstatic.com https://fonts.googleapis.com; connect-src \'self\' https://*.supabase.co https://sb.145.241.109.213.sslip.io wss://sb.145.241.109.213.sslip.io https://*.onesignal.com wss://*.supabase.co wss://*.onesignal.com https://*.ingest.sentry.io; frame-src \'none\'; object-src \'none\'; base-uri \'self\'; form-action \'self\';';
        expect(csp?.trim()).toBe(expected);
        // netlify.toml keeps its legacy CSP (hardening LIVE Netlify prod headers
        // is a separate owner-relevant change, not part of D-054); the divergence
        // is intentional and dies with the Netlify retirement at cutover.
        const toml = readFileSync(resolve(ROOT, 'netlify.toml'), 'utf8');
        expect(toml).toContain('unsafe-eval'); // documents the intentional divergence
    });

    it('pages-config.mjs verifies the dist copy instead of generating its own _headers', () => {
        const script = readFileSync(resolve(ROOT, 'scripts/pages-config.mjs'), 'utf8');
        expect(script).toContain('public/_headers missing');
        expect(script).not.toContain('writeFileSync(join(dist, \'_headers\'');
    });

    it('NO public/_redirects (netlify precedence + Pages native fallback)', () => {
        expect(existsSync(resolve(ROOT, 'public/_redirects'))).toBe(false);
    });

    it('NO wrangler.toml / wrangler.jsonc anywhere (dashboard is the config source of truth; secrets owner-only)', () => {
        // scan the repo root + scripts/ for any wrangler config file that could
        // flip Pages into file-defined config on the next deploy
        const candidates = ['wrangler.toml', 'wrangler.jsonc', 'wrangler.json'];
        for (const f of candidates) {
            expect(existsSync(resolve(ROOT, f)), `stray ${f} at repo root`).toBe(false);
        }
        expect(existsSync(resolve(ROOT, 'scripts/wrangler.toml'))).toBe(false);
    });
});
