import { ReactNode } from 'react';
import { useLocation, Outlet, matchPath } from 'react-router-dom';
import { MobileNav } from './MobileNav';
import { DesktopNav } from './DesktopNav';
import { useIsMobile } from '@/hooks/use-mobile';
import { GlobalRealtimeSubscriptions } from '@/features/realtime/GlobalRealtimeSubscriptions';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';

interface AppLayoutProps {
  children?: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const isMobile = useIsMobile();
  const location = useLocation();

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      <GlobalRealtimeSubscriptions />
      <SyncStatusIndicator />
      {/* Hide DesktopNav on FriendProfile page as it has its own header */}
      {!matchPath('/friends/:id', location.pathname) && <DesktopNav />}

      {/* 
          The main area is now a rigid container. 
          Its children (like MainTabsShell or ProjectDetail) handle their own scrolling.
      */}
      <main className="flex-1 relative w-full overflow-hidden">
        {children || <Outlet />}
      </main>
      <MobileNav />
    </div>
  );
};
