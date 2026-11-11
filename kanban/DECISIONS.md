# DECISIONS.md — Momentum owner decision ledger

Primacy: every run MUST read this first (KICKOFF §0) and refuse work that contradicts it.
Add rows as: `| date | decision | detail | owner |`. Never delete rows — supersede them with a
new row that references the old one. Owner = Abdullah (Telegram).

| # | date | decision | detail | owner |
|---|------|----------|--------|-------|
| D-001 | 2026-11-05 | Branch model: `staging` / `main` | `staging` = all factory work (feature branch → PR → staging). `main` = release-only, reached ONLY by an owner-approved PR `staging → main`. Never push to main. `vps-deploy` retired (0 commits ahead of main at retirement). | Abdullah |
| D-002 | 2026-11-05 | Hosting target: Cloudflare Pages | main → Production env (prod Supabase), staging → Preview env (staging Supabase). 4 Netlify functions port to `functions/` Pages Functions. Netlify (social-momentum.netlify.app) stays live until the cutover is verified, then retires. Cutover itself is owner-approved. | Abdullah |
| D-003 | 2026-11-05 | NEVER Cloudflare R2 for offsite backup | R2 object storage TLS-rejects this Oracle ASN at handshake (pre-auth, verified twice). Generalisation corrected: api.cloudflare.com + pages.dev work fine from this VPS — only R2 fails. Offsite v1 = age-encrypted dumps → private GitHub repo; Backblaze B2 when data grows. Target needs owner approval before first push. | Abdullah |
| D-004 | 2026-11-05 | Payments provider: UNDECIDED | Owner decision, open. Verified facts: Moyasar requires CR OR freelance license + Saudi bank account (Saudi-only); Lemon Squeezy lists Saudi Arabia for bank payouts and is merchant-of-record. NO provider code paths until decided. `momentum-payments` skill stays a placeholder. | Abdullah |
| D-005 | 2026-11-05 | AI limits are owner-only | `AI_USAGE_LIMITS` (today: 3 AI project gens + 10 AI descriptions/day, free tier) and all plan limits change ONLY by owner order. P2 moves the source of truth to the DB (`plan_limits` + atomic `consume_ai_usage` RPC) but the change authority stays owner-only. | Abdullah |
| D-006 | 2026-11-05 | Release autonomy: Level A | Every promote `staging → main` is owner-approved via Telegram yes/no. Level B (auto-promote) unlocks only when ALL P3 conditions hold (10 consecutive green promotes, all gates enforcing, RLS 100% + bundle clean 14d, rollback drill <15 min, 2 restore drills, Telegram ack tested, branch+push protection on). | Abdullah |
| D-007 | 2026-11-07 | Resume the Momentum factory loop (2 runs/day) or keep it paused? → Resume at 1 run/day off-peak | Factory cron paused, no commits since 2026-10-25; STATE.json says paused until owner go on P1 (Life OS portal D-20261106-30) | Abdullah |
| D-008 | 2026-11-07 | Give the go for Momentum P1 (Cloudflare Pages migration)? → Go on P1 | Factory crons wait for owner go on P1; D-002 hosting target; STATE.json (Life OS portal D-20261106-31) | Abdullah |
| D-009 | 2026-11-07 | Choose the payments provider (Moyasar vs Lemon Squeezy) → Decide later, no payment code yet | D-004 undecided; Moyasar needs CR/freelance license, Lemon Squeezy is merchant-of-record; blocks P2 paid AI tier (Life OS portal D-20261106-32) | Abdullah |
| D-010 | 2026-11-07 | Approve Netlify to Cloudflare Pages cutover when verified? → Approve after verification report | Owner-only per standing list; Netlify stays live until cutover verified (D-002) (Life OS portal D-20261106-33) | Abdullah |
| D-011 | 2026-11-07 | Buy a domain for public launch (P4)? → Defer until P3 done | P4 needs owner-bought domain for Pages custom domain and Tunnel; KICKOFF (Life OS portal D-20261106-34) | Abdullah |
| D-012 | 2026-11-07 | Confirm AI free-tier limits (3 project gens, 10 descriptions/day) → Keep current limits | D-005 says only owner changes limits; P2 moves them to DB (Life OS portal D-20261106-35) | Abdullah |
| D-013 | 2026-11-11 | Momentum next run: fix the error-detail leak on the 3 AI functions and close P1-6b as done? → Yes | Reviewer-confirmed small slice; board hygiene. Reversible, staging only (Life OS portal D-20261110-04) | Abdullah |
| D-014 | 2026-11-11 | Promote Momentum staging to main (2 security fixes waiting)? → Promote now | Production still has the push hole (any logged-in user can push any text to any user) and broken /api routes until PRs #6 and #7 are promoted; both are green on staging (Life OS portal D-20261110-01) | Abdullah |

## Standing owner-only list (always escalate, never do alone)

promote to main · prod DB migrations · RLS or auth changes · key/secret rotation ·
payments provider and code paths · `AI_USAGE_LIMITS` / plan limits · domain/DNS/Tunnel ·
Netlify → Cloudflare Pages cutover · backup deletion · anything on the VPS outside this
project's containers/units · KoraLink or other profiles' files.
