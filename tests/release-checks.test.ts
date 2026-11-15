// ============================================================================
// Release-check gates (lane L3 / D-023) — behavior tests
// ============================================================================
// The two L3 deliverables are scripts, so these tests exercise REAL behavior:
//   1. scripts/check-bundle-config.mjs — the pr-gate bundle gate — must exit 0
//      on a consistent bundle and exit 1 on every incident class (empty
//      config, two addresses, two keys, stale-chunk mix, non-anon key role,
//      and the 2026-11-13 class: a cloud key paired with a VPS address or
//      vice versa). Tested against synthetic dist/ fixtures — deterministic,
//      no build, no network.
//   2. scripts/run-release-smoke.py — the CI release check — must implement
//      the same checks as the operator profile smoke test (the single source
//      of truth at /home/ubuntu/.hermes/profiles/momentum/scripts/).
//      Parity runs where the profile file exists (operator VPS / dev machine);
//      it is skipped on GitHub runners, which do not have that path — the
//      factory run on the VPS re-proves it every cycle.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');
const SMOKE = join(ROOT, 'scripts/run-release-smoke.py');
const PROFILE_SMOKE = '/home/ubuntu/.hermes/profiles/momentum/scripts/momentum-smoke.py';
const GATE = join(ROOT, 'scripts/check-bundle-config.mjs');

// scripts/run-release-smoke.py must at least be executable Python — a syntax
// error would zero the release check in CI while every parity assertion
// (string-based) still passes.
function smokeRunnerCompiles(): boolean {
    const r = spawnSync('python3', ['-m', 'py_compile', SMOKE], { encoding: 'utf8' });
    return r.status === 0;
}

// Parity with the operator profile smoke test can only run where that file
// exists (operator VPS / dev machine). GitHub runners do not have it; the
// factory run re-proves parity on the VPS every cycle.
const profileAvailable = existsSync(PROFILE_SMOKE);

describe('run-release-smoke runner sanity (all environments)', () => {
    it('compiles as Python (a syntax error would zero the release check in CI)', () => {
        expect(smokeRunnerCompiles()).toBe(true);
    });
});


// ---- synthetic JWT builders (public test material; signs nothing real) ----
function b64url(obj: object): string {
    return Buffer.from(JSON.stringify(obj)).toString('base64url');
}
function makeJwt(payload: object): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    return `${b64url(header)}.${b64url(payload)}.dummy_signature_not_a_real_secret`;
}
const VPS_KEY = makeJwt({ role: 'anon', iss: 'supabase', iat: 1600000000, exp: 1893456000 });
const CLOUD_KEY = makeJwt({ ref: 'bgusewuzjobjkvcqjndn', iss: 'supabase', role: 'anon', iat: 1600000000, exp: 1893456000 });
const SERVICE_KEY = makeJwt({ ref: 'bgusewuzjobjkvcqjndn', iss: 'supabase', role: 'service_role', iat: 1600000000, exp: 1893456000 });
const VPS_URL = 'https://sb.145.241.109.213.sslip.io';
const CLOUD_URL = 'https://bgusewuzjobjkvcqjndn.supabase.co';

function makeDist(chunks: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), 'l3-gate-'));
    const assets = join(dir, 'dist', 'assets');
    mkdirSync(assets, { recursive: true });
    for (const [name, content] of Object.entries(chunks)) {
        writeFileSync(join(assets, name), content);
    }
    return dir;
}
function runGate(dir: string, extraArgs: string[] = []) {
    return spawnSync('node', [GATE, join(dir, 'dist'), ...extraArgs], { encoding: 'utf8' });
}

describe('bundle config gate — passing bundles', () => {
    it("PASSES strict on a consistent self-hosted bundle (today's real config)", () => {
        const dir = makeDist({
            'index-aaa.js': `const u="${VPS_URL}";const k="${VPS_KEY}";`,
            'react-vendor-bbb.js': '/* no config here */',
        });
        try {
            const r = runGate(dir);
            expect(r.status).toBe(0);
            expect(r.stdout).toContain('clean');
            expect(r.stdout).toContain('self-hosted');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('PASSES strict on a consistent cloud bundle', () => {
        const dir = makeDist({ 'index-aaa.js': `const u="${CLOUD_URL}";const k="${CLOUD_KEY}";` });
        try {
            const r = runGate(dir);
            expect(r.status).toBe(0);
            expect(r.stdout).toContain('cloud ref=bgusewuzjobjkvcqjndn');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('EXCLUDES n8n hosts (parity with the smoke test): n8n.sslip.io is not a database address', () => {
        const dir = makeDist({
            'index-aaa.js': `const u="${VPS_URL}";const k="${VPS_KEY}";const hook="https://n8n.145.241.109.213.sslip.io/webhook/ai";`,
        });
        try {
            const r = runGate(dir);
            expect(r.status).toBe(0);
            expect(r.stdout).toContain('clean');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('REQUIRES a dot in the host (bare https://supabase.co must not silently match)', () => {
        const dir = makeDist({
            'index-aaa.js': `const doc="read https://supabase.co/docs";const u="${VPS_URL}";const k="${VPS_KEY}";`,
        });
        try {
            const r = runGate(dir);
            expect(r.status).toBe(0);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('bundle config gate — incident classes must FAIL', () => {
    it('FAILS strict on an empty-config bundle (run 8 poisoned-deploy class)', () => {
        const dir = makeDist({ 'index-aaa.js': 'const app="no config anywhere";' });
        try {
            const r = runGate(dir);
            expect(r.status).toBe(1);
            expect(r.stderr).toContain('empty config');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('TOLERATES an empty-config bundle only in --ci mode (with a warning)', () => {
        const dir = makeDist({ 'index-aaa.js': 'const app="no config anywhere";' });
        try {
            const r = runGate(dir, ['--ci']);
            expect(r.status).toBe(0);
            expect(r.stdout).toContain('ci');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('FAILS on the 2026-11-13 incident: cloud key against the VPS address', () => {
        const dir = makeDist({ 'index-aaa.js': `const u="${VPS_URL}";const k="${CLOUD_KEY}";` });
        try {
            for (const args of [[], ['--ci']]) {
                const r = runGate(dir, args);
                expect(r.status).toBe(1);
                expect(r.stderr).toContain('KEY/ADDRESS MISMATCH');
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('FAILS on the reverse mismatch: self-hosted key against a cloud address', () => {
        const dir = makeDist({ 'index-aaa.js': `const u="${CLOUD_URL}";const k="${VPS_KEY}";` });
        try {
            const r = runGate(dir);
            expect(r.status).toBe(1);
            expect(r.stderr).toContain('KEY/ADDRESS MISMATCH');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('FAILS when a non-anon key ships (service_role must never reach dist/)', () => {
        const dir = makeDist({ 'index-aaa.js': `const u="${CLOUD_URL}";const k="${SERVICE_KEY}";` });
        try {
            const r = runGate(dir);
            expect(r.status).toBe(1);
            expect(r.stderr).toContain("role is 'service_role'");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('FAILS when two distinct addresses ship (stale deploy mix)', () => {
        const dir = makeDist({
            'index-aaa.js': `const u="${VPS_URL}";const k="${VPS_KEY}";`,
            'other-bbb.js': `const old="${CLOUD_URL}";`,
        });
        try {
            const r = runGate(dir);
            expect(r.status).toBe(1);
            expect(r.stderr).toContain('distinct database addresses');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('FAILS when two distinct keys ship (stale deploy mix)', () => {
        const dir = makeDist({
            'index-aaa.js': `const u="${VPS_URL}";const k1="${VPS_KEY}";const k2="${CLOUD_KEY}";`,
        });
        try {
            const r = runGate(dir);
            expect(r.status).toBe(1);
            expect(r.stderr).toContain('distinct anon-key materials');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('FAILS when address and key live in different chunks (stale-chunk mix)', () => {
        const dir = makeDist({
            'index-aaa.js': `const u="${VPS_URL}";`,
            'supabase-vendor-bbb.js': `const k="${VPS_KEY}";`,
        });
        try {
            const r = runGate(dir);
            expect(r.status).toBe(1);
            expect(r.stderr).toContain('different chunks');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('FAILS when the key is JWT-shaped but does not decode', () => {
        const dir = makeDist({
            'index-aaa.js': `const u="${VPS_URL}";const k="eyJhbGciOiJIUzI1NiJ9.aGVsbG8.dGVzdA";`,
        });
        try {
            const r = runGate(dir);
            expect(r.status).toBe(1);
            expect(r.stderr).toContain('does not decode');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('FAILS on a missing dist directory (gate cannot be skipped silently)', () => {
        const dir = mkdtempSync(join(tmpdir(), 'l3-nodist-'));
        try {
            const r = runGate(dir);
            expect(r.status).toBe(1);
            expect(r.stderr).toContain('not found');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe.runIf(profileAvailable)('run-release-smoke parity with the profile smoke test', () => {
    it('profile smoke script exists on the operator VPS', () => {
        expect(existsSync(PROFILE_SMOKE)).toBe(true);
    });

    it('implements the same check_site() logic as the profile smoke test', () => {
        const repo = readFileSync(SMOKE, 'utf8');
        const profile = readFileSync(PROFILE_SMOKE, 'utf8');

        const checks = [
            'page answers 200',
            'bundle has one database address and one public key',
            'public key belongs to the same database as the address',
            "database accepts the app's own key (data call)",
            "database gateway allows this site's origin (CORS)",
            'sign-in function reachable',
            'email function reachable',
        ];
        for (const c of checks) {
            expect(repo).toContain(c);
            expect(profile).toContain(c);
        }

        // Same discriminators (the 2026-11-13 incident catch) in both files:
        const sharedPatterns = [
            /"ref" in claims/,
            /cloud_key == cloud_url/,
            /claims\.get\("role"\) == "anon"/,
            /if "n8n" not in u/,
            /tasks\?select=id&limit=1/,
            /auth-magic-link/,
            /send-email/,
        ];
        for (const p of sharedPatterns) {
            expect(repo).toMatch(p);
            expect(profile).toMatch(p);
        }
    });

    it('profile-only checks stay profile-only (documented, not silently missing)', () => {
        const repo = readFileSync(SMOKE, 'utf8');
        // The CI runner deliberately omits the browser leg and mail-keys
        // (VPS trust + VPS filesystem). The wrapper must SAY so in its docstring.
        expect(repo).toMatch(/browser leg/);
        expect(repo).toMatch(/mail-keys|mail keys/i);
    });
});
