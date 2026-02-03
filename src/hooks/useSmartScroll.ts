
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
    const hasScrollableContent = useRef(true);
    const primaryScrollContainer = useRef<HTMLElement | null>(null);

    // Smart scroll state
    const lastScrollY = useRef(0);
    const pivotY = useRef(0);
    const scrollDirection = useRef<'up' | 'down'>('down');

    useEffect(() => {
        if (!enabled) return;
        if (typeof window === 'undefined' || typeof document === 'undefined') return;

        const resolvePrimaryScrollContainer = () => {
            const current = primaryScrollContainer.current;
            if (current && document.body.contains(current)) {
                return current;
            }
            const found = document.querySelector('[data-scroll-container="main"]') as HTMLElement | null;
            primaryScrollContainer.current = found;
            return found;
        };

        const updateScrollableState = (target?: EventTarget | null) => {
            const isWindowTarget = target === document || target === window || !target;
            if (isWindowTarget) {
                const container = resolvePrimaryScrollContainer();
                if (container?.scrollHeight != null && container?.clientHeight != null) {
                    hasScrollableContent.current = container.scrollHeight > container.clientHeight;
                } else {
                    hasScrollableContent.current = document.documentElement.scrollHeight > window.innerHeight;
                }
            } else {
                const element = target as HTMLElement;
                if (element?.scrollHeight != null && element?.clientHeight != null) {
                    hasScrollableContent.current = element.scrollHeight > element.clientHeight;
                }
            }

            if (!hasScrollableContent.current) {
                setIsVisible(true);
            }
        };

        // Initial check for window scrollability
        updateScrollableState(document);

        const handleScroll = (e: Event) => {
            const target = e.target;
            const isWindow = target === document || target === window;
            const elementTarget = target as HTMLElement;

            // If it's an element, we verify it's a "main" scroll container to avoid 
            // responding to small dropdowns or textareas.
            // Heuristic: container should be at least 50% of viewport height.
            // Note: we check !isWindow first because clientHeight doesn't exist on Document
            if (!isWindow && elementTarget?.clientHeight && elementTarget.clientHeight < window.innerHeight * 0.5) {
                return;
            }

            // If no scroll is possible, keep nav visible
            updateScrollableState(target);
            if (!hasScrollableContent.current) {
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

        // Re-check scrollable state on resize
        const handleResize = () => updateScrollableState(document);
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('scroll', throttledHandleScroll, { capture: true } as any);
            window.removeEventListener('resize', handleResize);
        };
    }, [safeZone, scrollUpThreshold, enabled]);

    return isVisible;
};
