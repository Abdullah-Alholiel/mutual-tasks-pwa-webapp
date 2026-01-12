import { useRef, useEffect, useState, useCallback, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useEmblaCarousel from 'embla-carousel-react';
import { useIsMobile } from '@/hooks/use-mobile';
import Index from '../features/pages/Index';
import Projects from '../features/projects/Projects';
import FriendsPage from '../features/friends/pages/FriendsPage';
import Profile from '../features/profile/Profile';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { MobileHeader } from '@/components/layout/MobileHeader';

const NAV_ORDER = ['/', '/projects', '/friends', '/profile'];

/**
 * Shared page wrapper for consistent padding and scroll behavior
 */
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { useOptimizedScroll } from '@/hooks/useScrollOptimization';

/**
 * Shared page wrapper for consistent padding, scroll behavior, and mobile scroll optimization
 */
const PageWrapper = ({ children, scrollKey }: { children: ReactNode; scrollKey: string }) => {
    const isMobile = useIsMobile();
    const scrollRef = useScrollRestoration(scrollKey);

    // Apply scroll optimizations for smoother mobile scrolling
    useOptimizedScroll(scrollRef);

    return (
        <div
            ref={scrollRef}
            className="h-full w-full overflow-y-auto custom-scrollbar touch-scroll"
            style={{
                // GPU acceleration for smooth scrolling
                transform: 'translateZ(0)',
                WebkitOverflowScrolling: 'touch',
            }}
        >
            <div
                className="px-4 md:px-6 max-w-7xl mx-auto w-full"
                style={{
                    paddingTop: isMobile
                        ? 'calc(1rem + env(safe-area-inset-top, 0px))'
                        : '7rem',
                    paddingBottom: isMobile ? 'calc(6rem + env(safe-area-inset-bottom, 0px))' : '2rem',
                    paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
                    paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))'
                }}
            >
                {/* Mobile header as first row - before any page content */}
                {isMobile && <MobileHeader />}
                {children}
            </div>
        </div>
    );
};

export const MainTabsShell = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Find initial index
    const getIndexFromPath = useCallback((path: string) => {
        const index = NAV_ORDER.indexOf(path);
        return index === -1 ? 0 : index;
    }, []);

    const [emblaRef, emblaApi] = useEmblaCarousel({
        startIndex: getIndexFromPath(location.pathname),
        skipSnaps: false,
        duration: 45, // Slightly slower for more fluid, premium feel
        dragFree: false,
        containScroll: 'trimSnaps',
    });

    const [activeIndex, setActiveIndex] = useState(getIndexFromPath(location.pathname));

    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        const index = emblaApi.selectedScrollSnap();
        setActiveIndex(index);

        const targetPath = NAV_ORDER[index];
        if (location.pathname !== targetPath) {
            navigate(targetPath, { replace: true });
        }
    }, [emblaApi, location.pathname, navigate]);

    useEffect(() => {
        if (!emblaApi) return;
        emblaApi.on('select', onSelect);
        return () => {
            emblaApi.off('select', onSelect);
        };
    }, [emblaApi, onSelect]);

    // Sync Carousel with URL changes
    useEffect(() => {
        if (!emblaApi) return;
        const targetIndex = getIndexFromPath(location.pathname);
        if (targetIndex !== emblaApi.selectedScrollSnap()) {
            // Use scrollTo with duration to ensure it follows the same smooth path
            // as the swipe gesture.
            emblaApi.scrollTo(targetIndex);
        }
    }, [location.pathname, emblaApi, getIndexFromPath]);

    return (
        <div className="main-tabs-shell h-full w-full overflow-hidden bg-background">
            <div className="embla h-full w-full" ref={emblaRef}>
                <div className="embla__container flex h-full w-full gpu-accelerated">
                    {/* Index Tab */}
                    <div className="embla__slide flex-[0_0_100%] min-w-0 h-full relative" style={{ backfaceVisibility: 'hidden' }}>
                        <PageWrapper scrollKey="scroll-index">
                            <Index isInternalSlide={true} isActive={activeIndex === 0} />
                        </PageWrapper>
                    </div>

                    {/* Projects Tab */}
                    <div className="embla__slide flex-[0_0_100%] min-w-0 h-full relative" style={{ backfaceVisibility: 'hidden' }}>
                        <PageWrapper scrollKey="scroll-projects">
                            <Projects isInternalSlide={true} isActive={activeIndex === 1} />
                        </PageWrapper>
                    </div>

                    {/* Friends Tab */}
                    <div className="embla__slide flex-[0_0_100%] min-w-0 h-full relative" style={{ backfaceVisibility: 'hidden' }}>
                        <PageWrapper scrollKey="scroll-friends">
                            <FriendsPage isInternalSlide={true} isActive={activeIndex === 2} />
                        </PageWrapper>
                    </div>

                    {/* Profile Tab */}
                    <div className="embla__slide flex-[0_0_100%] min-w-0 h-full relative" style={{ backfaceVisibility: 'hidden' }}>
                        <PageWrapper scrollKey="scroll-profile">
                            <Profile isInternalSlide={true} isActive={activeIndex === 3} />
                        </PageWrapper>
                    </div>
                </div>
            </div>
        </div>
    );
};
