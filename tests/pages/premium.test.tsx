import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import Premium from '@/features/pages/Premium';

// G3 (D-081): "Get Premium" records interest via POST /api/premium-interest
// (session-authed; no payment code). The D-056 honesty rule still locks the
// copy: the confirmation claims ONLY that interest was recorded — never that
// Premium was activated or payment confirmed — and always gives the fallback
// address plus a way back.

const pushState = { s: 'ok' };

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u-1', handle: 'tester', email: 'tester@example.com' } }),
}));

vi.mock('@/lib/auth/sessionStorage', () => ({
  getSessionToken: () => 'tok-test',
}));

const supabaseFromMock = vi.fn(() => ({
  select: () => ({
    eq: () => ({
      maybeSingle: () => Promise.resolve({ data: { is_premium: false }, error: null }),
    }),
  }),
}));

vi.mock('@/lib/supabaseClient', () => ({
  getSharedSupabaseClient: () => ({ from: supabaseFromMock }),
}));

const fetchMock = vi.fn();

describe('Premium upgrade flow (G3 interest recording, D-056 honesty kept)', () => {
  beforeEach(() => {
    supabaseFromMock.mockClear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    void pushState;
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the owner numbers (3 free / 100 premium projects per month)', async () => {
    render(<Premium />);
    await screen.findByRole('button', { name: /get premium/i });
    const text = document.body.textContent ?? '';
    expect(text).toContain('100 AI project generations per month (free: 3)');
    expect(text).toContain('1,000 AI task descriptions per month (free: 20)');
    expect(text).not.toMatch(/per day/i);
    expect(text).not.toMatch(/unlimited/i);
  });

  it('records interest on click and confirms only what the user can verify', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<Premium />);
    const button = await screen.findByRole('button', { name: /get premium/i });
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    const text = screen.getByRole('status').textContent ?? '';
    // D-056 regression: no delivery/activation promises.
    expect(text).not.toMatch(/we'?ll activate premium/i);
    expect(text).not.toMatch(/premium (is now )?active/i);
    expect(text).toMatch(/interest recorded/i);
    expect(text).toMatch(/momentum\.pwa@gmail\.com/);
    // The request went to the interest endpoint with the session token.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('/api/premium-interest');
    expect((init as RequestInit).method).toBe('POST');
    expect(((init as RequestInit).headers as Record<string, string>).authorization).toBe('Bearer tok-test');
  });

  it('offers a way back (record another request) from the confirmation state', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<Premium />);
    const button = await screen.findByRole('button', { name: /get premium/i });
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(screen.getByRole('button', { name: /record another request/i })).toBeTruthy();
  });

  it('server failure: honest error state with retry + email fallback, no internals leaked', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Could not record your interest right now. Please try again later.' }), { status: 500 })
    );
    render(<Premium />);
    const button = await screen.findByRole('button', { name: /get premium/i });
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    const text = screen.getByRole('status').textContent ?? '';
    expect(text).toMatch(/could not record your interest/i);
    expect(text).toMatch(/momentum\.pwa@gmail\.com/);
    expect(text).not.toMatch(/42P01|relation|supabase|postgres/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('401 failure points at the expired session', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }));
    render(<Premium />);
    const button = await screen.findByRole('button', { name: /get premium/i });
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    const text = screen.getByRole('status').textContent ?? '';
    expect(text).toMatch(/session may have expired/i);
  });

  it('already-premium user sees the premium state with the real monthly numbers', async () => {
    supabaseFromMock.mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { is_premium: true }, error: null }),
        }),
      }),
    }));
    render(<Premium />);
    const heading = await screen.findByText(/premium active/i);
    expect(heading).toBeTruthy();
    const text = document.body.textContent ?? '';
    expect(text).toContain('100 AI project generations');
    expect(text).not.toMatch(/unlimited/i);
  });
});
