// Cloudflare Pages Function: POST /api/ai-confirm-usage
// Wraps the Netlify handler module VERBATIM (single source of truth for both
// hosts — Netlify serves /.netlify/functions/ai-confirm-usage, Pages serves
// /api/ai-confirm-usage; same code, same bodies, same errors).
import { handler as netlifyHandler } from '../../netlify/functions/ai-confirm-usage';
import { runNetlifyHandler } from './_shared/adapter';

interface PagesContext {
    request: Request;
    env: Record<string, unknown>;
}

export const onRequest = (ctx: PagesContext): Promise<Response> =>
    runNetlifyHandler(netlifyHandler, ctx.request, ctx.env);
