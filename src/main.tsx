import { createRoot } from "react-dom/client";
import App from "./core/App.tsx";
import "./core/index.css";

// Entry point for Vite; delegates to core App setup
createRoot(document.getElementById("root")!).render(<App />);

