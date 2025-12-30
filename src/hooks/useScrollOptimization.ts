import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for optimizing scroll performance on mobile.
 * 
 * This hook:
 * 1. Adds a 'scrolling' class during scroll to disable heavy CSS effects
 * 2. Uses a debounce/throttle mechanism to efficiently detect scroll state
 * 3. Removes the class after scrolling stops
 * 
 * @param ref - RefObject to the scrollable container
 * @param debounceMs - How long after scrolling stops to remove the 'scrolling' class
 */
export function useScrollOptimization(
    ref: React.RefObject<HTMLElement | null>,
    debounceMs: number = 150
) {
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isScrollingRef = useRef(false);
    const rafRef = useRef<number | null>(null);

    const handleScrollStart = useCallback(() => {
        if (!isScrollingRef.current) {
            isScrollingRef.current = true;
            ref.current?.classList.add('scrolling');
        }

        // Clear any existing timeout
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }

        // Set timeout to detect when scrolling stops
        scrollTimeoutRef.current = setTimeout(() => {
            isScrollingRef.current = false;
            ref.current?.classList.remove('scrolling');
        }, debounceMs);
    }, [ref, debounceMs]);

    // Throttled scroll handler using requestAnimationFrame
    const handleScroll = useCallback(() => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
        }

        rafRef.current = requestAnimationFrame(() => {
            handleScrollStart();
        });
    }, [handleScrollStart]);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        // Use passive listener for better scroll performance
        element.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            element.removeEventListener('scroll', handleScroll);

            // Cleanup any pending timeouts/rafs
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, [ref, handleScroll]);
}

/**
 * Hook to apply hardware acceleration to a container.
 * Forces GPU rendering for smoother animations and scrolling.
 */
export function useHardwareAcceleration(ref: React.RefObject<HTMLElement | null>) {
    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        // Apply GPU acceleration styles
        element.style.transform = 'translateZ(0)';
        element.style.backfaceVisibility = 'hidden';

        return () => {
            // Cleanup (restore original values if needed)
            element.style.transform = '';
            element.style.backfaceVisibility = '';
        };
    }, [ref]);
}

/**
 * Combined hook that applies all scroll optimizations.
 * Use this for scrollable containers with many items.
 */
export function useOptimizedScroll(
    ref: React.RefObject<HTMLElement | null>,
    options: { debounceMs?: number } = {}
) {
    const { debounceMs = 150 } = options;

    useScrollOptimization(ref, debounceMs);
    useHardwareAcceleration(ref);
}
