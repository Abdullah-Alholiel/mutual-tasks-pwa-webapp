
import { useState, useEffect, useRef } from 'react';

interface SmartScrollOptions {
    safeZone?: number; // Distance from top where nav is always visible
    scrollUpThreshold?: number; // Distance to scroll up before showing nav
    enabled?: boolean; // Whether logic is active
}

export const useSmartScroll = ({
    safeZone = 100,
    scrollUpThreshold = 150,
    enabled = true
}: SmartScrollOptions = {}) => {
    const [isVisible, setIsVisible] = useState(true);

    // Smart scroll state
    const lastScrollY = useRef(0);
    const pivotY = useRef(0);
    const scrollDirection = useRef<'up' | 'down'>('down');

    useEffect(() => {
        if (!enabled) return;

        const handleScroll = (e: Event) => {
            const target = e.target;
            const isWindow = target === document;
            const elementTarget = target as HTMLElement;

            // If it's an element, we verify it's a "main" scroll container to avoid 
            // responding to small dropdowns or textareas.
            // Heuristic: container should be at least 50% of viewport height.
            // Note: we check !isWindow first because clientHeight doesn't exist on Document
            if (!isWindow && elementTarget?.clientHeight && elementTarget.clientHeight < window.innerHeight * 0.5) {
                return;
            }

            const currentScrollY = isWindow ? window.scrollY : (elementTarget?.scrollTop || 0);
            const prevScrollY = lastScrollY.current;
            const currentDirection = currentScrollY > prevScrollY ? 'down' : 'up';

            // Update persistent refs
            lastScrollY.current = currentScrollY;

            // 1. Safety Zone Check (Always visible at very top)
            if (currentScrollY < safeZone) {
                setIsVisible(true);
                pivotY.current = currentScrollY; // Reset pivot when at top
                return;
            }

            // 2. Direction Change Logic
            if (currentDirection !== scrollDirection.current) {
                scrollDirection.current = currentDirection;
                pivotY.current = currentScrollY; // Reset pivot point on direction change
            }

            // 3. Hiding Logic (Scrolling Down)
            if (currentDirection === 'down') {
                // Hide immediately when scrolling down past safe zone
                setIsVisible(false);
            }

            // 4. Showing Logic (Scrolling Up)
            else if (currentDirection === 'up') {
                const distanceFromPivot = Math.abs(currentScrollY - pivotY.current);

                // Only show if we've scrolled up enough from the turning point
                if (distanceFromPivot > scrollUpThreshold) {
                    setIsVisible(true);
                }
            }
        };

        // Throttle scroll events
        let ticking = false;
        const throttledHandleScroll = (e: Event) => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    handleScroll(e);
                    ticking = false;
                });
                ticking = true;
            }
        };

        // Use capture: true to catch scroll events from internal scrolling containers (divs)
        window.addEventListener('scroll', throttledHandleScroll, { capture: true, passive: true });

        return () => {
            window.removeEventListener('scroll', throttledHandleScroll, { capture: true } as any);
        };
    }, [safeZone, scrollUpThreshold, enabled]);

    return isVisible;
};
