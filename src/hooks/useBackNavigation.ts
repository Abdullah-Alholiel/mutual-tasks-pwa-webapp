import { useNavigate, useLocation } from 'react-router-dom';

interface UseBackNavigationOptions {
  fallbackPath: string;
}

/**
 * Custom hook for back navigation that goes to previous page if available,
 * otherwise falls back to a specified path.
 * 
 * @param options - Configuration options for back navigation
 * @param options.fallbackPath - The path to navigate to if there's no history
 * @returns A function that navigates back when called
 */
export const useBackNavigation = ({ fallbackPath }: UseBackNavigationOptions) => {
  const navigate = useNavigate();
  const location = useLocation();

  const goBack = () => {
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate(fallbackPath);
    }
  };

  return goBack;
};
