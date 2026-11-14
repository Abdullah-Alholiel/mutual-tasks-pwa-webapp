// ============================================================================
// Magic-link email delivery result mapping (shared with auth-magic-link)
// ============================================================================
// auth-magic-link invokes the send-email edge function with
// supabaseClient.functions.invoke(...). That call resolves { data, error }
// where `error` is a FunctionsHttpError (carrying the upstream response in
// .context) or a plain Error. This helper maps ANY outcome to the exact JSON
// the request-login / request-signup handlers must return, so a broken email
// send can never silently answer `success: true` again (run 7, lane L1).
//
// Deno-free and import-free on purpose: vitest executes this file directly
// under Node (jsdom-free), and auth-magic-link imports it via a relative path
// on the edge runtime. The `declare` lines keep Deno's TS language server
// quiet without referencing Deno types at runtime.
// ============================================================================

/** The email could not be handed to the mail provider (or the function died). */
export const EMAIL_DELIVERY_FAILED = 'Email delivery failed. The link was not sent. Please try again.';

/** The email function is missing its MailJet keys. */
export const EMAIL_NOT_CONFIGURED = 'Email service is temporarily unavailable. Please try again later.';

/** The mail provider accepted the message. */
export const EMAIL_SENT = 'Email sent successfully.';

export interface EmailDeliveryResult {
  ok: boolean;
  /** User-facing, action-first message (EN); the auth screen shows it verbatim. */
  userMessage: string;
  /** Server-side log line; never returned to the client. */
  logMessage: string;
}

/**
 * True when the upstream send-email response reports a configuration problem
 * (empty MailJet keys) rather than a transient delivery failure.
 */
export function isEmailNotConfigured(bodyEmail: string | undefined | null): boolean {
  return typeof bodyEmail === 'string' && bodyEmail.includes('not configured');
}

function readContextStatus(error: unknown): number | undefined {
  const ctx = error && typeof error === 'object'
    ? (error as { context?: { response?: { status?: number } } }).context
    : undefined;
  return ctx?.response?.status;
}

function readContextBody(error: unknown): string | undefined {
  const ctx = error && typeof error === 'object'
    ? (error as { context?: { responseBody?: unknown; body?: unknown } }).context
    : undefined;
  const raw = ctx?.responseBody ?? ctx?.body;
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as { error?: unknown };
      return typeof parsed.error === 'string' ? parsed.error : raw;
    } catch {
      return raw;
    }
  }
  if (typeof raw === 'object' && 'error' in (raw as Record<string, unknown>)) {
    const e = (raw as { error?: unknown }).error;
    return typeof e === 'string' ? e : JSON.stringify(e);
  }
  return undefined;
}

/**
 * Map the outcome of `supabaseClient.functions.invoke('send-email', ...)`
 * to a EmailDeliveryResult. Usage in auth-magic-link:
 *
 *   const { data: emailData, error: emailError } = await supabaseClient
 *     .functions.invoke('send-email', { body: {...} });
 *   const delivery = mapEmailDelivery(emailData, emailError);
 *   console.log(delivery.logMessage);
 *   if (!delivery.ok) {
 *     return new Response(JSON.stringify({ success: false, error: delivery.userMessage }), { status: 502, ... });
 *   }
 */
export function mapEmailDelivery(
  data: unknown,
  error: unknown
): EmailDeliveryResult {
  // Case 1: invoke itself threw (network down, function missing, non-JSON 5xx).
  if (error) {
    const status = readContextStatus(error);
    const bodyEmail = readContextBody(error);
    console.error(
      'send-email failed:',
      error instanceof Error ? error.message : String(error),
      'upstream status:', status ?? 'unknown'
    );
    if (isEmailNotConfigured(bodyEmail)) {
      return {
        ok: false,
        userMessage: EMAIL_NOT_CONFIGURED,
        logMessage: `send-email not configured (status ${status ?? 'unknown'})`,
      };
    }
    return {
      ok: false,
      userMessage: EMAIL_DELIVERY_FAILED,
      logMessage: `send-email failed (status ${status ?? 'unknown'})`,
    };
  }

  // Case 2: invoke resolved; send-email answered JSON { success: boolean, error?: string }.
  const body = (data ?? {}) as { success?: boolean; error?: string };
  if (body.success === false) {
    if (isEmailNotConfigured(body.error)) {
      return {
        ok: false,
        userMessage: EMAIL_NOT_CONFIGURED,
        logMessage: `send-email not configured: ${body.error ?? ''}`,
      };
    }
    return {
      ok: false,
      userMessage: EMAIL_DELIVERY_FAILED,
      logMessage: `send-email reported failure: ${body.error ?? 'unknown error'}`,
    };
  }

  return {
    ok: true,
    userMessage: EMAIL_SENT,
    logMessage: 'send-email accepted the message',
  };
}
