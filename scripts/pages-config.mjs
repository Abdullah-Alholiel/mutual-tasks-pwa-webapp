// Generates the Cloudflare Pages control files INTO dist/ after a Pages build
// (npm run pages:build). They must never live in public/: Netlify gives a
// _redirects file precedence over netlify.toml redirects, which would shadow
// the /api/* rules that run Netlify production today (see
// tests/functions/apiRoute.test.ts). dist/ is gitignored on both hosts.
//
// Pages precedence: _routes.json EXCLUDES win over includes; when no function
// matches a path, static assets win over the include list. Excluding static
// top-level files is therefore pure perf (no Functions invoker hop).
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
if (!existsSync(dist)) {
    console.error('pages-config: dist/ missing — run the build first');
    process.exit(1);
}

// ── _headers ────────────────────────────────────────────────────────────────
// Since D-054 (run 18) the canonical _headers lives in public/_headers (committed)
// and vite copies it into dist/ on EVERY build — no longer generated here. That
// makes the security headers deploy-invariant: a plain `vite build` + manual
// wrangler upload (runs 15-18 did exactly that) previously shipped NO headers at
// all (live preview verified headerless 2026-11-19; functions still answered via
// the default /* include, so the gap was invisible to the smoke test).
// Same policy as netlify.toml production headers, hardened per plan A5:
//  - 'unsafe-eval' REMOVED from script-src (F7)
//  - n8n host REMOVED from connect-src (F14 — the browser never calls n8n;
//    the server-side functions do)
// Everything else is byte-parity with netlify.toml.
const PUBLIC_HEADERS = resolve(process.cwd(), 'public', '_headers');
const DIST_HEADERS = join(dist, '_headers');
if (!existsSync(PUBLIC_HEADERS)) {
    console.error('pages-config: public/_headers missing — it is the canonical security headers (D-054)');
    process.exit(1);
}
if (!existsSync(DIST_HEADERS)) {
    console.error('pages-config: dist/_headers missing — vite did not copy public/_headers into dist/');
    process.exit(1);
}
if (readFileSync(PUBLIC_HEADERS, 'utf8') !== readFileSync(DIST_HEADERS, 'utf8')) {
    console.error('pages-config: dist/_headers drifted from public/_headers — the vite public/ copy is broken');
    process.exit(1);
}

// ── _routes.json ────────────────────────────────────────────────────────────
// Functions directory (functions/api/*) serves /api/<fn>. Everything static
// is excluded so only API calls traverse the Functions invoker.
// NOTE: '/*' must NOT be added to include — Cloudflare rejects overlapping
// splat rules ("/*" contains "/api/*"). Paths with no matching function fall
// through to static assets automatically; Pages serves index.html as the SPA
// fallback for unmatched navigations when no top-level 404.html exists.
const staticExcludes = new Set();
for (const name of readdirSync(dist)) {
    if (name.startsWith('_')) continue; // control files never listed
    staticExcludes.add('/' + name);
}
// Hashed asset dir needs a wildcard (assets/index-*.js), as do icon subdirs.
const wildcardExcludes = [];
for (const name of readdirSync(dist)) {
    const p = join(dist, name);
    if (statSync(p).isDirectory() && !name.startsWith('_')) {
        wildcardExcludes.push('/' + name + '/*');
    }
}

const routes = {
    version: 1,
    include: ['/api/*'],
    exclude: [...staticExcludes, ...wildcardExcludes].sort(),
};

writeFileSync(join(dist, '_routes.json'), JSON.stringify(routes, null, 2) + '\n');

// ── sanity: every client API path maps to a built function file ─────────────
const CLIENT_API = [
    'send-push-notification',
    'ai-generate-project',
    'ai-generated-description',
    'ai-confirm-usage',
];
const functionsDir = resolve(process.cwd(), 'functions', 'api');
for (const fn of CLIENT_API) {
    if (!existsSync(resolve(functionsDir, `${fn}.ts`))) {
        console.error(`pages-config: missing functions/api/${fn}.ts`);
        process.exit(1);
    }
}

console.log('pages-config: verified _headers (from public/) + wrote _routes.json to dist/ (routes excludes:', routes.exclude.length + ')');
