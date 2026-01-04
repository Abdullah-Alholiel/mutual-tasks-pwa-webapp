import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const STORAGE_KEY = 'projects-active-tab';
type ProjectsTab = 'my-projects' | 'public';

/**
 * Hook to persist and restore the active tab state on the Projects page.
 * Uses sessionStorage to remember the tab across navigation.
 */
export const useProjectsTabState = () => {
    const location = useLocation();

    // Check if we have a fromTab in navigation state (from project detail)
    const fromTabState = (location.state as { fromTab?: ProjectsTab } | null)?.fromTab;

    // Initialize from state, sessionStorage, or default
    const getInitialTab = (): ProjectsTab => {
        if (fromTabState) return fromTabState;

        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored === 'my-projects' || stored === 'public') {
            return stored;
        }
        return 'my-projects';
    };

    const [activeTab, setActiveTab] = useState<ProjectsTab>(getInitialTab);

    // Persist to sessionStorage whenever tab changes
    useEffect(() => {
        sessionStorage.setItem(STORAGE_KEY, activeTab);
    }, [activeTab]);

    // Update from navigation state if it changes
    useEffect(() => {
        if (fromTabState) {
            setActiveTab(fromTabState);
        }
    }, [fromTabState]);

    return { activeTab, setActiveTab };
};
