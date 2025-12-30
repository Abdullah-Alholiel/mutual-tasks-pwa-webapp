import { useRef, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Hook to save and restore scroll position for a specific container
 * @param key Unique key to identify the scroll position in sessionStorage
 * @returns Ref object to attach to the scrollable container
 */
export const useScrollRestoration = (key: string) => {
    const ref = useRef<HTMLDivElement>(null);
    const location = useLocation();

    // Restore scroll position
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;

        // Use a slight timeout to allow for content layout/rendering
        // especially with dynamic content like react-query
        const restoreScroll = () => {
            const savedPosition = sessionStorage.getItem(key);
            if (savedPosition) {
                element.scrollTop = parseInt(savedPosition, 10);
            }
        };

        // Try immediate restore
        restoreScroll();

        // And also try after a short delay for dynamic content
        const timeoutId = setTimeout(restoreScroll, 0); // Next tick
        const timeoutId2 = setTimeout(restoreScroll, 100); // slightly later for heavier renders

        return () => {
            clearTimeout(timeoutId);
            clearTimeout(timeoutId2);
        };
    }, [key, location.pathname]); // Re-run when key or path changes

    // Save scroll position
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;

        const handleScroll = () => {
            // Debouncing could be added here if performance is an issue,
            // but sessionStorage.setItem is generally fast enough for passive listeners
            if (element.scrollTop > 0) {
                sessionStorage.setItem(key, element.scrollTop.toString());
            } else if (element.scrollTop === 0) {
                // Also save 0 to properly "reset" if user scrolled to top
                sessionStorage.setItem(key, '0');
            }
        };

        element.addEventListener('scroll', handleScroll, { passive: true });

        // Also save on unmount to capture the final state
        return () => {
            element.removeEventListener('scroll', handleScroll);
            sessionStorage.setItem(key, element.scrollTop.toString());
        };
    }, [key]);

    return ref;
};
