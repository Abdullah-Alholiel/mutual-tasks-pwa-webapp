// Cloudflare Pages Function: POST /api/ai-generated-description
// Wraps the Netlify handler module VERBATIM (single source of truth for both
// hosts). Pages serves /api/ai-generated-description; Netlify serves
// /.netlify/functions/ai-generated-description — same code, same bodies.
import { handler as netlifyHandler } from '../../netlify/functions/ai-generated-description';
import { runNetlifyHandler } from './_shared/adapter';

interface PagesContext {
    request: Request;
    env: Record<string, unknown>;
}

export const onRequest = (ctx: PagesContext): Promise<Response> =>
    runNetlifyHandler(netlifyHandler, ctx.request, ctx.env);
