import { createRoot } from "react-dom/client";
import App from "./core/App.tsx";
import "./core/index.css";

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

// Update on resize (including orientation changes and browser UI changes)
window.addEventListener('resize', setViewportHeight);
window.addEventListener('orientationchange', () => {
  // Delay slightly to allow the browser to finish orientation change
  setTimeout(setViewportHeight, 100);
});

// Also update when the visual viewport changes (for virtual keyboard on mobile)
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', setViewportHeight);
}

// Entry point for Vite; delegates to core App setup
createRoot(document.getElementById("root")!).render(<App />);

