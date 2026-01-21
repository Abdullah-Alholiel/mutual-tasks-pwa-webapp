import { createRoot } from "react-dom/client";
import App from "./core/App.tsx";
import "./core/index.css";
import { GlobalErrorBoundary } from "./components/ui/GlobalErrorBoundary";

// Import diagnostic utility for browser console debugging
import './lib/dbDiagnostic';

// ============================================================================
// Dynamic Viewport Height Handler for Mobile PWA
// ============================================================================
// This handles the dynamic viewport height changes on mobile browsers
// where the address bar/navigation can appear/disappear, causing 100vh
// to be larger than the visible area.
// ============================================================================

const setViewportHeight = () => {
  // Calculate the actual viewport height in pixels
  const vh = window.innerHeight * 0.01;
  // Set the CSS custom property --vh which can be used as calc(var(--vh) * 100)
  document.documentElement.style.setProperty('--vh', `${vh}px`);
};

// Set initial viewport height
setViewportHeight();

// Store event listener references for potential cleanup
const handleResize = () => setViewportHeight();
const handleOrientationChange = () => {
  setTimeout(setViewportHeight, 100);
};

// Update on resize (including orientation changes and browser UI changes)
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleOrientationChange);

// Also update when visual viewport changes (for virtual keyboard on mobile)
let visualViewportListener: (() => void) | null = null;
if (window.visualViewport) {
  visualViewportListener = handleResize;
  window.visualViewport.addEventListener('resize', handleResize);
}

// Cleanup function for event listeners (useful for testing, hot reload, or PWA lifecycle)
const cleanupEventListeners = () => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('orientationchange', handleOrientationChange);
  if (window.visualViewport && visualViewportListener) {
    window.visualViewport.removeEventListener('resize', visualViewportListener);
  }
};

// Cleanup on page unload (for PWA lifecycle and testing)
window.addEventListener('beforeunload', cleanupEventListeners);

// Entry point for Vite; delegates to core App setup
createRoot(document.getElementById("root")!).render(
  <GlobalErrorBoundary>
    <App />
  </GlobalErrorBoundary>
);

// Export cleanup for use in tests or hot module replacement
if (import.meta.hot) {
  import.meta.hot.dispose(cleanupEventListeners);
}

