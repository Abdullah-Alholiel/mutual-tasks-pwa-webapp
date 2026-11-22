// Cloudflare Pages Function: POST /api/send-push-notification
// Wraps the Netlify handler module VERBATIM (single source of truth for both
// hosts). Pages serves /api/send-push-notification; Netlify serves
// /.netlify/functions/send-push-notification — same code, same bodies.
import { handler as netlifyHandler } from '../../netlify/functions/send-push-notification';
import { runNetlifyHandler } from './_shared/adapter';

interface PagesContext {
    request: Request;
    env: Record<string, unknown>;
}

export const onRequest = (ctx: PagesContext): Promise<Response> =>
    runNetlifyHandler(netlifyHandler, ctx.request, ctx.env);
