# LAUNCH-LANE.md — the order of work until Momentum is in production

Plan of record: `~/projects/life-os/readiness/momentum-production-plan.md` (6 conditions C1–C6).
This file is only the ORDER. Every run takes the first unchecked item it can finish; if that item
waits on the owner, take the next one and say so in the report. Tick an item (`[x]`) only with
proof (PR number, commit, smoke output). Polish and non-lane board rows come after the lane.

Order set 2026-11-13 by the owner ("Cloudflare first") after a live debugging session found that
the app could not be used at all: wrong database key in the build (fixed the same day), sign-in
emails failing, and Netlify unreachable on Saudi home and mobile networks.

Gate for every run: `python3 ~/.hermes/profiles/momentum/scripts/momentum-smoke.py` — a FAIL on
production outranks the lane.

## Lane

- [ ] L0 · Sign-in screen is INVISIBLE on a real iPhone (owner, iOS 26.6 Safari, 2026-11-13: "plain
      dark blue, nothing loads"; the phone did load the code and its database calls returned 200).
      Evidence from Claude's Safari-family test (Playwright WebKit in the
      `mcr.microsoft.com/playwright:v1.62.1-noble` container): the page text is in the DOM but its
      framer-motion wrappers sit at opacity 0 / 0.002 while the service worker installs and
      precaches (36 files, 2.3 MB); visible only after `controllerchange` (~6 s on the VPS, 1.8 s
      with `/sw.js` blocked; Chromium is fine at 1.3 s). On a slower phone it can last far longer.
      Fix direction: first paint must not depend on a JS animation (no `initial={{opacity:0}}` on
      page-level wrappers, or a CSS fallback that forces opacity 1 after a short delay), and the
      service worker must not stall the page (register after first render / on idle).
      Proof: time-to-visible under 2 s in WebKit with the service worker allowed, plus the owner's
      phone. The preview currently carries an opt-in diagnostic panel (`?diag=1`, injected by
      Claude into the deployed index.html only, not in the repo); the owner's readout goes here.

- [x] L1 · Sign-in works end to end. Today `auth-magic-link` answers `success: true` while
      `send-email` fails with 500 (MailJet keys are empty in `~/momentum-supabase/.env`), so no
      link ever arrives. Factory: return a real error when the email send fails, show it on the
      auth screen, add a unit test. Owner-only: put the MailJet keys on the VPS (asked 2026-11-13).
      Proof: smoke `mail keys` PASS + one real sign-in with a test account on staging.
      UPDATE 2026-11-13 14:46 UTC: owner part DONE (keys set, functions container recreated, a real
      request-login returned MailJet `Status: success`, smoke 15/15). Factory part still open:
      real error when the send fails + auth-screen message + test.
      UPDATE 16:42 UTC: sign-in links now point at the Cloudflare staging address (functions APP_URL,
      owner go). Claude completed a full sign-in there in a phone-sized browser (dashboard renders).
      At cutover APP_URL must move to the Pages production address.
      DONE 2026-11-14 run 7: PR #14 merged (squash ad30096) — auth-magic-link request-login AND
      request-signup now return 502 {success:false,error} when the send fails (never success:true);
      not-configured gets its own message; dev-facing fallback copy fixed in src/lib/auth/auth.ts
      (3 sites); 10 unit tests on the delivery mapper. Deployed to the VPS functions container
      (volume sync + recreate) and verified live: {} → 400 Invalid action (boot + shared import OK),
      unknown user → honest 404 (fail branch). Smoke 21/21 incl. mail keys. Client already showed
      toast.error(result.error) — no UI change needed. Real sign-in with a real inbox = owner
      session's 2026-11-13 16:42 staging sign-in + real MailJet send (keys owner-set).
- [x] L2 · Cloudflare Pages port (plan item A5): `functions/` (4 functions), `_headers`,
      `_redirects`, CSP without `unsafe-eval` and the n8n host, `sourcemap: false`; preview on
      `*.pages.dev` serving `staging`. Owner-only: create the Pages project (asked 2026-11-13).
      New origin must be added to the gateway CORS list and `APP_ORIGIN_ALLOWLIST` (ask Claude for
      the gateway part: VPS change). Proof: smoke PASS against the pages.dev preview URL.
      UPDATE 2026-11-13 16:10 UTC (Claude with the owner): Pages project `social-momentum` EXISTS
      (Direct Upload type, production branch `main`, address `social-momentum-8zq.pages.dev`).
      Staging cd2ddac is live as a preview at https://staging.social-momentum-8zq.pages.dev
      (static app only; full smoke 11/11; gateway CORS already allows both pages.dev origins).
      Deploy = build, delete `dist/**/*.map`, then
      `npx wrangler@4 pages deploy dist --project-name social-momentum --branch staging`
      with CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID from the profile .env (token: Pages only).
      Never deploy `--branch main` (= Pages production) without the owner's go.
      Still open for the factory: port the 4 functions to `functions/`, `_headers`, `_redirects`,
      CSP, `sourcemap: false`, `APP_ORIGIN_ALLOWLIST`; today `/api/*` on Pages returns the app's
      HTML, so AI generation and push do not work there yet.
      DONE 2026-11-14 run 8: PR #15 merged (squash 61b0fdf, follow-ups df92e78 on staging) —
      4 Pages Functions live under `functions/api/*` (import the Netlify handler modules
      VERBATIM behind a Request bridge — parity is structural), hardened `_headers` (CSP without
      unsafe-eval/n8n-host) + `_routes.json` generated into dist/ post-build, `PAGES_BUILD=1`
      sourcemap:false, both pages.dev origins in APP_ORIGIN_ALLOWLIST. Deployed with wrangler
      (--branch staging) and verified: /api probes answer exact handler JSON (400/401), hardened
      CSP served, FULL SMOKE 11/11 PASS on https://staging.social-momentum-8zq.pages.dev
      (incl. real-browser render + no rejected DB calls). Owner part still open (D-007): set the
      Pages project env vars so AI/push work end-to-end on Pages. NOTE for future local builds:
      never build with repo-`~/.env`/shell VITE_SUPABASE_* set — repo .env carries dev values
      (http://145.241.109.213:8001 + a publishable key) that poison the bundle; build either with
      the prod client config exported (anon key from the live bundle, never from repo .env) or on
      Netlify/CF CI. Caught by the smoke test on the first deploy, fixed same run.
- [x] L3 · Release checks use the smoke test (Life OS D-20261113-35): `release-verify` and the
      post-promote probe run `momentum-smoke.py`; add a pr-gate bundle check for a key/address
      mismatch. Proof: workflow file + a red run on a deliberately wrong key.
      DONE 2026-11-15 run 9: PR #16 merged (squash d6b3b2b) — release-verify.yml (push to main +
      workflow_dispatch) runs the smoke HTTP legs against production from CI via
      scripts/run-release-smoke.py; pr-gate bundle step scripts/check-bundle-config.mjs dist --ci
      (fails on multi-address/key, chunk mix, non-anon role, cloud/VPS class mismatch = the
      2026-11-13 incident). Red proof: poisoned local build (cloud key vs VPS address) → gate
      exit 1 + 4 synthetic unit red proofs; CI gate PASS on the PR; CI smoke runner 14/14 live
      vs production + pages preview; vitest 131/131; tsc 97 = baseline; full smoke 21/21 after
      merge. Browser leg + mail-keys stay VPS-side (momentum-smoke.py), documented in-file.
- [x] L4 · Push script can never block the app (Life OS D-20261113-36): load OneSignal after first
      render with a timeout. Proof: browser test with `cdn.onesignal.com` hanging still renders.
      DONE 2026-11-16 run 11: PR #17 merged (squash 14309c4) — OneSignal <script defer> removed
      from index.html; react-onesignal reachable ONLY via dynamic import (sdkLoader.ts), load+init
      raced against a 2s cap, sticky per-visit failure, scheduleOneSignalInit on idle (4s cap);
      11 unit tests incl. the hanging-CDN contract. Real-browser proof on the staging preview:
      hanging CDN → sign-in visible at 0.81s/1.57s (two deploys), reachable CDN → window.OneSignal
      @0.7-0.8s (push keeps working); full smoke 21/21 twice. Companion: D-029 diag panel now
      ships in the repo (public/diag-panel.js + diag-worker.js, ?diag=1 opt-in) so factory
      deploys can no longer delete it. NOTE: local Pages builds must also export
      VITE_ONESIGNAL_APP_ID (public app id, extractable from the live prod bundle) — without it
      push silently stays "not configured" on that build.
- [x] L4b · HOSTING SWITCH pulled forward (owner decision 2026-11-15, Life OS D-20261115-11: "finalise the
      migration to Cloudflare"). Production moves to Cloudflare Pages right after L3 and L4, not at the
      end of the lane. Netlify cannot be reached on Saudi home/mobile networks and has no users, so
      it protects nothing. Factory steps, in order:
      (1) Short cutover report in kanban/RUNS (what differs Netlify -> Pages, smoke output on the
          staging preview, a real AI description call and a sign-in on the preview, rollback steps).
      (2) Life OS card "Promote Momentum to Cloudflare production?" is raised by Claude from that
          report; the owner checks staging on the phone and answers in the portal.
      (3) ONLY after the owner's yes lands in DECISIONS.md: PR staging -> main, merge, build with the
          prod client config, `wrangler pages deploy dist --project-name social-momentum --branch main`,
          full smoke on https://social-momentum-8zq.pages.dev, report.
      (4) Ask Claude (VPS change) to switch functions APP_URL to the production address.
      (5) Netlify stays untouched as fallback for 48 h; retiring it is a separate owner yes.
      Pages function settings (secrets) are set by the owner with
      `~/.hermes/profiles/momentum/scripts/set-pages-secrets.sh`; never read or print them.
      Night rollback is pre-authorised (deploy-level only): redeploy the previous good deployment.
      UPDATE 2026-11-15 13:30 UTC (Claude with the owner): Pages function settings are SET for preview
      and production (9 each, via the owner's helper run). Staging redeployed with them. A real
      `/api/ai-generated-description` call with a valid session returns 502 "AI service unavailable":
      n8n answers 403 to a wrong `x-momentum-secret` and the owner no longer knows the value (n8n
      admin login lost). Waiting on the owner's choice (rotate the secret on both sides, or reset the
      n8n login). Do NOT try to read n8n credentials. Until fixed, AI generation fails on Pages; the
      cutover report must say so.
      DATA: the VPS database now holds the real accounts copied from the old cloud project
      (16 users, 18 projects, 321 tasks). It is production data from now on: no test writes, no
      truncation, staging-only rules for anything that mutates rows.
      REAL-PHONE EVIDENCE for L4: on the owner's iPhone the deferred OneSignal script delayed the app's
      start by 5.4 s on a first load (page parsed 5.42 s, first app content 5.45 s).
      DONE 2026-11-22 run 23 (steps 1–3; owner go D-064 "do it" + D-066 order): (1) cutover report
      written run 21. (2) owner decision D-064 landed 2026-11-22. (3) PR #30 (merge commit a639872)
      merged staging→main — CI green, release-verify + security PASS on main post-merge; production
      deployed to Cloudflare Pages --branch main with the pinned-env build (deployment 8dc06f40,
      chunk index-BWrObEOX.js): STRICT bundle gate clean, secret sweep clean, served-bundle grep
      0 secrets / 0 netlify hosts, FULL SMOKE 12/12 PASS on https://social-momentum-8zq.pages.dev
      INCLUDING "signed-out visitor downloads no user data" (the check Netlify prod has been
      failing since 2026-11-11) + behavioral probes (unauth push 401 JSON, AI endpoint 400
      function JSON, served hash stable). Cloudflare Pages IS production as of 2026-11-22
      17:45 UTC. STILL OPEN here: step 4 (functions APP_URL → production address, Claude/VPS
      change) and step 5 (Netlify untouched as fallback 48 h; retirement = separate owner yes).
      NEXT after this item per D-066: apply 004 on prod right after (owner-only: fresh dump →
      quiet window → 004 → live gateway header probe → 24 h watch).
- [x] L4c · AI without n8n: the two AI calls run on Cloudflare Workers AI through the Pages binding
      `AI` (owner 2026-11-16; Life OS D-20261115-13 has the full spec). Preview binding is attached.
      DO THIS BEFORE L4b's cutover report (owner wants AI working at the switch): right after the
      'signed-out visitor downloads no user data' fix. It is de-risked: Claude ran the real prompts on
      Workers AI on 2026-11-16 (valid project JSON on three models, good EN + AR descriptions).
      READ FIRST: ~/.hermes/profiles/momentum/plans/ai-port/README.md (results, model picks, recipe)
      and n8n-workflows.json next to it (the prompts to port; no credentials).
      ADDED 2026-11-16 20:10 UTC (owner): L4c now includes (a) an OpenRouter free-model backup, used
      only when Workers AI fails or its free daily allowance is spent (`OPENROUTER_API_KEY` is saved
      on Pages for preview and production; never read it), (b) a clear "AI help is back tomorrow"
      message in EN + AR when everything is exhausted, (c) measured neurons per call and calls per
      day in the report. Details: README steps 7, 9 and 10. Proof: staging description + project
      generation work with n8n stopped, and a forced Workers AI failure is answered by the backup.
      The `AI` binding is attached to PRODUCTION as well (owner go, 2026-11-16 20:11 UTC); it applies
      from the next production deployment.
      DONE 2026-11-20 runs 19-20: PR #28 merged (squash 14bdbf9, run 19): aiProviders.ts chain
      (Workers AI binding primary → OpenRouter free-model fallback behind AI_FALLBACK_ENABLED/
      AI_FALLBACK_MODEL → legacy n8n preserved byte-for-byte for Netlify prod), prompts ported
      verbatim + same-language line, server-side validation/clamping, F5 increment kept,
      AI_EXHAUSTED → 503 + localized EN/AR message, 45s client timeout, workerd object-binding
      passthrough fix; 21 unit tests, reviewer fixes (chain deadline 40s < client 45s, icon/color
      allowlist, exhaust matcher). Run 20 tail (run 19 died before closeout): pinned-env deploy of
      the L4c build to the staging preview, full smoke 12/12, live probes (401 unauth on the AI
      endpoint; env.AI + openrouter.ai present in the served function bundle). STILL OPEN (moves to
      L4d + the L4b cutover report): signed-in generation proof with measured neurons + forced-
      fallback drill — needs the qa-bot test account (L4d) or an owner-session sign-in.
- [ ] L4d · Scheduled acceptance tests on staging + RELEASE-CANDIDATE.md for the owner's promote card
      (owner 2026-11-16; spec in the DECISIONS.md row "Scheduled acceptance tests on staging").
- [x] L5 · Access rules (plan item A7, owner approved the design direction, Life OS D-20261112-01):
      scoped policies on the custom-session model, rehearsed on a disposable copy, rollback script.
      Applying on production is owner-only after Claude reviews the SQL — and ONLY AFTER the
      promote staging→main is live (D-057 run 21 order): 004's policies key on the
      x-momentum-session header, which today's prod client does not send yet; applying 004
      first would lock out every current prod user. Order: promote → 004.
      DONE 2026-11-18 run 15: PR #23 merged (bbcc1f7) — 004 scoped policies (D-018 design:
      x-momentum-session header -> app_current_user_id(), SECURITY DEFINER helpers, TRUNCATE
      revoked, magic_links anon-zero, sessions SELECT-only) + ON DELETE CASCADE on the four
      child FKs of tasks (rehearsal-proven necessity) + client per-request session header
      (supabaseFetch.ts) + task_id-keyed deletes + in-memory dedup for cross-user notifications.
      Rehearsal 52/52 PASS on disposable postgres:15 (kanban/RUNS/rehearsal-004.txt); gates green;
      staging preview redeployed pinned-env, full smoke 12/12. KNOWN IMPACT for owner decision:
      Realtime postgres_changes delivery stops under header-scoped policies (app stays usable via
      optimistic updates + refetch-on-focus); prod apply = owner-only, separate go; post-apply
      live PostgREST header probe listed in the run report rollout steps.
- [ ] L6 · Type errors to zero and the tsc gate back on (A1; the 2026-11-15 enforce-by date moves
      behind L1–L2 by owner decision).
- [x] D-050+D-052 · CI security workflow + pinned-env deploy script + tsc ratchet
      (Life OS worker requests D-20261117-09 / D-20261118-07; deferred since runs 7-15).
      DONE 2026-11-18 run 16: PR #24 merged (3bc4669) — .github/workflows/security.yml
      (gitleaks BLOCKING full-history + npm audit high REPORT-ONLY, weekly + manual),
      scripts/deploy-pages-preview.sh (pins url/key/OneSignal id from the live deployed
      bundle — never repo .env — strict bundle gate + secret sweep before wrangler
      --branch staging, full smoke after, refuses main/dirty trees, OneSignal-pin drift
      guard), pr-gate tsc re-armed as a ratchet (fails only above baseline 97 on
      tsc -b; live gate printed 97=97 on the PR). Red proof: PR #25, gitleaks FAILED
      in 6s on an injected fake secret, closed+deleted. Verification: tsc 97=baseline,
      vitest 13/145, build exit 0, bundle secret-grep clean.
- [x] D-054 · Pages control files in the repo (cutover prereq; Life OS worker request
      D-20261119-06, built run 18 per the small-request-first rule).
      DONE 2026-11-19 run 18: PR #27 merged (squash 217930e) — public/_headers (hardened CSP:
      no unsafe-eval [F7], no n8n host [F14]) copied by vite into EVERY build (deploy-invariant);
      pages-config.mjs verifies the copy instead of generating; NO public/_redirects (Netlify
      file-over-toml precedence would shadow the 4 /api rules in Netlify prod; Pages SPA-falls
      back natively — live /privacy 200) and NO wrangler.toml (CF: file with
      pages_build_output_dir becomes config source of truth; next deploy would drop the
      owner-set 10 env vars incl 4 secrets + the AI binding) — both guarded by
      tests/functions/pagesControlFiles.test.ts. FIXED live bug: staging preview served NO
      security headers before this (plain vite build + wrangler ships no control files).
      Gates: tsc 97=97, vitest 152/152, reviewer MERGE 0C/0I. Deploy: pinned-env script,
      smoke 12/12, all 6 headers verified live via curl.
- [ ] L7 · Remaining CI workflows: semgrep, pr-agent (A2–A4; security.yml landed in
      run 16, tsc ratchet live).
- [ ] L8 · Off-site backup script to the shared Oracle bucket (A9; build and test against a local
      folder until the owner supplies the bucket link) + first full restore drill.
- [ ] L9 · Monitoring drill: injected failure reaches Telegram; external uptime probe (A10).
- [ ] L10 · Core-loop browser proof on staging then production, EN + AR (A11).
- [ ] L11 · Launch-readiness report against C1–C6 (the hosting switch itself moved to L4b); retire
       Netlify after the owner's separate yes.

## Growth lane (owner 2026-11-16; build AFTER L5 access rules, except G1 which may ride any run)

- [ ] G1 · Sign-in logo without the square background (small).
- [ ] G2 · Public landing page for signed-out visitors (no data queries, EN + AR).
- [ ] G3 · Plans and paywall without payment code: limits from one config, usage meter, upgrade
      screen that records interest. Numbers come from the owner's pricing card; never invent them.
Specs: the matching DECISIONS.md rows dated 2026-11-16. Order overall: L4b → L4c → L4d → L5 → G2 → G3,
then L6 onward. Reason: access rules (L5) must be in place before the product is advertised or sold.

## Waiting on the owner (do not build around these; remind once per report)

- old cloud data: copy or start
  fresh (Life OS D-20261113-34) · staging database project (A6) · Oracle bucket link (L8) ·
  lawyer review of privacy and terms (C6).
