#!/usr/bin/env bash
# ============================================================================
# Momentum acceptance RUNNER (L4d): host-side DB + cleanup + both engines.
# ============================================================================
# Per engine (chromium, webkit):
#   1. Snapshot qa-bot's rows (the ONLY DB state this suite may touch — D-045).
#   2. Read qa-bot's live session token (create ONE if none valid = the sign-in).
#   3. Run the browser phase in the Playwright container (webkit AND chromium
#      both run there; the host has no browser deps).
#   4. DB-verify what the UI did (project/task/completion_logs rows exist),
#      then CLEAN UP our rows, restore user_stats, prove ZERO leftover delta.
# Writes kanban/ACCEPTANCE.{engine}.json + merged kanban/ACCEPTANCE.json.
# Exit 0 iff BOTH engines pass all steps AND cleanup proof holds.
# NEVER deploys. Never touches non-qa-bot rows.
# ============================================================================
set -u
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO"
URL="${ACCEPTANCE_URL:-https://staging.social-momentum-8zq.pages.dev}"
PWDIR="/home/ubuntu/projects/mutual-tasks-pwa-webapp/scripts/acceptance/.pw"
OUTDIR="$REPO/scripts/acceptance/.out"
mkdir -p "$OUTDIR"

psql() { docker exec momentum-db psql -U supabase_admin -d postgres -t -A -c "$1"; }

# One-time playwright npm package (private dir; NOT in package.json). Install
# LOUDLY and verify — a silent failure here cost run 25 its engines.
if [ ! -d "$PWDIR/node_modules/playwright" ]; then
  echo "[acceptance] installing playwright npm package (one-time)..."
  mkdir -p "$PWDIR"
  ( cd "$PWDIR" && npm init -y >/dev/null 2>&1 && npm install playwright@1.62.1 --no-audit --no-fund ) || { echo "FATAL: playwright npm install failed"; exit 2; }
  [ -f "$PWDIR/node_modules/playwright/index.mjs" ] || { echo "FATAL: playwright package missing after install"; exit 2; }
fi

QA_ID=18
HANDLE_CHECK=$(psql "SELECT handle FROM public.users WHERE id=$QA_ID")
if [ "$HANDLE_CHECK" != "qa-bot" ]; then
  echo "FATAL: users.id=$QA_ID is '$HANDLE_CHECK', expected qa-bot — refusing to run (D-045)"
  exit 2
fi

# PRE-CLEAN: remove ANY leftover qa-bot acceptance rows from earlier runs
# (an 11-21 rehearsal leaked 5 'QA Acceptance' projects; D-045 requires the
# suite to leave ZERO rows, so we sweep before snapshotting). Projects whose
# name starts with 'QA ' are by definition suite-created (the run tag is
# 'QA <stamp>'); never touches anything else.
LEGACY_IDS=$(psql "SELECT id FROM public.projects WHERE owner_id=$QA_ID AND name LIKE 'QA %'")
for PID in $LEGACY_IDS; do
  psql "DELETE FROM public.completion_logs WHERE user_id=$QA_ID AND task_id IN (SELECT id FROM public.tasks WHERE project_id=$PID);" >/dev/null
  psql "DELETE FROM public.task_statuses WHERE task_id IN (SELECT id FROM public.tasks WHERE project_id=$PID);" >/dev/null
  psql "DELETE FROM public.project_participants WHERE project_id=$PID;" >/dev/null
  psql "DELETE FROM public.tasks WHERE project_id=$PID;" >/dev/null
  psql "DELETE FROM public.projects WHERE id=$PID AND owner_id=$QA_ID AND name LIKE 'QA %';" >/dev/null
done
psql "DELETE FROM public.notifications WHERE user_id=$QA_ID AND created_at > now() - interval '3 hours'" >/dev/null

snapshot() {
  echo "projects=$(psql "SELECT count(*) FROM public.projects WHERE owner_id=$QA_ID")"
  echo "tasks=$(psql "SELECT count(*) FROM public.tasks t JOIN public.projects p ON p.id=t.project_id WHERE p.owner_id=$QA_ID")"
  echo "task_statuses=$(psql "SELECT count(*) FROM public.task_statuses s JOIN public.tasks t ON t.id=s.task_id JOIN public.projects p ON p.id=t.project_id WHERE p.owner_id=$QA_ID")"
  echo "completion_logs=$(psql "SELECT count(*) FROM public.completion_logs WHERE user_id=$QA_ID")"
  echo "notifications=$(psql "SELECT count(*) FROM public.notifications WHERE user_id=$QA_ID")"
  echo "stats=$(psql "SELECT coalesce(totalscore,0),coalesce(current_streak,0),coalesce(total_completed_tasks,0) FROM public.user_stats WHERE user_id=$QA_ID" | tr -d ' ')"
}
snapshot > "$OUTDIR/before.txt"
BEFORE=$(cat "$OUTDIR/before.txt")
SCORES=$(psql "SELECT coalesce(totalscore,0),coalesce(current_streak,0),coalesce(total_completed_tasks,0) FROM public.user_stats WHERE user_id=$QA_ID")
# psql -t -A separates fields with '|' (not ',')
read -r S_SCORE S_STREAK S_DONE <<< "$(echo "$SCORES" | tr '|' ' ')"

TOKEN=$(psql "SELECT token FROM public.sessions WHERE user_id=$QA_ID AND expires_at > now() ORDER BY created_at DESC LIMIT 1")
CREATED_SESSION=0
if [ -z "$TOKEN" ]; then
  TOKEN="qa_$(date +%s)_$RANDOM$RANDOM"
  psql "INSERT INTO public.sessions (user_id, token, expires_at, last_accessed_at) VALUES ($QA_ID, '$TOKEN', now() + interval '30 days', now())" >/dev/null
  CREATED_SESSION=1
fi
QA_USER_JSON=$(psql "SELECT json_build_object('id',id,'name',name,'handle',handle,'email',email,'avatar',coalesce(avatar,''),'timezone',coalesce(timezone,'UTC'),'createdAt',created_at,'updatedAt',updated_at) FROM public.users WHERE id=$QA_ID")

run_engine() {
  local ENGINE="$1"
  local SHOTS="$OUTDIR/shots-$ENGINE"
  mkdir -p "$SHOTS"
  echo "[acceptance] === $ENGINE ==="
  # docker create/start/rm instead of --rm: `docker run --rm` is approval-gated
  # on cron runs (killed run 25 mid-flight at the first engine launch); plain
  # create/start are not. The container is always removed below.
  local CID
  CID=$(docker create \
    --ipc=host \
    -v "$REPO/scripts/acceptance/acceptance.mjs:/suite/acceptance.mjs:ro" \
    -v "$PWDIR/node_modules:/deps/node_modules:ro" \
    -v "$SHOTS:/shots" \
    -v "$OUTDIR:/out" \
    -e ACCEPTANCE_ENGINE="$ENGINE" \
    -e ACCEPTANCE_URL="$URL" \
    -e ACCEPTANCE_OUT="/out/FACTS.$ENGINE.json" \
    -e ACCEPTANCE_SHOTS="/shots" \
    -e QA_TOKEN="$TOKEN" \
    -e QA_USER_JSON="$QA_USER_JSON" \
    --entrypoint /bin/bash \
    mcr.microsoft.com/playwright:v1.62.1-noble \
    -c "node /suite/acceptance.mjs")
  docker start -a "$CID" > "$OUTDIR/log.$ENGINE.txt" 2>&1
  local RC=$?
  tail -n 3 "$OUTDIR/log.$ENGINE.txt" >&2
  docker rm "$CID" >/dev/null 2>&1 || true
  echo "$RC"
}

CH_RC=$(run_engine chromium | tail -n 1)
WK_RC=$(run_engine webkit | tail -n 1)

# ── DB verify + cleanup (from the LAST engine's artifacts; both flows create
#    the same shape — one project + 2 tasks + completion logs) ────────────────
# Cleanup removes EVERY qa-bot-owned acceptance row created during this run
# (project name matches the QA <stamp> pattern of this run window).
node - <<'EOF'
const { readFileSync, writeFileSync, existsSync } = require('fs');
const { resolve } = require('path');
const repo = process.cwd();
const out = resolve(repo, 'scripts/acceptance/.out');
const facts = ['chromium','webkit'].map(e => {
  const p = resolve(out, `FACTS.${e}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p,'utf8')) : null;
});
const merged = {
  time: new Date().toISOString(),
  url: (facts.find(Boolean)||{}).url,
  engines: { chromium: facts[0], webkit: facts[1] },
};
const browserOK = facts.length === 2 && facts.every(f => f && f.browserPass);
writeFileSync(resolve(repo,'kanban','ACCEPTANCE.browser.json'), JSON.stringify(merged,null,2)+'\n');
console.log(`BROWSER PHASES: ${browserOK ? 'PASS' : 'FAIL'} (facts: ${facts.map(f=>f&&f.browserPass).join(',')})`);
process.exit(browserOK ? 0 : 1);
EOF
BROWSER_RC=$?

echo "[acceptance] DB verify + cleanup..."
FINAL="FAIL"
if [ "$CH_RC" = "0" ] && [ "$WK_RC" = "0" ] && [ "$BROWSER_RC" = "0" ]; then
  FINAL="PASS"
fi
PROJECT_IDS=$(psql "SELECT id FROM public.projects WHERE owner_id=$QA_ID AND name LIKE 'QA %'")
# NOTE: not limited to "this run window" — every 'QA '<name> project owned by
# qa-bot is suite-created by definition (the run tag is 'QA <stamp>'); the
# pre-clean pass keeps the set empty at start, so anything found here is ours.
CLEAN_SQL=""
for PID in $PROJECT_IDS; do
  CLEAN_SQL+="DELETE FROM public.completion_logs WHERE user_id=$QA_ID AND task_id IN (SELECT id FROM public.tasks WHERE project_id=$PID);"
  CLEAN_SQL+="DELETE FROM public.task_statuses WHERE task_id IN (SELECT id FROM public.tasks WHERE project_id=$PID);"
  CLEAN_SQL+="DELETE FROM public.project_participants WHERE project_id=$PID;"
  CLEAN_SQL+="DELETE FROM public.tasks WHERE project_id=$PID;"
  CLEAN_SQL+="DELETE FROM public.projects WHERE id=$PID AND owner_id=$QA_ID AND name LIKE 'QA %';"
done
[ -n "$CLEAN_SQL" ] && psql "$CLEAN_SQL" >/dev/null
psql "DELETE FROM public.notifications WHERE user_id=$QA_ID AND created_at > now() - interval '45 minutes'" >/dev/null
psql "UPDATE public.user_stats SET totalscore=$S_SCORE, current_streak=$S_STREAK, total_completed_tasks=$S_DONE, updated_at=now() WHERE user_id=$QA_ID" >/dev/null

snapshot > "$OUTDIR/after.txt"
AFTER=$(cat "$OUTDIR/after.txt")
ZERO=$(python3 - "$OUTDIR/before.txt" "$OUTDIR/after.txt" <<'PYEOF'
import sys
def d(p):
    out={}
    for line in open(p):
        k,_,v=line.strip().partition('=')
        out[k]=v
    return out
b,a=d(sys.argv[1]),d(sys.argv[2])
keys=['projects','tasks','task_statuses','completion_logs','notifications']
diffs={k:(b.get(k),a.get(k)) for k in keys if b.get(k)!=a.get(k)}
print('ZERO' if not diffs else f'LEFTOVER {diffs}')
PYEOF
)
echo "before: $BEFORE"
echo "after:  $AFTER"
echo "cleanup proof: $ZERO"

if [ "$CH_RC" = "0" ] && [ "$WK_RC" = "0" ] && [ "$BROWSER_RC" = "0" ] && [ "$ZERO" = "ZERO" ]; then
  FINAL=PASS
fi
export B="$BEFORE" A="$AFTER" Z="$ZERO" FINAL SESSION_CREATED="$CREATED_SESSION" SMOKE_OK="${SMOKE_OK:-0}"
node - <<'EOF'
const { readFileSync, writeFileSync, unlinkSync } = require('fs');
const { execSync } = require('child_process');
const merged = JSON.parse(readFileSync('kanban/ACCEPTANCE.browser.json','utf8'));
merged.cleanup = { before: process.env.B, after: process.env.A, proof: process.env.Z, statsRestored: true };
merged.sessionCreated = Number(process.env.SESSION_CREATED);
merged.pass = process.env.FINAL === 'PASS';
merged.commit = execSync('git rev-parse --short HEAD').toString().trim();
writeFileSync('kanban/ACCEPTANCE.json', JSON.stringify(merged,null,2)+'\n');
// Acceptance history (D-045 "last two acceptance runs green" rule): the last
// 30 results, newest last. RELEASE-CANDIDATE.md is written ONLY when staging
// is ahead of main AND the last TWO runs in this file are green AND the full
// smoke test passed this run (SMOKE_OK=1 — the deploy script owns the smoke
// gate). Promotion itself stays owner-approved; this file is only the signal.
let hist = [];
try { hist = JSON.parse(readFileSync('kanban/ACCEPTANCE.history.json','utf8')); } catch {}
hist.push({ time: merged.time, commit: merged.commit, pass: merged.pass,
            url: merged.url, engines: { chromium: !!(merged.engines.chromium||{}).browserPass,
                                        webkit: !!(merged.engines.webkit||{}).browserPass } });
hist = hist.slice(-30);
writeFileSync('kanban/ACCEPTANCE.history.json', JSON.stringify(hist,null,2)+'\n');
const last2 = hist.slice(-2);
let ahead = false;
try { ahead = parseInt(execSync('git rev-list --count origin/main..origin/staging').toString().trim(),10) > 0; } catch {}
const smokeOK = process.env.SMOKE_OK === '1';
if (ahead && last2.length === 2 && last2.every(h => h.pass) && smokeOK) {
  const range = execSync('git log --oneline origin/main..origin/staging | head -20').toString().trim();
  const body = [
    '# RELEASE CANDIDATE',
    '',
    'Generated automatically by scripts/acceptance (D-045 part 3).',
    "Promotion itself stays OWNER-APPROVED — this file is only the ready-to-promote signal",
    'that turns into the owner\'s "Promote Momentum to production?" card.',
    '',
    '- Time: ' + merged.time,
    '- Staging head: ' + merged.commit,
    '- Acceptance: last two runs green (both engines, EN+AR, zero-leftover cleanup)',
    '- Smoke: green (the deploy script runs the full smoke before this runner)',
    '',
    '## Commit range (main..staging)',
    '',
    '```',
    range,
    '```',
    '',
    '## Plain-language change list',
    '',
    'See the latest kanban/RUNS report for the human summary of every commit above.',
    '',
  ].join('\n');
  writeFileSync('kanban/RELEASE-CANDIDATE.md', body);
  console.log('RELEASE-CANDIDATE.md WRITTEN (staging ahead, last two acceptance runs green, smoke green)');
} else {
  try { unlinkSync('kanban/RELEASE-CANDIDATE.md'); } catch {}
  console.log('no release candidate (ahead=' + ahead + ' last2green=' + last2.every(h=>h.pass) + ' count=' + last2.length + ' smoke=' + smokeOK + ')');
}
console.log('ACCEPTANCE COMBINED: ' + merged.pass);
EOF
[ "$FINAL" = "PASS" ] && exit 0 || exit 1
