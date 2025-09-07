import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Apply compact view on initial load if saved in settings
const savedSettings = localStorage.getItem('dealOptimizerSettings');
if (savedSettings) {
  const settings = JSON.parse(savedSettings);
  if (settings.compactView !== false) { // Default to true if not explicitly false
    document.documentElement.classList.add('compact-view');
  }
} else {
  // Default to compact view ON when no settings are saved
  document.documentElement.classList.add('compact-view');
}

createRoot(document.getElementById("root")!).render(<App />);
