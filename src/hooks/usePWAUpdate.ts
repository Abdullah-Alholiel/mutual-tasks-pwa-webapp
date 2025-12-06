import { useEffect, useState } from 'react';

interface PWAUpdateState {
  isUpdateAvailable: boolean;
  isUpdating: boolean;
  updateError: Error | null;
}

/**
 * Hook to monitor PWA service worker updates
 * 
 * With registerType: 'autoUpdate', vite-plugin-pwa automatically handles
 * service worker registration and updates. Updates are installed in the
 * background and activated on the next page load.
 * 
 * This hook monitors the existing service worker registration (created by
 * vite-plugin-pwa) to provide visibility into the update process.
 * 
 * @returns Update state and methods
 */
export function usePWAUpdate() {
  const [state, setState] = useState<PWAUpdateState>({
    isUpdateAvailable: false,
    isUpdating: false,
    updateError: null,
  });

  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let registration: ServiceWorkerRegistration | null = null;
    let updateInterval: NodeJS.Timeout | null = null;

    const checkForUpdates = async () => {
      try {
        registration = await navigator.serviceWorker.getRegistration();
        
        if (!registration) {
          return;
        }

        // Check if there's a waiting service worker (update available)
        if (registration.waiting) {
          setState(prev => ({
            ...prev,
            isUpdateAvailable: true,
          }));
        }

        // Listen for when a new service worker is installed
        registration.addEventListener('updatefound', () => {
          const newWorker = registration?.installing;
          
          if (!newWorker) {
            return;
          }

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              // New service worker installed
              if (navigator.serviceWorker.controller) {
                // There's a controller, so this is an update
                setState(prev => ({
                  ...prev,
                  isUpdateAvailable: true,
                }));
              }
            }
          });
        });

        // Listen for when the service worker takes control (update activated)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          setState(prev => ({
            ...prev,
            isUpdateAvailable: false,
            isUpdating: false,
          }));
        });

        // Check for updates periodically (every 5 minutes)
        updateInterval = setInterval(() => {
          if (registration) {
            registration.update().catch((error) => {
              setState(prev => ({
                ...prev,
                updateError: error instanceof Error ? error : new Error('Update check failed'),
              }));
            });
          }
        }, 5 * 60 * 1000);

        // Initial update check
        await registration.update();
      } catch (error) {
        setState(prev => ({
          ...prev,
          updateError: error instanceof Error ? error : new Error('Unknown error'),
        }));
      }
    };

    // Wait for service worker to be ready, then check for updates
    navigator.serviceWorker.ready.then(() => {
      checkForUpdates();
    });

    // Cleanup function
    return () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
      registration = null;
    };
  }, []);

  /**
   * Manually check for updates
   */
  const checkForUpdate = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        updateError: error instanceof Error ? error : new Error('Unknown error'),
      }));
    }
  };

  /**
   * Skip waiting and activate the new service worker immediately
   * Note: With autoUpdate, updates activate automatically on next page load.
   * This method can be used to force immediate activation if needed.
   */
  const skipWaiting = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    try {
      setState(prev => ({ ...prev, isUpdating: true }));
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration?.waiting) {
        // Send skip waiting message to the waiting service worker
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        // Reload the page to activate the new service worker
        window.location.reload();
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        updateError: error instanceof Error ? error : new Error('Unknown error'),
        isUpdating: false,
      }));
    }
  };

  return {
    ...state,
    checkForUpdate,
    skipWaiting,
  };
}

