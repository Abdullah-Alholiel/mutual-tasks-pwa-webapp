#!/usr/bin/env bash
# scripts/deploy-pages-preview.sh — pinned-env staging-preview deploy (D-026 / D-052).
#
# Closes the run-8 env-poison class for good: the repo .env carries DEV Supabase
# values (http://145.241.109.213:8001 + a publishable key) and vite merges
# process.env OVER .env files, so any unpinned local build poisons the bundle.
# This script exports the VPS-stack client config explicitly, builds, gates,
# deploys to the Pages STAGING branch only, then runs the smoke test against
# the deployed preview and exits non-zero on any FAIL.
#
# Key material source: the LIVE PRODUCTION BUNDLE (public by design). The repo
# .env is never trusted for keys. Values are never printed — fingerprints only.
#
# NEVER deploys --branch main (= Pages production). Refuses dirty trees.
#
# Usage:
#   scripts/deploy-pages-preview.sh [--skip-smoke]   # staging preview only

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

BRANCH=$(git rev-parse --abbrev-ref HEAD)
PROJECT_NAME="social-momentum"
PREVIEW_URL="https://staging.${PROJECT_NAME}-8zq.pages.dev"
# The Pages PRODUCTION address is empty until the owner-approved cutover (L4b);
# the STAGING preview (last pinned-env factory deploy) is the standing key source.
# If you ever add a second key source, keep the pin count at ONE and re-verify.
KEY_SOURCES=("https://staging.${PROJECT_NAME}-8zq.pages.dev/" "https://${PROJECT_NAME}-8zq.pages.dev/")
SMOKE="/home/ubuntu/.hermes/profiles/momentum/scripts/momentum-smoke.py"

log() { printf '[deploy-pages-preview] %s\n' "$*"; }
die() { printf '[deploy-pages-preview] ERROR: %s\n' "$*" >&2; exit 1; }

# ── guard rails ─────────────────────────────────────────────────────────────
[ "$BRANCH" = "staging" ] || die "refuses branch '$BRANCH' — staging only (--branch main is production)"
command -v npx >/dev/null || die "npx not found"
command -v curl >/dev/null || die "curl not found"
[ -f "$SMOKE" ] || die "smoke script not found: $SMOKE"
if ! git diff --quiet || ! git diff --cached --quiet; then
  die "refuses a dirty tree — commit or stash first (shared-checkout discipline)"
fi

# ── fingerprint helper (never print a full key) ─────────────────────────────
fp() {
  local v=$1
  if [ -z "$v" ]; then printf '<missing>'; return; fi
  if [ ${#v} -ge 16 ]; then printf '%s...%s' "${v:0:8}" "${v: -4}"; else printf '<%d chars>' "${#v}"; fi
}

# ── read the public client config from the live deployed bundle ─────────────
log "reading the live deployed bundle for the public client config"
TMPDIR_OT=$(mktemp -d)
trap 'rm -rf "$TMPDIR_OT"' EXIT
PIN_URL=""; PIN_KEY=""; PIN_ONESIGNAL=""
for LIVE_BUNDLE in "${KEY_SOURCES[@]}"; do
  if curl -fsS --max-time 20 "$LIVE_BUNDLE" -o "$TMPDIR_OT/index.html" 2>/dev/null; then
    INDEX_JS=$(grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' "$TMPDIR_OT/index.html" | head -1)
    [ -n "$INDEX_JS" ] || continue
    curl -fsS --max-time 30 "${LIVE_BUNDLE}${INDEX_JS}" -o "$TMPDIR_OT/bundle.js" 2>/dev/null || continue
    PIN_URL=$(grep -oE 'https://[a-z0-9.-]+\.(supabase\.co|sslip\.io)' "$TMPDIR_OT/bundle.js" \
              | grep -v n8n | sort -u | head -1 || true)
    # The anon key is JWT-shaped (eyJ…): distinct JWTs; exactly one is correct.
    PIN_KEY=$(grep -oE 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' "$TMPDIR_OT/bundle.js" \
              | sort -u | head -1 || true)
    # The OneSignal app id is inlined as VITE_ONESIGNAL_APP_ID:"<uuid>"; a bare
    # UUID grep also matches the Sentry debug id, so anchor on the env inline.
    PIN_ONESIGNAL=$(grep -oE 'VITE_ONESIGNAL_APP_ID[":= ]+[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' \
                    "$TMPDIR_OT/bundle.js" | grep -oE '[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}' | head -1 || true)
    [ -n "$PIN_URL" ] && [ -n "$PIN_KEY" ] && break
  fi
done

[ -n "$PIN_URL" ] || die "no Supabase address found in the live bundle"
[ -n "$PIN_KEY" ] || die "no public key found in the live bundle"
[ -n "$PIN_ONESIGNAL" ] || die "no OneSignal app id found in the live bundle (push would silently stay off)"
# D-052 pins the OneSignal app id constant (public value, D-044): a mismatch
# means the deployed bundle drifted — refuse rather than propagate it.
if [ "$PIN_ONESIGNAL" != "fa9620b0-7c86-49c0-a7e5-1430e32a923d" ]; then
  die "OneSignal app id drift: bundle carries a different id than the D-052 pin — investigate before deploying"
fi
# D-077: VITE_SENTRY_DSN travels the same pin path WHEN a DSN exists at all
# (the live bundle today carries `void 0` — Sentry is off client-side and no
# DSN is recorded on the VPS). Pin-if-present: extract the DSN from the live
# bundle so a future Sentry-on deploy can never drift its key sources; missing
# DSN is a logged warning, never a failure (we do not invent a value).
PIN_SENTRY=$(grep -oE 'https://[0-9a-f]{32}@o[0-9]+\.ingest\.[a-z.]*sentry\.io/[0-9]+' \
             "$TMPDIR_OT/bundle.js" | head -1 || true)
if [ -n "$PIN_SENTRY" ]; then
  export VITE_SENTRY_DSN="$PIN_SENTRY"
  log "pins: sentry dsn=$(fp "$PIN_SENTRY")"
else
  unset VITE_SENTRY_DSN 2>/dev/null || true
  log "pins: sentry dsn not published in the live bundle (VITE_SENTRY_DSN stays unset)"
fi
log "pins: url=$PIN_URL key=$(fp "$PIN_KEY") onesignal=$(fp "$PIN_ONESIGNAL")"

# ── export the pins (highest precedence — beats any repo .env value) ────────
export VITE_SUPABASE_URL="$PIN_URL"
export VITE_SUPABASE_ANON_KEY="$PIN_KEY"
export VITE_ONESIGNAL_APP_ID="$PIN_ONESIGNAL"
unset VITE_SUPABASE_SERVICE_ROLE_KEY SUPABASE_SERVICE_ROLE_KEY 2>/dev/null || true

# ── deps + build ────────────────────────────────────────────────────────────
if [ ! -d node_modules ]; then
  log "installing dependencies (fresh checkout, lockfile-pinned)"
  npm ci --no-audit --no-fund
fi

log "building (PAGES_BUILD=1, hardened headers/routes generated into dist/)"
npm run pages:build

log "deleting sourcemaps from dist/"
find dist -name '*.map' -type f -delete

# ── gates: strict bundle-config gate + secret sweep ────────────────────────
log "gate: bundle config (STRICT — one address, one key, matching database class)"
node scripts/check-bundle-config.mjs dist

log "gate: secret sweep (service-role key material must never ship)"
SECRET_HITS=$(grep -lE 'sb_secret_|VITE_SUPABASE_SERVICE_ROLE_KEY' dist/assets/*.js 2>/dev/null || true)
if [ -n "$SECRET_HITS" ]; then
  die "secret material found in the client bundle: $SECRET_HITS"
fi
log "gate: secret sweep clean"

# ── deploy: Pages STAGING branch ONLY ───────────────────────────────────────
# Cloudflare creds: honor pre-exported CLOUDFLARE_*; otherwise extract exactly
# those two names from the operator profile .env (values never echoed; vite
# only inlines VITE_*, and the strict bundle gate above re-checks the output).
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] || [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  PROFILE_ENV="/home/ubuntu/.hermes/profiles/momentum/.env"
  if [ -f "$PROFILE_ENV" ]; then
    log "loading Cloudflare credentials from the operator profile .env (values never printed)"
    _cf_token=$(grep -E '^CLOUDFLARE_API_TOKEN=' "$PROFILE_ENV" | tail -1 | cut -d= -f2- | tr -d '"'"'"'')
    _cf_account=$(grep -E '^CLOUDFLARE_ACCOUNT_ID=' "$PROFILE_ENV" | tail -1 | cut -d= -f2- | tr -d '"'"'"'')
    export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-$_cf_token}"
    export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-$_cf_account}"
  fi
fi
[ -n "${CLOUDFLARE_API_TOKEN:-}" ] && [ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ] \
  || die "Cloudflare credentials not found (export CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID, or the operator profile .env must exist)"

log "deploying dist/ to Pages project $PROJECT_NAME --branch staging"
npx wrangler@4 pages deploy dist --project-name "$PROJECT_NAME" --branch staging

# ── smoke gate on the deployed preview ──────────────────────────────────────
if [ "${1:-}" = "--skip-smoke" ]; then
  log "smoke skipped (--skip-smoke) — deploy DONE, run the full smoke before trusting this deploy"
  exit 0
fi

log "running the full smoke test against $PREVIEW_URL (exit non-zero on any FAIL)"
python3 "$SMOKE" "$PREVIEW_URL"
log "deploy DONE + smoke PASS: $PREVIEW_URL"
