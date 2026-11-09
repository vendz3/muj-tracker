import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { applyTheme, storedThemeId } from "./themes.js";

applyTheme(storedThemeId());

createRoot(document.getElementById("root")).render(<App />);
