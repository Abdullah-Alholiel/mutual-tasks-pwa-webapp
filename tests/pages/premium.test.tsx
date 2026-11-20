import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import Premium from '@/features/pages/Premium';

// D-056: the mailto handoff opens the user's mail app — the app can never know
// whether a request was actually sent. The 'sent' confirmation must therefore
// not claim delivery; it must only describe what the user can verify (the mail
// app opened / can be reopened) and give the fallback address. Regression lock
// for the removed "We'll activate Premium…" delivery promise.

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u-1', handle: 'tester', email: 'tester@example.com' } }),
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

describe('Premium request flow (D-056 honesty fix)', () => {
  beforeEach(() => {
    supabaseFromMock.mockClear();
  });
  afterEach(() => cleanup());

  it('does NOT show delivery-promise copy after the mailto opens', async () => {
    render(<Premium />);
    const button = await screen.findByRole('button', { name: /activate premium/i });
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    const text = screen.getByRole('status').textContent ?? '';
    expect(text).not.toMatch(/we'?ll activate premium/i);
    expect(text).not.toMatch(/as soon as we confirm payment/i);
    expect(text).not.toMatch(/within a day/i);
  });

  it('describes what the user can verify and gives the fallback address', async () => {
    render(<Premium />);
    const button = await screen.findByRole('button', { name: /activate premium/i });
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    const text = screen.getByRole('status').textContent ?? '';
    expect(text).toMatch(/email app|mail app/i);
    expect(text).toMatch(/momentum\.pwa@gmail\.com/);
  });

  it('still offers a way back (button re-appears) from the confirmation state', async () => {
    render(<Premium />);
    const button = await screen.findByRole('button', { name: /activate premium/i });
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    const again = screen.getByRole('button', { name: /open your email app again/i });
    expect(again).toBeTruthy();
  });
});
