// ============================================================================
// Bundle-config check (D-023 leg 2 / lane L3)
// ============================================================================
// Incident class (2026-11-13): production was reported "verified live" for
// weeks while nobody could sign in — the bundle carried the OLD CLOUD project's
// anon key against the VPS database address. The key was valid JWT-shaped and
// the page returned 200, so every earlier check passed.
//
// Everything is derived from dist/ (no secrets, no fixtures — URL and key are
// read FROM the built bundle, exactly like the smoke test reads them from the
// DEPLOYED site):
//   1. at most ONE distinct supabase database address across the bundle
//   2. at most ONE distinct anon-key material (JWT-shaped or sb_publishable_*)
//   3. address and key live in the SAME chunk (stale-chunk mix detection)
//   4. a JWT-shaped key must decode with role "anon" (never ship anything else)
//   5. host-class match: cloud keys (JWT with a `ref` claim) belong to
//      *.supabase.co URLs; self-hosted key shapes (no `ref`) belong to
//      non-supabase.co URLs. This is the exact 2026-11-13 discriminator.
// 6. RESIDUAL RISK (documented, accepted at D-023 scope): two DIFFERENT
//    self-hosted projects (two no-ref keys / two sslip.io hosts) are
//    class-identical, so a cross-project self-hosted mix is not detectable by
//    shape alone — the smoke test's live data-call covers the deployed site.
//
// Modes:
//   default (STRICT — deploy/local builds): "no config in the bundle" FAILS.
//     A deploy build MUST carry the client config; an empty-config bundle
//     ships an app that cannot load any data (run 8's poisoned-deploy class).
//   --ci (pr-gate on GitHub): repo .env is git-ignored, CI builds carry NO
//     env by design — zero-config is the CI norm and is tolerated with a
//     warning (deploy-time injection owns it, enforced by the strict mode in
//     deploy tooling). Everything VISIBLE is still enforced: a second
//     address/key, a stale-chunk mix, a non-anon key role, or a cloud/VPS
//     class mismatch fails in --ci mode too.
//
// Usage: node scripts/check-bundle-config.mjs [distDir] [--ci]
// Exit 0 = consistent, 1 = violation (fails the PR check / deploy).
// ============================================================================
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const flagArgs = process.argv.slice(2).filter((a) => a.startsWith("--"));
const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const ciMode = flagArgs.includes("--ci");
const distDir = positional[0] || "dist";
const assetsDir = join(distDir, "assets");

let jsFiles;
try {
  jsFiles = readdirSync(assetsDir).filter((f) => f.endsWith(".js"));
} catch {
  console.error(`::error::${assetsDir} not found — run the build before this gate`);
  process.exit(1);
}
if (jsFiles.length === 0) {
  console.error(`::error::no .js chunks in ${assetsDir}`);
  process.exit(1);
}

const urlRe = /https:\/\/[a-z0-9.-]+\.(?:supabase\.co|sslip\.io)/g;
const jwtRe = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const pubRe = /sb_publishable_[A-Za-z0-9_-]+/g;

// value -> chunk that carries it (unique-value semantics, same as the smoke
// test's "one database address and one public key" check)
const urlChunk = new Map();
const keyChunk = new Map();
for (const f of jsFiles) {
  const text = readFileSync(join(assetsDir, f), "utf8");
  for (const m of text.matchAll(urlRe)) {
    if (m[0].includes("n8n")) continue; // n8n host parity with the smoke test
    if (!urlChunk.has(m[0])) urlChunk.set(m[0], f);
  }
  for (const m of text.matchAll(jwtRe)) if (!keyChunk.has(m[0])) keyChunk.set(m[0], f);
  for (const m of text.matchAll(pubRe)) if (!keyChunk.has(m[0])) keyChunk.set(m[0], f);
}

const problems = [];

if (urlChunk.size === 0) {
  if (ciMode) {
    console.log(
      "bundle config gate (ci): no database address in the bundle — expected on GitHub CI " +
        "(repo .env is not committed); the STRICT gate runs at deploy time"
    );
  } else {
    problems.push(
      "no Supabase database address in the built bundle: the app ships with an " +
        "empty config and cannot load any data (inject the client config at build time)"
    );
  }
} else if (urlChunk.size > 1) {
  problems.push(
    `${urlChunk.size} distinct database addresses in the bundle (expected one): ` +
      [...urlChunk.keys()].join(", ")
  );
}

if (keyChunk.size === 0) {
  if (!ciMode) {
    problems.push("no anon-key material in the built bundle (app would ship unconfigured)");
  }
} else if (keyChunk.size > 1) {
  problems.push(
    `${keyChunk.size} distinct anon-key materials in the bundle (expected one): ` +
      [...keyChunk.keys()].map((k) => `${k.slice(0, 24)}…`).join(", ")
  );
}

if (urlChunk.size === 1 && keyChunk.size === 1) {
  const [uChunk] = urlChunk.values();
  const [kChunk] = keyChunk.values();
  if (uChunk !== kChunk) {
    problems.push(`address and key live in different chunks (${uChunk} vs ${kChunk}) — stale-chunk mix`);
  }
}

// ---- decode the single key / url the bundle carries ----
function jwtPayload(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  } catch {
    return null;
  }
}

let url = null;
let payload = null;
if (urlChunk.size === 1 && keyChunk.size === 1) {
  url = [...urlChunk.keys()][0];
  const key = [...keyChunk.keys()][0];
  if (key.startsWith("eyJ")) {
    payload = jwtPayload(key);
    if (!payload) problems.push("bundle key is JWT-shaped but its payload does not decode");
  }
}

let keyIsCloud = false;
if (payload) {
  keyIsCloud = "ref" in payload;
  if (payload.role !== "anon") {
    problems.push(`bundle key role is '${payload.role}', expected 'anon' — a non-anon key must never ship`);
  }
}
let urlIsCloud = null;
if (url) urlIsCloud = /\.supabase\.co(\/|:|$)/.test(url);
if (payload && urlIsCloud !== null && keyIsCloud !== urlIsCloud) {
  problems.push(
    `KEY/ADDRESS MISMATCH (the 2026-11-13 incident class): bundle address is ${
      urlIsCloud ? "a cloud supabase.co project" : "self-hosted (non-supabase.co)"
    } but the key is a ${keyIsCloud ? `cloud project key (ref=${payload.ref})` : "self-hosted key shape (no ref claim)"}`
  );
}

if (problems.length > 0) {
  console.error(`::error::bundle config gate${ciMode ? " (ci)" : ""} FAILED:`);
  for (const p of problems) console.error(`::error::- ${p}`);
  console.error(
    `::error::distinctAddresses=${urlChunk.size} distinctKeys=${keyChunk.size} url=${url} ` +
      `urlIsCloud=${urlIsCloud} keyIsCloud=${keyIsCloud}`
  );
  process.exit(1);
}

const where =
  urlChunk.size === 1 ? `chunk=${[...urlChunk.values()][0]}` : "no config (tolerated in ci mode)";
console.log(
  `bundle config gate${ciMode ? " (ci)" : ""}: clean (${where} ` +
    `address=${urlIsCloud === null ? "n/a" : urlIsCloud ? "cloud" : "self-hosted"} ` +
    `key=${payload ? (keyIsCloud ? `cloud ref=${payload.ref}` : "self-hosted shape") : urlChunk.size === 1 ? "publishable-shape" : "n/a"} ` +
    `role=${payload ? payload.role : "n/a"})`
);
