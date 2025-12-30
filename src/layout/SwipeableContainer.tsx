import { ReactNode, useRef, useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { motion, useMotionValue, useSpring, animate } from 'framer-motion';

interface SwipeableContainerProps {
  children: ReactNode;
}

// Navigation order for swipe gestures
const NAV_ORDER = ['/', '/projects', '/profile'];

const SWIPE_THRESHOLD = 80; // Minimum horizontal movement in pixels
const VELOCITY_THRESHOLD = 0.5; // Minimum velocity in px/ms
const MAX_VERTICAL_ALLOWED = 40; // Maximum vertical movement before cancelling swipe

export const SwipeableContainer = ({ children }: SwipeableContainerProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);

  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number } | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);

  const x = useMotionValue(0);

  // Get current route index
  const getCurrentRouteIndex = useCallback(() => {
    const currentPath = location.pathname;
    if (currentPath === '/') return 0;
    if (currentPath.startsWith('/projects/') && currentPath !== '/projects') return -1;
    return NAV_ORDER.indexOf(currentPath);
  }, [location.pathname]);

  const currentIndex = getCurrentRouteIndex();
  const canSwipePrev = currentIndex > 0;
  const canSwipeNext = currentIndex !== -1 && currentIndex < NAV_ORDER.length - 1;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isMobile) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Don't start swipe if we're in a project detail or something similar
      if (getCurrentRouteIndex() === -1) return;

      const touch = e.touches[0];
      setTouchStart({
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      });
      setIsSwiping(false);
      // No need to reset x here, we do it in touchend/navigation
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStart) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStart.x;
      const deltaY = touch.clientY - touchStart.y;

      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // Lock into horizontal swiping if horizontal movement is dominant
      if (!isSwiping && absDeltaX > 10 && absDeltaX > absDeltaY) {
        setIsSwiping(true);
      }

      if (isSwiping) {
        // Prevent default browser behavior (scrolling) when horizontal swiping
        // This is where the "passive: false" is critical
        if (e.cancelable) e.preventDefault();

        // Calculate resistance if swiping past limits
        let moveX = deltaX;
        if ((deltaX > 0 && !canSwipePrev) || (deltaX < 0 && !canSwipeNext)) {
          moveX = deltaX * 0.35; // Rubber-banding
        }

        x.set(moveX);
      } else if (absDeltaY > MAX_VERTICAL_ALLOWED) {
        // Cancel if vertical scroll is clearly intended
        setTouchStart(null);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStart.x;
      const deltaTime = Date.now() - touchStart.time;
      const velocity = Math.abs(deltaX) / (deltaTime || 1);

      const absDeltaX = Math.abs(deltaX);
      const currentIndex = getCurrentRouteIndex();

      // Reset swipe state
      setTouchStart(null);
      setIsSwiping(false);

      // Decision logic for navigation
      const meetsThreshold = absDeltaX >= SWIPE_THRESHOLD || velocity >= VELOCITY_THRESHOLD;

      if (meetsThreshold && currentIndex !== -1) {
        if (deltaX > 0 && canSwipePrev) {
          // Swipe right -> Previous tab
          animate(x, window.innerWidth, { type: 'spring', stiffness: 300, damping: 35 })
            .then(() => {
              navigate(NAV_ORDER[currentIndex - 1]);
              x.set(0);
            });
          return;
        } else if (deltaX < 0 && canSwipeNext) {
          // Swipe left -> Next tab
          animate(x, -window.innerWidth, { type: 'spring', stiffness: 300, damping: 35 })
            .then(() => {
              navigate(NAV_ORDER[currentIndex + 1]);
              x.set(0);
            });
          return;
        }
      }

      // If no navigation, snap back to center
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 35 });
    };

    // Attach listeners with passive: false to allow e.preventDefault()
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile, touchStart, isSwiping, canSwipePrev, canSwipeNext, getCurrentRouteIndex, navigate, x]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden w-full min-h-screen"
      style={{ touchAction: 'pan-y' }}
    >
      <motion.div
        style={{ x }}
        className="w-full h-full"
      >
        {children}
      </motion.div>
    </div>
  );
};


