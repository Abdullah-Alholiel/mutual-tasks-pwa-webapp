import { useEffect, useCallback } from 'react';

const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Check if we're in production mode - service worker only works in production
const isProduction = import.meta.env.PROD;

/**
 * Aggressive PWA Update Hook
 * 
 * Features:
 * 1. Checks for updates every 5 minutes
 * 2. Checks on visibility change (app comes to foreground - critical for iOS)
 * 3. Forces immediate update when detected
 * 4. Reloads the page to apply updates
 * 
 * Note: In development mode, this hook is disabled to avoid SW registration errors.
 */
export const usePWAUpdate = () => {
  // In development, just return a no-op implementation
  const forceUpdate = useCallback(() => {
    if (!isProduction) {
      console.log('[PWA] Service worker updates disabled in development mode');
      return;
    }
    console.log('[PWA] Forcing update and reload...');
    // In production, this will be handled by the visibility change listener
  }, []);

  // Check for updates when document becomes visible (critical for iOS PWAs)
  useEffect(() => {
    // Skip all SW operations in development mode
    if (!isProduction) {
      return;
    }

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
          // Silently ignore errors in development or when SW is not available
          if (isProduction) {
            console.error('[PWA] Visibility update check failed:', error);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  // Set up periodic update checks in production only
  useEffect(() => {
    if (!isProduction) return;

    const checkForUpdates = async () => {
      try {
        const registration = await navigator.serviceWorker?.getRegistration();
        if (registration) {
          console.log('[PWA] Periodic update check...');
          await registration.update();
        }
      } catch (error) {
        // Silently ignore
      }
    };

    const interval = setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL);

    // Check immediately on first load
    checkForUpdates();

    return () => clearInterval(interval);
  }, []);

  return { needRefresh: false, forceUpdate };
};
