import { useRef, useEffect, useState, useCallback, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useEmblaCarousel from 'embla-carousel-react';
import { useIsMobile } from '@/hooks/use-mobile';
import Index from '../features/pages/Index';
import Projects from '../features/projects/Projects';
import Profile from '../features/profile/Profile';

const NAV_ORDER = ['/', '/projects', '/profile'];

/**
 * Shared page wrapper for consistent padding and scroll behavior
 */
const PageWrapper = ({ children }: { children: ReactNode }) => {
    const isMobile = useIsMobile();
    return (
        <div className="h-full w-full overflow-y-auto custom-scrollbar">
            <div
                className="px-4 md:px-6 max-w-7xl mx-auto w-full"
                style={{
                    paddingTop: isMobile
                        ? 'calc(1.5rem + env(safe-area-inset-top, 0px))'
                        : '7rem',
                    paddingBottom: '2rem',
                    paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
                    paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))'
                }}
            >
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
        duration: 35, // Professional smooth snap
        dragFree: false,
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
            emblaApi.scrollTo(targetIndex);
        }
    }, [location.pathname, emblaApi, getIndexFromPath]);

    return (
        <div className="main-tabs-shell h-full w-full overflow-hidden">
            <div className="embla h-full w-full" ref={emblaRef}>
                <div className="embla__container flex h-full w-full">
                    {/* Index Tab */}
                    <div className="embla__slide flex-[0_0_100%] min-w-0 h-full">
                        <PageWrapper>
                            <Index isInternalSlide={true} isActive={activeIndex === 0} />
                        </PageWrapper>
                    </div>

                    {/* Projects Tab */}
                    <div className="embla__slide flex-[0_0_100%] min-w-0 h-full">
                        <PageWrapper>
                            <Projects isInternalSlide={true} isActive={activeIndex === 1} />
                        </PageWrapper>
                    </div>

                    {/* Profile Tab */}
                    <div className="embla__slide flex-[0_0_100%] min-w-0 h-full">
                        <PageWrapper>
                            <Profile isInternalSlide={true} isActive={activeIndex === 2} />
                        </PageWrapper>
                    </div>
                </div>
            </div>
        </div>
    );
};
