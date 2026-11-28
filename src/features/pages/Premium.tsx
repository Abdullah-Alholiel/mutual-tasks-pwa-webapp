import { useEffect, useState } from 'react';
import { Sparkles, Check, Mail, Loader2 } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';
import { getSharedSupabaseClient } from '@/lib/supabaseClient';
import { getSessionToken } from '@/lib/auth/sessionStorage';
import { PLAN_LIMITS } from '@/lib/planLimits';

/**
 * Premium upgrade screen (G3, D-081).
 *
 * Beta-era premium is activated MANUALLY by the founders: the user presses
 * "Get Premium" (records interest in the premium_interest table via
 * /api/premium-interest — session-authed, no payment code), the founders
 * arrange payment personally, then flip `users.is_premium` in the DB
 * (database/vps-migration/002_premium.sql). The mailto fallback stays as a
 * quiet secondary path (D-056: never overclaim — the button confirms only
 * that the interest was recorded).
 *
 * Numbers come from ONE module (src/lib/planLimits.ts — the same constants
 * the server enforces). Never hardcode them here.
 *
 * UX states: loading (checking status) / premium (already active) /
 * form (ready) / sending / sent (interest recorded) / error (what happened +
 * why + what to do next, with the email fallback). EN + AR via browser
 * language, dir=rtl respected while mounted (same pattern as LegalPage).
 */

const PREMIUM_EMAIL = 'momentum.pwa@gmail.com';

type PremiumState =
  | { s: 'loading' }
  | { s: 'premium' }
  | { s: 'form' }
  | { s: 'sending' }
  | { s: 'sent' }
  | { s: 'error'; retryable: boolean };

const STR = {
  en: {
    title: 'Momentum Premium',
    subtitle: 'More AI every month.',
    perks: (f: typeof PLAN_LIMITS.free, p: typeof PLAN_LIMITS.premium) => [
      `${p.project_generation} AI project generations per month (free: ${f.project_generation})`,
      `${p.description_generation.toLocaleString('en-US')} AI task descriptions per month (free: ${f.description_generation})`,
      'Priority support from the founders',
    ],
    cta: 'Get Premium',
    sending: 'Recording…',
    sentTitle: 'Interest recorded',
    sentBody: `We'll reach out to arrange payment — beta era, no card needed yet. You can also email us any time at`,
    sentAgain: 'Record another request',
    errTitle: 'Could not record your interest',
    errRetryable: 'That looks like a temporary problem on our side. Please try again in a minute — or email us directly at',
    errNotRetryable: 'Your session may have expired. Sign in again and try — or email us directly at',
    retry: 'Try again',
    betaNote: 'Beta era: payments are arranged personally with the founders, then your account is flipped to Premium.',
    premiumTitle: 'Premium active',
    premiumBody: (p: typeof PLAN_LIMITS.premium) =>
      `${p.project_generation} AI project generations and ${p.description_generation.toLocaleString('en-US')} AI descriptions every month. Thanks for supporting Momentum!`,
    mailtoSubject: 'Momentum Premium request',
  },
  ar: {
    title: 'مومنتم بريميوم',
    subtitle: 'ذكاء اصطناعي أكثر كل شهر.',
    perks: (f: typeof PLAN_LIMITS.free, p: typeof PLAN_LIMITS.premium) => [
      `${p.project_generation} توليدات مشاريع بالذكاء الاصطناعي شهريًا (المجاني: ${f.project_generation})`,
      `${p.description_generation.toLocaleString('en-US')} وصفًا للمهام بالذكاء الاصطناعي شهريًا (المجاني: ${f.description_generation})`,
      'دعم ذو أولوية من المؤسسين',
    ],
    cta: 'اشترك في بريميوم',
    sending: 'جارٍ التسجيل…',
    sentTitle: 'تم تسجيل اهتمامك',
    sentBody: `سنتواصل معك لترتيب الدفع — في الفترة التجريبية لا حاجة لبطاقة بعد. يمكنك أيضًا مراسلتنا في أي وقت على`,
    sentAgain: 'تسجيل طلب آخر',
    errTitle: 'لم نتمكن من تسجيل اهتمامك',
    errRetryable: 'يبدو أن هذه مشكلة مؤقتة لدينا. حاول مرة أخرى بعد دقيقة — أو راسلنا مباشرة على',
    errNotRetryable: 'قد تكون جلستك منتهية. سجّل الدخول من جديد وحاول — أو راسلنا مباشرة على',
    retry: 'حاول مجددًا',
    betaNote: 'الفترة التجريبية: يُرتَّب الدفع شخصيًا مع المؤسسين، ثم يُفعَّل حسابك بريميوم.',
    premiumTitle: 'بريميوم مُفعَّل',
    premiumBody: (p: typeof PLAN_LIMITS.premium) =>
      `${p.project_generation} توليدات مشاريع و${p.description_generation.toLocaleString('en-US')} وصفًا بالذكاء الاصطناعي كل شهر. شكرًا لدعمك مومنتم!`,
    mailtoSubject: 'طلب اشتراك مومنتم بريميوم',
  },
};

export default function Premium() {
  const { user } = useAuth();
  const [state, setState] = useState<PremiumState>({ s: 'loading' });
  const [isAr, setIsAr] = useState(false);

  useEffect(() => {
    setIsAr((navigator.language || '').toLowerCase().startsWith('ar'));
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    return () => {
      document.documentElement.dir = 'ltr';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAr]);

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

  const recordInterest = async () => {
    setState({ s: 'sending' });
    const token = getSessionToken();
    if (!token) {
      setState({ s: 'error', retryable: false });
      return;
    }
    try {
      const res = await fetch('/api/premium-interest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: `handle: ${user?.handle ?? 'unknown'}`,
        }),
      });
      if (res.ok) {
        setState({ s: 'sent' });
      } else {
        // 401 → session problem (sign in again); 429/5xx → temporary.
        setState({ s: 'error', retryable: res.status !== 401 });
      }
    } catch {
      setState({ s: 'error', retryable: true });
    }
  };

  const t = isAr ? STR.ar : STR.en;
  const requestMailto = () => {
    const subject = encodeURIComponent(t.mailtoSubject);
    const body = encodeURIComponent(
      `Hi Momentum team,\n\nI'd like to activate Premium.\n\nMy handle: ${user?.handle ?? 'unknown'}\nMy email: ${user?.email ?? 'unknown'}\n\nThanks!`
    );
    window.location.href = `mailto:${PREMIUM_EMAIL}?subject=${subject}&body=${body}`;
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
        <h1 className="text-2xl font-bold">{t.premiumTitle}</h1>
        <p className="text-muted-foreground max-w-sm">{t.premiumBody(PLAN_LIMITS.premium)}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-[50vh] px-6 py-10 gap-6 max-w-md mx-auto">
      <div className="w-14 h-14 rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 flex items-center justify-center">
        <Sparkles className="w-7 h-7 text-[#8B5CF6]" />
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="text-muted-foreground">{t.subtitle}</p>
      </div>

      <ul className="w-full space-y-3">
        {t.perks(PLAN_LIMITS.free, PLAN_LIMITS.premium).map((perk) => (
          <li key={perk} className="flex items-start gap-3">
            <Check className="w-4 h-4 mt-0.5 text-[#8B5CF6] shrink-0" />
            <span className="text-sm">{perk}</span>
          </li>
        ))}
      </ul>

      {state.s === 'sent' ? (
        <div
          className="w-full rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-center text-sm space-y-3"
          role="status"
        >
          <p className="font-medium">{t.sentTitle}</p>
          <p className="text-muted-foreground">
            {t.sentBody}{' '}
            <a href={`mailto:${PREMIUM_EMAIL}`} className="underline font-medium">
              {PREMIUM_EMAIL}
            </a>.
          </p>
          <button
            onClick={() => setState({ s: 'form' })}
            className="text-xs underline text-muted-foreground"
          >
            {t.sentAgain}
          </button>
        </div>
      ) : state.s === 'error' ? (
        <div
          className="w-full rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-center text-sm space-y-3"
          role="status"
        >
          <p className="font-medium">{t.errTitle}</p>
          <p className="text-muted-foreground">
            {state.retryable ? t.errRetryable : t.errNotRetryable}{' '}
            <a href={`mailto:${PREMIUM_EMAIL}`} className="underline font-medium">
              {PREMIUM_EMAIL}
            </a>.
          </p>
          <button
            onClick={() => setState({ s: 'form' })}
            className="text-xs underline text-muted-foreground"
          >
            {t.retry}
          </button>
        </div>
      ) : (
        <div className="w-full space-y-4">
          <button
            onClick={recordInterest}
            disabled={state.s === 'sending'}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 min-h-[44px]"
          >
            {state.s === 'sending' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {state.s === 'sending' ? t.sending : t.cta}
          </button>
          <button
            onClick={requestMailto}
            className="w-full flex items-center justify-center gap-2 text-xs underline text-muted-foreground"
          >
            <Mail className="w-3.5 h-3.5" />
            {PREMIUM_EMAIL}
          </button>
          <p className="text-center text-xs text-muted-foreground">{t.betaNote}</p>
        </div>
      )}
    </div>
  );
}
