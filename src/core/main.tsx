import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Service worker registration is handled automatically by vite-plugin-pwa
// with registerType: 'autoUpdate' - no manual registration needed

createRoot(document.getElementById("root")!).render(<App />);
