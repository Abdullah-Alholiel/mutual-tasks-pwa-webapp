// ============================================================================
// useConnectionStatus - React Hook for Realtime Connection Status
// ============================================================================
// Exposes the RealtimeManager's connection status to React components.
// Useful for showing connection indicators in the UI.
// ============================================================================

import { useState, useEffect } from 'react';
import { getRealtimeManager, type ConnectionStatus } from './RealtimeManager';

/**
 * React hook to subscribe to realtime connection status changes.
 * Returns the current connection status.
 */
export const useConnectionStatus = (): ConnectionStatus => {
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');

    useEffect(() => {
        const manager = getRealtimeManager();
        const unsubscribe = manager.onConnectionChange(setStatus);
        return unsubscribe;
    }, []);

    return status;
};

export default useConnectionStatus;
