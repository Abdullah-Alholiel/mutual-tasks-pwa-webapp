import { ReactNode, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MobileNav } from './MobileNav';
import { DesktopNav } from './DesktopNav';
import { SwipeableContainer } from './SwipeableContainer';

interface AppLayoutProps {
  children: ReactNode;
}

// Main navigation routes that should have page transitions
const MAIN_ROUTES = ['/', '/projects', '/profile'];

export const AppLayout = ({ children }: AppLayoutProps) => {
  const location = useLocation();
  
  // Only animate page transitions on main routes
  const shouldAnimate = useMemo(() => 
    MAIN_ROUTES.includes(location.pathname),
    [location.pathname]
  );

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <DesktopNav />
      <SwipeableContainer>
        <main className="pt-4 md:pt-28 pb-20 md:pb-8 px-4 md:px-6 max-w-7xl mx-auto overflow-x-hidden">
          {shouldAnimate ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{
                  type: 'tween',
                  ease: 'easeInOut',
                  duration: 0.25
                }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          ) : (
            <div key={location.pathname}>
              {children}
            </div>
          )}
        </main>
      </SwipeableContainer>
      <MobileNav />
    </div>
  );
};
