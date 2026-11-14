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
// Same policy as netlify.toml production headers, hardened per plan A5:
//  - 'unsafe-eval' REMOVED from script-src (F7)
//  - n8n host REMOVED from connect-src (F14 — the browser never calls n8n;
//    the server-side functions do)
// Everything else is byte-parity with netlify.toml.
const CSP = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.onesignal.com https://api.onesignal.com https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
    "connect-src 'self' https://*.supabase.co https://sb.145.241.109.213.sslip.io wss://sb.145.241.109.213.sslip.io https://*.onesignal.com wss://*.supabase.co wss://*.onesignal.com",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
].join('; ');

const HEADERS = `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: ${CSP}
`;

writeFileSync(join(dist, '_headers'), HEADERS);

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

console.log('pages-config: wrote _headers and _routes.json to dist/ (routes excludes:', routes.exclude.length + ')');
