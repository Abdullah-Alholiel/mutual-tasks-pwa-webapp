// Lane L1 / D-023: a failed magic-link email send must NEVER surface to the
// user as `success: true` — and the user-facing message must stay generic
// (no MailJet/upstream internals, F19 doctrine). These tests cover the
// mapping helper auth-magic-link uses for the send-email invoke result.
//
// The helper is Deno-free by design so it runs directly under vitest.

import { describe, it, expect } from 'vitest';
import {
  mapEmailDelivery,
  EMAIL_DELIVERY_FAILED,
  EMAIL_NOT_CONFIGURED,
} from '../../supabase/functions/_shared/email-delivery';

// Shape of the error supabase-js raises for a non-2xx function response
// (FunctionsHttpError): the upstream Response travels in .context.response.
const httpError = (status: number, responseBody?: unknown) => {
  const err = new Error(`Function returned an invalid response body status: ${status}`);
  (err as unknown as Record<string, unknown>).context = {
    response: { status, statusText: 'Internal Server Error' },
    ...(responseBody !== undefined ? { responseBody } : {}),
  };
  return err;
};

describe('L1: email delivery mapping never fakes success', () => {
  it('accepts a successful send-email result', () => {
    const r = mapEmailDelivery({ success: true }, undefined);
    expect(r.ok).toBe(true);
  });

  it('fails when send-email resolves with success:false (MailJet API error)', () => {
    const r = mapEmailDelivery(
      { success: false, error: 'MailJet API error', details: { Messages: [] } },
      undefined
    );
    expect(r.ok).toBe(false);
    expect(r.userMessage).toBe(EMAIL_DELIVERY_FAILED);
  });

  it('distinguishes the not-configured case (empty MailJet keys)', () => {
    const r = mapEmailDelivery(
      { success: false, error: 'Email service not configured.' },
      undefined
    );
    expect(r.ok).toBe(false);
    expect(r.userMessage).toBe(EMAIL_NOT_CONFIGURED);
  });

  it('fails when invoke throws a FunctionsHttpError without a readable body', () => {
    const r = mapEmailDelivery(undefined, httpError(500));
    expect(r.ok).toBe(false);
    expect(r.userMessage).toBe(EMAIL_DELIVERY_FAILED);
  });

  it('detects not-configured through the FunctionsHttpError response body', () => {
    const r = mapEmailDelivery(
      undefined,
      httpError(500, JSON.stringify({ success: false, error: 'Email service not configured.' }))
    );
    expect(r.ok).toBe(false);
    expect(r.userMessage).toBe(EMAIL_NOT_CONFIGURED);
  });

  it('fails (not fakes success) when invoke throws a network error', () => {
    const r = mapEmailDelivery(undefined, new TypeError('Failed to fetch'));
    expect(r.ok).toBe(false);
    expect(r.userMessage).toBe(EMAIL_DELIVERY_FAILED);
  });

  it('keeps upstream internals out of the user-facing message (F19)', () => {
    const leaky = mapEmailDelivery(
      { success: false, error: 'MailJet API error', details: { StatusCode: 401, key: 'sk-live-x' } },
      undefined
    );
    const thrown = mapEmailDelivery(
      undefined,
      httpError(500, JSON.stringify({ error: 'MailJet API error', details: { StatusCode: 401 } }))
    );
    for (const r of [leaky, thrown]) {
      expect(r.userMessage).toBe(EMAIL_DELIVERY_FAILED);
      expect(r.userMessage).not.toContain('MailJet');
      expect(r.userMessage).not.toContain('401');
      expect(r.userMessage).not.toContain('sk-live-x');
    }
  });
});
