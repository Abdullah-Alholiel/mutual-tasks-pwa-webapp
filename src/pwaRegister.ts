/**
 * Post-first-paint service-worker registration (launch lane L0).
 *
 * Root cause (2026-11-13, owner iPhone iOS 26.6 Safari): the autoUpdate inline
 * `registerSW()` injected by vite-plugin-pwa runs during bundle parse — BEFORE
 * React's first paint. On WebKit the SW install + precache (36 files, ~2.3 MB)
 * competes with render, leaving framer-motion wrappers parked at opacity 0
 * ("plain dark blue, nothing loads") for seconds on slower phones.
 *
 * Fix: register the worker only after the window `load` event (first paint +
 * initial render are done) with a hard timeout so a hanging /sw.js can never
 * block interaction. Update checks every 5 min / on focus stay in usePWAUpdate.
 */
import { registerSW } from 'virtual:pwa-register';

const REGISTER_TIMEOUT_MS = 8000;

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const start = () => {
    // A frozen registerSW promise must not matter anymore by this point.
    const timeout = new Promise<void>((resolve) =>
      setTimeout(resolve, REGISTER_TIMEOUT_MS),
    );
    Promise.race([registerSW({ immediate: false }), timeout]).catch(() => {
      /* registration retry happens on the next update check */
    });
  };

  if (document.readyState === 'complete') {
    start();
  } else {
    window.addEventListener('load', start, { once: true });
  }
}
