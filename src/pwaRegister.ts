/**
 * Post-idle service-worker registration (launch lane L0).
 *
 * Root cause (2026-11-13, owner iPhone iOS 26.6 Safari): the autoUpdate inline
 * `registerSW()` injected by vite-plugin-pwa ran during bundle parse — BEFORE
 * React's first paint. On WebKit the SW install + precache (36 files, ~2.3 MB)
 * competes with render, leaving framer-motion wrappers parked at opacity 0
 * ("plain dark blue, nothing loads") for seconds on slower phones.
 *
 * Run 24 residual: even registering at `load` (PR #13) left the install starting
 * at ~0.3 s — inside the entrance-animation window. WebKit harness: content in
 * the DOM at 0.93 s but visible only at 7.83 s (rAF frozen by install work);
 * SW-controlled repeat visit 1.92 s — barely under the 2 s lane bar.
 *
 * Fix (this change): register only after the page goes IDLE — after first
 * paint, entrance animation and initial data have settled. Order of triggers:
 *   1. `requestIdleCallback` with a hard 2.5 s cap (runs even if never idle),
 *   2. first user interaction (a user who starts using the app must not wait),
 *   3. plain 2.5 s timeout where requestIdleCallback is unavailable.
 * A hanging /sw.js still can never block interaction (8 s register race kept).
 * Update checks every 5 min / on focus stay in usePWAUpdate (getRegistration —
 * no dependency on this module's timing).
 */
import { registerSW } from 'virtual:pwa-register';

const REGISTER_TIMEOUT_MS = 8000;
const IDLE_CAP_MS = 2500;

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  let started = false;
  const cancelIdle: Array<() => void> = [];

  const start = () => {
    if (started) return;
    started = true;
    cancelIdle.forEach((fn) => fn());

    // A frozen registerSW promise must not matter anymore by this point.
    const timeout = new Promise<void>((resolve) =>
      setTimeout(resolve, REGISTER_TIMEOUT_MS),
    );
    Promise.race([registerSW({ immediate: false }), timeout]).catch(() => {
      /* registration retry happens on the next update check */
    });
  };

  const arm = () => {
    // 1. Idle (capped): the main thread has drained render + entrance animation.
    const ric = (
      window as Window &
        typeof globalThis & {
          requestIdleCallback?: (
            cb: () => void,
            opts?: { timeout?: number },
          ) => number;
          cancelIdleCallback?: (id: number) => void;
        }
    ).requestIdleCallback;

    if (typeof ric === 'function') {
      const id = ric(start, { timeout: IDLE_CAP_MS });
      cancelIdle.push(() => {
        try {
          (
            window as Window &
              typeof globalThis & { cancelIdleCallback?: (id: number) => void }
          ).cancelIdleCallback?.(id);
        } catch {
          /* window torn down */
        }
      });
    } else {
      // 3. No requestIdleCallback (older WebKit): plain timeout.
      const t = setTimeout(start, IDLE_CAP_MS);
      cancelIdle.push(() => clearTimeout(t));
    }

    // 2. First interaction wins over any pending idle wait.
    const opts: AddEventListenerOptions = { once: true, passive: true };
    window.addEventListener('pointerdown', start, opts);
    window.addEventListener('touchstart', start, opts);
    window.addEventListener('keydown', start, opts);
    cancelIdle.push(() => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('touchstart', start);
      window.removeEventListener('keydown', start);
    });
  };

  if (document.readyState === 'complete') {
    arm();
  } else {
    window.addEventListener('load', arm, { once: true });
  }
}
