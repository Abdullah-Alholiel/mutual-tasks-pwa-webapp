
import React from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { WifiOff, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';

export const SyncStatusIndicator: React.FC<{ className?: string }> = ({ className }) => {
    const { isOnline } = useNetworkStatus();
    const isFetching = useIsFetching();
    const isMutating = useIsMutating();
    const isSyncing = isFetching > 0 || isMutating > 0;

    if (isOnline && !isSyncing) return null;

    return (
        <div className={cn(
            "fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium shadow-sm transition-all duration-300",
            isOnline ? "bg-primary/90 text-primary-foreground" : "bg-destructive text-destructive-foreground",
            className
        )}>
            {isOnline ? (
                <>
                    <RefreshCcw className="h-3 w-3 animate-spin" />
                    <span>Syncing...</span>
                </>
            ) : (
                <>
                    <WifiOff className="h-3 w-3" />
                    <span>Offline</span>
                </>
            )}
        </div>
    );
};
