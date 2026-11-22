// Cloudflare Pages Functions run on workerd: there is no `process` global —
// environment values arrive as bindings on `context.env`. The Netlify handler
// modules (netlify/functions/shared/utils.ts) read everything from process.env,
// so the Pages adapters install each binding into process.env before invoking
// them, on EVERY request.
//
// Bindings are per-deployment constants (the value cannot change while a given
// deploy serves traffic), so last-write-wins is correct: each request re-stamps
// the current deploy's binding values, which keeps rotations effective on warm
// isolates and prevents a locally-exported stale key (wrangler pages dev)
// from shadowing the binding.
//
// Service-role keys arrive ONLY via bindings (env.*), never VITE_-prefixed (F2).
// OBJECT bindings pass through too (run 19): the Workers AI binding (`env.AI`, an
// object with .run()) must reach the handlers — installEnv previously copied strings
// only, which would silently downgrade every AI call to the legacy n8n path.
type RecordUnknown = Record<string, unknown>;

export function installEnv(env: unknown): void {
    const g = globalThis as { process?: { env: RecordUnknown } };
    if (!g.process || !g.process.env) {
        // First call on a cold isolate: create the shim the handlers expect.
        (g as RecordUnknown).process = { env: {} as RecordUnknown };
    }
    if (!env || typeof env !== 'object') return;
    for (const [k, v] of Object.entries(env as RecordUnknown)) {
        if (typeof v === 'string' || typeof v === 'object') {
            g.process!.env[k] = v as never;
        }
    }
}

export function getEnv(name: string): string | undefined {
    const g = globalThis as { process?: { env: RecordUnknown } };
    const v = g.process?.env?.[name];
    return typeof v === 'string' ? v : undefined;
}
