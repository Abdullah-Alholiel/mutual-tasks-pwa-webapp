import { ReactNode } from 'react';
import { MobileNav } from './MobileNav';
import { DesktopNav } from './DesktopNav';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <DesktopNav />
      <main className="pt-4 md:pt-28 pb-20 md:pb-8 px-4 md:px-6 max-w-7xl mx-auto overflow-x-hidden">
        {children}
      </main>
      <MobileNav />
    </div>
  );
};
