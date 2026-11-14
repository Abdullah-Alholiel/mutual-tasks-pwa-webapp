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
- [ ] L2 · Cloudflare Pages port (plan item A5): `functions/` (4 functions), `_headers`,
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
- [ ] L3 · Release checks use the smoke test (Life OS D-20261113-35): `release-verify` and the
      post-promote probe run `momentum-smoke.py`; add a pr-gate bundle check for a key/address
      mismatch. Proof: workflow file + a red run on a deliberately wrong key.
- [ ] L4 · Push script can never block the app (Life OS D-20261113-36): load OneSignal after first
      render with a timeout. Proof: browser test with `cdn.onesignal.com` hanging still renders.
- [ ] L5 · Access rules (plan item A7, owner approved the design direction, Life OS D-20261112-01):
      scoped policies on the custom-session model, rehearsed on a disposable copy, rollback script.
      Applying on production is owner-only after Claude reviews the SQL.
- [ ] L6 · Type errors to zero and the tsc gate back on (A1; the 2026-11-15 enforce-by date moves
      behind L1–L2 by owner decision).
- [ ] L7 · Remaining CI workflows: security (gitleaks, npm audit high), semgrep, pr-agent (A2–A4).
- [ ] L8 · Off-site backup script to the shared Oracle bucket (A9; build and test against a local
      folder until the owner supplies the bucket link) + first full restore drill.
- [ ] L9 · Monitoring drill: injected failure reaches Telegram; external uptime probe (A10).
- [ ] L10 · Core-loop browser proof on staging then production, EN + AR (A11).
- [ ] L11 · Cutover verification report (A13) → owner approval → promote to Pages production (A14),
       switch `APP_URL`, 48 h parallel run, retire Netlify.

## Waiting on the owner (do not build around these; remind once per report)

- old cloud data: copy or start
  fresh (Life OS D-20261113-34) · staging database project (A6) · Oracle bucket link (L8) ·
  lawyer review of privacy and terms (C6).
