// Request ⇄ Netlify-HandlerEvent bridge for Cloudflare Pages Functions.
//
// The 4 API handlers live in netlify/functions/ (single source of truth — both
// hosts run the SAME module, so parity is structural, not asserted by diffing).
// Those handlers only touch event.httpMethod / event.headers / event.body
// (verified run 8) and return { statusCode, headers, body }.
//
// workerd notes:
// - Headers are case-insensitive in both worlds; Netlify lowercases keys, so
//   the bridge does the same for exact-parity reads like headers['origin'].
// - handler signatures take (event, context); Pages callers pass a minimal
//   context stub — no handler touches it (verified run 8).
import type { Handler } from '@netlify/functions';
import { installEnv } from './env';

export interface NetlifyEvent {
    httpMethod: string;
    headers: Record<string, string>;
    body: string | null;
    isBase64Encoded: boolean;
    path: string;
    querystringParameters: Record<string, string>;
}

export interface NetlifyResult {
    statusCode: number;
    headers?: Record<string, string>;
    body?: string;
}

export function toNetlifyEvent(request: Request): NetlifyEvent {
    const url = new URL(request.url);
    const headers: Record<string, string> = {};
    request.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    const q: Record<string, string> = {};
    url.searchParams.forEach((v, k) => { q[k] = v; });
    return {
        httpMethod: request.method,
        headers,
        body: null, // the caller reads the body as text when present
        isBase64Encoded: false,
        path: url.pathname,
        querystringParameters: q,
    };
}

export async function runNetlifyHandler(
    handler: Handler,
    request: Request,
    env: unknown,
): Promise<Response> {
    installEnv(env);
    const event = toNetlifyEvent(request);
    if (request.body !== null) {
        event.body = await request.text();
    }
    const result = (await handler(
        event as unknown as Parameters<Handler>[0],
        {} as never,
    )) as NetlifyResult;
    // 204/304 forbid a response body: `new Response('', { status: 204 })`
    // THROWS on workerd (ai-generated-description legitimately answers 204).
    const nullBodyStatus = result.statusCode === 204 || result.statusCode === 304;
    const body = nullBodyStatus || result.body === undefined ? null : result.body;
    return new Response(body, {
        status: result.statusCode,
        headers: result.headers ?? {},
    });
}
