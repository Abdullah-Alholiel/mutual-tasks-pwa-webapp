import { useEffect, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Aggressive PWA Update Hook
 * 
 * Features:
 * 1. Checks for updates every 5 minutes
 * 2. Checks on visibility change (app comes to foreground - critical for iOS)
 * 3. Forces immediate update when detected
 * 4. Reloads the page to apply updates
 */
export const usePWAUpdate = () => {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      console.log(`[PWA] Service Worker registered: ${swUrl}`);

      if (registration) {
        // Check for updates every 5 minutes
        setInterval(() => {
          console.log('[PWA] Periodic update check...');
          registration.update();
        }, UPDATE_CHECK_INTERVAL);

        // Also check immediately on first load
        registration.update();
      }
    },
    onRegisterError(error) {
      console.error('[PWA] Service Worker registration failed:', error);
    },
  });

  // Force update and reload when new content is available
  const forceUpdate = useCallback(() => {
    console.log('[PWA] Forcing update and reload...');
    updateServiceWorker(true);
  }, [updateServiceWorker]);

  // Auto-update when needRefresh becomes true
  useEffect(() => {
    if (needRefresh) {
      console.log('[PWA] New content available. Auto-updating...');
      forceUpdate();
    }
  }, [needRefresh, forceUpdate]);

  // Check for updates when document becomes visible (critical for iOS PWAs)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[PWA] App became visible, checking for updates...');

        try {
          const registration = await navigator.serviceWorker?.getRegistration();
          if (registration) {
            await registration.update();

            // If there's a waiting worker, activate it immediately
            if (registration.waiting) {
              console.log('[PWA] Found waiting worker, activating...');
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
              window.location.reload();
            }
          }
        } catch (error) {
          console.error('[PWA] Visibility update check failed:', error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also check on page focus (backup for visibility)
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  return { needRefresh, forceUpdate };
};
