import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { applyTheme, storedThemeId } from "./themes.js";

applyTheme(storedThemeId());
navigator.storage?.persist?.(); // ask the browser (Safari) not to evict localStorage; it decides, result unused

createRoot(document.getElementById("root")).render(<App />);
