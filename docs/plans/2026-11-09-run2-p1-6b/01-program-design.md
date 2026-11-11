# Factory Run 2 — Gate 0 Retro + Program Design (P1-6b push-target authorization)

Cycle: 2026-11-09 · Branch: `lane/run2-p1-6b-push-target-auth` (from origin/staging fc0b4c1)

## Gate 0 — Retro / live-state audit

- Run 1 (2026-11-08) shipped PR #6 (fc0b4c1: F1 caller auth + /api route repair + F2 bundle
  gate + F19/F12 on the Netlify copy). CI green. But run 1 died before housekeeping: stale
  LOCK, no STATE.json/RUNS write, 3 board cards not created, old red PR #5 left open.
  This run: closed PR #5 as superseded (staging's pr-gate.yml is strictly newer/stricter —
  merging it would have regressed the gate), took over the dead lock after verifying the pid
  is gone.
- **Security finding (this cycle's target): notification-target spoofing (P1-6b).**
  `netlify/functions/send-push-notification.ts` + the Express copy `server/index.ts:366`:
  after F1 caller auth, `externalUserId`, `title`, `message` are all caller-controlled.
  Any authenticated user can push arbitrary text under the "Momentum" title to ANY user id —
  spoofing/abuse vector. F1 fixed *who calls*, not *which target*.
- Bonus finding: the Express copy still leaks upstream internals (`res.status(...).json({
  error: '...', details: result })` — F19 class fixed on the Netlify copy only) and its CORS
  defaults to `*` (`process.env.CORS_ORIGIN || '*'`). F12 class. Same-run fix, same slice.
- Chain audit (Gate 0 method): client callers all go through
  `notificationService.ts` → `pushNotificationApi.ts` → `/api/send-push-notification`
  (single caller path, already sends Bearer). Targets pushed to: co-participants of a shared
  project, friends (request/accepted), and self (overdue/streak reminders, project_joined).
- Constraints honored: naive "target must == caller" self-check verified to break
  cross-participant pushes (run 1 finding) — authorization must be relationship-based.
- Tech debt note (recorded, NOT built this run): `server/index.ts` duplicates
  `AI_USAGE_LIMITS`/`checkRateLimit`/`incrementUsage` without the premium bypass (F8 class)
  and lacks the premium `remaining === -1` convention — queued for a later hardening run.

## Gates 1–3 — Program design (compact, autonomous mode)

Problem (user story, P0-security): As a Momentum user, I must not be able to send push
notifications to users I have no relationship with, and I must never see attacker-chosen
notification text under the app's own title.

Scope IN: server-side target authorization on both push copies; client adds actor context;
tests; Gate-3 checklist. Scope OUT: prod DB migration (none needed — relationship check is
read-only over existing tables), rate limiting pushes (later hardening), email channel.

### Authorization contract

Caller (identified by session) may push to `externalUserId` only when:
1. `externalUserId == caller` (self: overdue/streak reminders, project_joined echo), OR
2. accepted friend link exists in either direction
   (`friends.status = 'accepted'` AND `(user_id=caller AND friend_id=target) OR (user_id=target AND friend_id=caller)`), OR
3. an ACTIVE shared project: caller and target both have `project_participants` rows with
   `removed_at IS NULL` on the same project.

Pending friend rows deliberately NOT accepted: anyone can create a `friend_request` toward
any user, so honoring pending rows would keep the hole open. Effect (accepted product
trade-off, recorded): `friend_request` pushes degrade to in-app-only — the receiver still
sees the request in-app; push arrives for `friend_accepted` (row becomes accepted by then).

### Exact JSON shapes (Gate 3)

Request (unchanged fields + new optional context):
```json
{ "externalUserId": 42, "title": "Momentum", "message": "…",
  "url": "/projects/7", "icon": "/icons/icon-192x192.png",
  "data": { "taskId": 3, "projectId": 7 }, "actorContext": { "projectId": 7 } }
```
Success: `{ "success": true, "id": "<onesignal-id>", "recipients": 1 }` (unchanged).
Not subscribed: `{ "success": false, "error": "No subscription found for user", "externalUserId": 42 }` (unchanged).
New error — unauthorized target: `403 { "error": "Not allowed to notify this user" }` (details stripped).
Missing fields: `400 { "error": "Missing required fields: externalUserId, title, message" }` (unchanged).

### TS signatures (server-side, shared logic copied per runtime copy)

```ts
// netlify/functions/shared/pushAuth.ts  (new module; imported by the Netlify copy)
export async function canNotifyTarget(
  supabase: SupabaseClient, callerId: number, targetId: number
): Promise<boolean>
// - self → true
// - friends accepted either-direction → true
// - shared project_participants row (both, removed_at is null) → true
// - any error → false (fail closed); logs server-side only
```
Express copy (`server/index.ts`) gets the same predicate inlined (it already keeps local
copies of utils; F8 single-module consolidation is queued separately — not this slice).

### Client contract

`notificationService.sendNotification()` passes `actorContext: projectId ? { projectId } : undefined`
 — purely additive; server uses it only as a hint, the authoritative check re-derives the
 relationship from the DB (never trusts caller-supplied context alone for authorization).

### Gate 3 checklist (explicit, per skill)

- [x] Write path states WHO can call it: session auth (F1, existing) + relationship check (new, this slice). RLS untouched (service-role server-side reads only).
- [x] Frontend types accept exact backend JSON: response shapes unchanged except the new 403 error path; `pushNotificationApi.sendPushNotification` already returns `false` on `!response.ok` — no client type change needed.
- [x] Adapters: no new API shape consumed by UI; adapter untouched.
- [x] Mutations re-render without refetch: N/A (fire-and-forget push, no UI state depends on it).
- [x] i18n keys: no user-facing string added (server error only, English generic per F19 convention).
- [x] AI-limit path: not touched by this slice.
- [x] Error paths strip internals: Netlify copy already strips; Express copy fixed this slice (details removed); no `*` CORS introduced; Express CORS `*` default fixed this slice (F12 class).
- No new user-facing UI → design-gate D1–D5 not triggered; UX states untouched.
- EN+AR: no strings added → no key drift possible.
