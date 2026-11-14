// Cloudflare Pages Functions run on workerd: there is no `process` global —
// environment values arrive as bindings on `context.env`. The Netlify handler
// modules (netlify/functions/shared/utils.ts) read everything from process.env,
// so the Pages adapters install each binding into process.env before invoking
// them. Values are copied per-request and only ever ADDED — this module never
// overwrites an existing process.env entry (a local dev shell may already
// export one; the Pages binding wins only when the key is absent).
//
// Service-role keys arrive ONLY via bindings (env.*), never VITE_-prefixed (F2).
type RecordUnknown = Record<string, unknown>;

export function installEnv(env: unknown): void {
    const g = globalThis as { process?: { env: RecordUnknown } };
    if (!g.process || !g.process.env) {
        // First call on a cold isolate: create the shim the handlers expect.
        (g as RecordUnknown).process = { env: {} as RecordUnknown };
    }
    if (!env || typeof env !== 'object') return;
    for (const [k, v] of Object.entries(env as RecordUnknown)) {
        if (typeof v === 'string' && !(k in g.process!.env)) {
            g.process!.env[k] = v;
        }
    }
}

export function getEnv(name: string): string | undefined {
    const g = globalThis as { process?: { env: RecordUnknown } };
    const v = g.process?.env?.[name];
    return typeof v === 'string' ? v : undefined;
}
