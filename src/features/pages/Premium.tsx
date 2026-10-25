import { useEffect, useState } from 'react';
import { Sparkles, Check, Mail, Loader2 } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';
import { getSharedSupabaseClient } from '@/lib/supabaseClient';

/**
 * Premium upgrade screen.
 *
 * Beta-era premium is activated MANUALLY by the founders: the user emails us,
 * we arrange payment personally, then flip `users.is_premium` in the DB
 * (see database/vps-migration/002_premium.sql). No payment processor yet
 * by design.
 *
 * UX states: loading (checking status) / premium (already active) /
 * form (request ready to send) / sending / sent (confirmation).
 */

const PREMIUM_EMAIL = 'momentum.pwa@gmail.com';

type PremiumState =
  | { s: 'loading' }
  | { s: 'premium' }
  | { s: 'form' }
  | { s: 'sending' }
  | { s: 'sent' };

export default function Premium() {
  const { user } = useAuth();
  const [state, setState] = useState<PremiumState>({ s: 'loading' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    const check = async () => {
      if (!user?.id) {
        setState({ s: 'form' });
        return;
      }
      const client = getSharedSupabaseClient();
      const { data } = await client
        .from('users')
        .select('is_premium')
        .eq('id', user.id)
        .maybeSingle();
      setState({ s: data?.is_premium ? 'premium' : 'form' });
    };
    check();
  }, [user?.id]);

  const requestPremium = () => {
    setState({ s: 'sending' });
    const subject = encodeURIComponent('Momentum Premium request');
    const body = encodeURIComponent(
      `Hi Momentum team,\n\nI'd like to activate Premium.\n\nMy handle: ${user?.handle ?? 'unknown'}\nMy email: ${user?.email ?? 'unknown'}\n\n${message ? `Message:\n${message}\n\n` : ''}Thanks!`
    );
    window.location.href = `mailto:${PREMIUM_EMAIL}?subject=${subject}&body=${body}`;
    setState({ s: 'sent' });
  };

  if (state.s === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state.s === 'premium') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center gap-4">
        <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Sparkles className="w-7 h-7 text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold">You're Premium</h1>
        <p className="text-muted-foreground max-w-sm">
          Unlimited AI project generations and AI descriptions. Thanks for
          supporting Momentum!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-[50vh] px-6 py-10 gap-6 max-w-md mx-auto">
      <div className="w-14 h-14 rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 flex items-center justify-center">
        <Sparkles className="w-7 h-7 text-[#8B5CF6]" />
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Momentum Premium</h1>
        <p className="text-muted-foreground">
          Unlimited AI, every day.
        </p>
      </div>

      <ul className="w-full space-y-3">
        {[
          'Unlimited AI project generations (free: 3/day)',
          'Unlimited AI task descriptions (free: 10/day)',
          'Priority support from the founders',
        ].map((perk) => (
          <li key={perk} className="flex items-start gap-3">
            <Check className="w-4 h-4 mt-0.5 text-[#8B5CF6] shrink-0" />
            <span className="text-sm">{perk}</span>
          </li>
        ))}
      </ul>

      {state.s === 'sent' ? (
        <div className="w-full rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-center text-sm">
          Your email app should be open with a pre-filled request. We'll
          activate Premium as soon as we confirm your payment — usually within
          a day.
        </div>
      ) : (
        <div className="w-full space-y-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Anything we should know? (optional)"
            rows={3}
            className="w-full rounded-lg border border-border bg-background p-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40"
          />
          <button
            onClick={requestPremium}
            disabled={state.s === 'sending'}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {state.s === 'sending' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            Email us to activate Premium
          </button>
          <p className="text-center text-xs text-muted-foreground">
            Beta era: payments are arranged personally with the founders.
            We'll flip your account to Premium right after.
          </p>
        </div>
      )}
    </div>
  );
}
