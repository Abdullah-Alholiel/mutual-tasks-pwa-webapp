// ============================================================================
// useConnectionStatus - React Hook for Realtime Connection Status
// ============================================================================
// Exposes connection status from useUnifiedRealtime to React components.
// Useful for showing connection indicators in UI.
//
// Replaces old RealtimeManager-based connection status hook.
// ============================================================================

import { useState, useEffect } from 'react';
import React from 'react';
import { logger } from '@/lib/monitoring/logger';

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

interface ConnectionStatusContextValue {
    status: ConnectionStatus;
    setStatus: (status: ConnectionStatus) => void;
}

const ConnectionStatusContext = React.createContext<ConnectionStatusContextValue | null>(null);

// Module-level flag to only warn once about missing provider
let hasWarnedAboutMissingProvider = false;

interface ConnectionStatusProviderProps {
    children: React.ReactNode;
}

export function ConnectionStatusProvider({ children }: ConnectionStatusProviderProps) {
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');

    const value = { status, setStatus };

    return React.createElement(ConnectionStatusContext.Provider, { value }, children);
}

export function useConnectionStatus(): ConnectionStatus {
    const context = React.useContext(ConnectionStatusContext);
    if (!context) {
        if (!hasWarnedAboutMissingProvider) {
            logger.warn('[useConnectionStatus] Not inside ConnectionStatusProvider');
            hasWarnedAboutMissingProvider = true;
        }
        return 'connected';
    }
    return context.status;
}

export default useConnectionStatus;

