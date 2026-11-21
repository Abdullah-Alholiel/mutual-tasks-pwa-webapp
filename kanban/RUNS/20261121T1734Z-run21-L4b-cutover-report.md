# L4b Cutover Report — Netlify → Cloudflare Pages (D-057, run 21, 2026-11-21)

Status: **REPORT ONLY — no deploy to main.** Production is still Netlify
(social-momentum.netlify.app, serving `main` @ 04222f7, 2026-11-11). The Cloudflare Pages
production project exists (social-momentum, social-momentum-8zq.pages.dev) with env vars,
secrets and the `AI` binding set by the owner, but nothing is deployed to its production
branch yet. This report is step (1) of LAUNCH-LANE L4b; the Life OS card "Promote Momentum to
Cloudflare production?" can now be raised from it (step 2, Claude/owner portal).

## What runs where today

- **Netlify production** (main): the app users see. 51+ commits behind staging. Functions:
  legacy n8n AI path (still the only AI path there — L4c's Workers AI/OpenRouter chain is
  staging-only until this cutover). CSP: netlify.toml variant.
- **Cloudflare Pages staging preview** (staging branch, pinned-env deploy #2, run 20 build
  83338bf): https://staging.social-momentum-8zq.pages.dev — full app + 4 Pages Functions
  (`functions/api/*`, Request bridge over the same handler modules, parity structural),
  hardened `public/_headers` (deploy-invariant since PR #27), `_routes.json` generated
  post-build, Workers AI binding primary + OpenRouter fallback (PR #28), sourcemaps off.

## What differs Netlify → Pages (operator view)

1. **Deploy:** Netlify = git push; Pages = `scripts/deploy-pages-preview.sh` (pinned-env:
   url/key/OneSignal id read from the LIVE deployed bundle, never repo .env — the repo .env
   poisons builds; strict bundle gate + secret sweep before wrangler). Prod deploy is the same
   script path with `--branch main`, only after the owner's go.
2. **Control files:** `_headers` ships in the repo and vite copies it into every build (run 18
   fixed the preview serving NO security headers); `_routes.json` is generated into dist/
   post-build (`['/api/*']` only — overlapping splats are rejected by Pages). No `_redirects`,
   no `wrangler.toml` (both refused, guard-tested, PR #27: toml precedence would shadow the 4
   /api rules on Netlify; a wrangler.toml would make CF config source-of-truth and drop the
   owner-set env vars + AI binding on next deploy).
3. **Functions:** same handler modules, bridged; workerd quirks handled (204/304 must be
   bodyless Responses). AI no longer depends on n8n on Pages (the lost n8n secret is moot for
   the cutover; n8n stays byte-for-byte only for Netlify prod).
4. **Env/secrets:** owner-set on Pages (9 per environment via set-pages-secrets.sh; never read
   or printed). Gateway CORS + APP_ORIGIN_ALLOWLIST already allow both pages.dev origins
   (smoke CORS leg passes live on the preview).
5. **Functions APP_URL:** currently the Cloudflare staging address (owner go 2026-11-13). At
   cutover step (4) Claude switches it to the production address so magic links point at the
   new host.

## Verification on the staging preview (fresh, this run)

Full smoke, 2026-11-21 17:37 UTC — **12/12 PASS**:

```
PASS  page answers 200
PASS  bundle has one database address and one public key
PASS  public key belongs to the same database as the address
PASS  database accepts the app's own key (data call)
PASS  database gateway allows this site's origin (CORS)
PASS  sign-in function reachable
PASS  email function reachable
PASS  app is visibly painted in a phone-sized browser
PASS  no page crash
PASS  signed-out visitor downloads no user data
PASS  no rejected database calls in the browser
PASS  vps: mail keys set on the VPS (sign-in emails can be sent)
```

Function probes (run 20, still the deployed build): unauthenticated `/api/ai-generated-description`
answers the handler's own 401 JSON; `env.AI` + `openrouter.ai` present in the served function
bundle.

**Known gap (honest):** a real signed-in description generation with measured neurons, and a
forced-Workers-AI-failure → OpenRouter-fallback drill, are NOT yet proven on the preview — both
need a signed-in test account. That account is L4d's qa-bot (D-058: built right after this
report), or an owner-session sign-in. Unauthenticated coverage + wiring probes are complete;
sign-in itself is proven live on this exact preview from 2026-11-13 (full sign-in, dashboard
renders) and via the smoke's function legs today.

## Rollback (pre-authorised, deploy-level only)

1. Pages serves deployments atomically: `npx wrangler@4 pages deployment list
   --project-name social-momentum` → identify the previous good deployment → redeploy that
   build (`wrangler pages deployment rollback <id>` or re-run the pinned-env script from the
   previous good commit). Never delete deployments.
2. Netlify stays untouched as the fallback for 48 h after cutover (retiring it is a separate
   owner yes). If Pages breaks before APP_URL moves, users are still on Netlify and nothing
   else changes.
3. DB is untouched by hosting rollback (self-hosted VPS Supabase; single database for both
   hosts).

## Cutover sequence from here (L4b steps 2–5)

1. (step 2) Claude raises the promote card from this report; the owner checks staging on the
   phone and answers in the portal.
2. (step 3, owner yes required, DECISIONS.md row first) PR staging → main, merge, prod-config
   build, `wrangler pages deploy dist --project-name social-momentum --branch main`, full smoke
   on https://social-momentum-8zq.pages.dev, report.
3. (step 4) Claude switches functions APP_URL to the production address (VPS change).
4. (step 5) Netlify stays untouched 48 h; retirement is a separate owner yes.

**Order warning (D-057 part 2, now written into OWNER-QUEUE/LAUNCH-LANE/STATE):** the 004
scoped-RLS apply on prod must come AFTER this promote (the new client sends `x-momentum-session`
on every request, src/lib/supabaseFetch.ts) — applying 004 against today's prod client would
lock out every current user.
