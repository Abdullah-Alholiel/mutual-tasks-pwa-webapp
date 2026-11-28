// Cloudflare Pages Function: POST /api/premium-interest
// Wraps the Netlify handler module VERBATIM (single source of truth for both
// hosts) — same pattern as the other /api functions.
import { handler as netlifyHandler } from '../../netlify/functions/premium-interest';
import { runNetlifyHandler } from './_shared/adapter';

interface PagesContext {
    request: Request;
    env: Record<string, unknown>;
}

export const onRequest = (ctx: PagesContext): Promise<Response> =>
    runNetlifyHandler(netlifyHandler, ctx.request, ctx.env);
