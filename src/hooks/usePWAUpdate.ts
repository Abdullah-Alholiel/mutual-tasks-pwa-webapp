
import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Hook to handle PWA updates
 * 
 * This hook:
 * 1. Checks for service worker updates periodically
 * 2. Forces an update when one is found (because of autoUpdate behavior)
 * 3. Logs standardized messages for debugging
 */
export const usePWAUpdate = () => {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      console.log(`[PWA] Service Worker registered: ${swUrl}`);

      // Check for updates every hour
      if (r) {
        setInterval(() => {
          console.log('[PWA] Checking for updates...');
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('[PWA] Service Worker registration failed:', error);
    },
  });

  // Since we use 'autoUpdate' strategy in Vite config, 'needRefresh' 
  // theoretically shouldn't happen often as it auto-updates.
  // However, if it DOES happen (e.g. browser holds on to old SW),
  // we force the update immediately to ensure "instant" feel.
  useEffect(() => {
    if (needRefresh) {
      console.log('[PWA] New content available. Updating...');
      updateServiceWorker(true);
    }
  }, [needRefresh, updateServiceWorker]);

  return { needRefresh };
};
