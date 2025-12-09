import { ReactNode, useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

interface SwipeableContainerProps {
  children: ReactNode;
}

// Navigation order for swipe gestures
const NAV_ORDER = ['/', '/projects', '/profile'];

const SWIPE_THRESHOLD = 50; // Minimum horizontal movement in pixels
const VELOCITY_THRESHOLD = 0.3; // Minimum velocity in px/ms
const MAX_VERTICAL_MOVEMENT = 30; // Maximum vertical movement to consider it a horizontal swipe

export const SwipeableContainer = ({ children }: SwipeableContainerProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number } | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);

  // Get current route index
  const getCurrentRouteIndex = () => {
    const currentPath = location.pathname;
    // Handle exact match for home route
    if (currentPath === '/') return 0;
    // Handle project detail routes - should not be swipeable
    if (currentPath.startsWith('/projects/') && currentPath !== '/projects') return -1;
    return NAV_ORDER.indexOf(currentPath);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    
    const touch = e.touches[0];
    setTouchStart({
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    });
    setIsSwiping(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile || !touchStart) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Only consider it a swipe if horizontal movement is significantly greater than vertical
    // This prevents interference with vertical scrolling
    if (absDeltaX > absDeltaY * 1.5 && absDeltaX > 15) {
      setIsSwiping(true);
      // Prevent default scroll behavior during horizontal swipe
      if (absDeltaX > MAX_VERTICAL_MOVEMENT && absDeltaY < MAX_VERTICAL_MOVEMENT) {
        e.preventDefault();
      }
    } else if (absDeltaY > absDeltaX) {
      // User is scrolling vertically, cancel swipe
      setIsSwiping(false);
      setTouchStart(null);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile || !touchStart) {
      setTouchStart(null);
      setIsSwiping(false);
      return;
    }

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    const deltaTime = Date.now() - touchStart.time;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    const velocity = absDeltaX / deltaTime;

    // Reset touch state
    setTouchStart(null);
    setIsSwiping(false);

    // Check if this is a valid horizontal swipe
    if (absDeltaX <= absDeltaY || absDeltaY > MAX_VERTICAL_MOVEMENT) {
      return; // Not a horizontal swipe
    }

    // Check if swipe meets threshold (distance or velocity)
    const meetsThreshold = absDeltaX >= SWIPE_THRESHOLD || velocity >= VELOCITY_THRESHOLD;
    if (!meetsThreshold) {
      return;
    }

    // Get current route index
    const currentIndex = getCurrentRouteIndex();
    if (currentIndex === -1) {
      return; // Not a swipeable route (e.g., project detail page)
    }

    // Determine navigation direction
    if (deltaX > 0) {
      // Swipe right - go to previous tab
      if (currentIndex > 0) {
        navigate(NAV_ORDER[currentIndex - 1]);
      }
    } else {
      // Swipe left - go to next tab
      if (currentIndex < NAV_ORDER.length - 1) {
        navigate(NAV_ORDER[currentIndex + 1]);
      }
    }
  };

  // Disable swipe on scrollable elements
  useEffect(() => {
    if (!isMobile || !containerRef.current) return;

    const container = containerRef.current;
    
    // Prevent swipe when user is actively scrolling
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      setIsSwiping(false);
      setTouchStart(null);
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        // Re-enable after scroll stops
      }, 100);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [isMobile]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: isMobile ? 'pan-y pinch-zoom' : 'auto' }}
      className={isSwiping ? 'select-none' : ''}
    >
      {children}
    </div>
  );
};

