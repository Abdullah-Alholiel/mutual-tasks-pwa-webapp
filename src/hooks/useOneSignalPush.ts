// ============================================================================
// useOneSignalPush Hook
// ============================================================================
// React hook for managing OneSignal push notification state and permissions.
// Automatically syncs external user ID with authenticated user.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '@/features/auth/AuthContext';
import {
    initializeOneSignal,
    isOneSignalReady,
    isPushSupported,
    isSubscribed as checkIsSubscribed,
    requestPushPermission,
    unsubscribeFromPush,
    setExternalUserId,
    removeExternalUserId,
    onSubscriptionChange,
} from '@/lib/onesignal/oneSignalService';

interface UseOneSignalPushReturn {
    /** Whether push notifications are supported on this device */
    isSupported: boolean;
    /** Whether OneSignal has been initialized */
    isReady: boolean;
    /** Whether the user is currently subscribed to push */
    isSubscribed: boolean;
    /** Whether an operation is in progress */
    isPending: boolean;
    /** Request push notification permission and subscribe */
    requestPermission: () => Promise<boolean>;
    /** Unsubscribe from push notifications */
    unsubscribe: () => Promise<void>;
}

/**
 * Hook for managing OneSignal push notification subscription
 * Automatically handles initialization and user ID sync
 */
export function useOneSignalPush(): UseOneSignalPushReturn {
    const { user } = useAuthContext();
    const [isReady, setIsReady] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isPending, setIsPending] = useState(false);

    // Initialize OneSignal on mount
    useEffect(() => {
        let mounted = true;

        const init = async () => {
            try {
                await initializeOneSignal();
                if (mounted) {
                    setIsReady(isOneSignalReady());
                    const subscribed = await checkIsSubscribed();
                    setIsSubscribed(subscribed);
                }
            } catch (error) {
                console.error('[useOneSignalPush] Initialization error:', error);
            }
        };

        init();

        return () => {
            mounted = false;
        };
    }, []);

    // Sync external user ID with authenticated user
    useEffect(() => {
        if (!isReady) return;

        const syncUserId = async () => {
            if (user?.id) {
                await setExternalUserId(user.id);
            } else {
                await removeExternalUserId();
            }
        };

        syncUserId();
    }, [user?.id, isReady]);

    // Listen for subscription changes
    useEffect(() => {
        if (!isReady) return;

        const unsubscribe = onSubscriptionChange((subscribed) => {
            setIsSubscribed(subscribed);
        });

        return unsubscribe;
    }, [isReady]);

    // Request push permission
    const requestPermission = useCallback(async (): Promise<boolean> => {
        if (!isReady) {
            console.warn('[useOneSignalPush] OneSignal not ready');
            return false;
        }

        setIsPending(true);
        try {
            const result = await requestPushPermission();
            setIsSubscribed(result);
            return result;
        } finally {
            setIsPending(false);
        }
    }, [isReady]);

    // Unsubscribe from push
    const unsubscribe = useCallback(async (): Promise<void> => {
        if (!isReady) return;

        setIsPending(true);
        try {
            await unsubscribeFromPush();
            setIsSubscribed(false);
        } finally {
            setIsPending(false);
        }
    }, [isReady]);

    return {
        isSupported: isPushSupported(),
        isReady,
        isSubscribed,
        isPending,
        requestPermission,
        unsubscribe,
    };
}

export default useOneSignalPush;
