import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { applyTheme, storedThemeId } from "./themes.js";

applyTheme(storedThemeId());
navigator.storage?.persist?.(); // ask the browser (Safari) not to evict localStorage; it decides, result unused

// Installed app is resumed, not reloaded: check for a new version on every return, show it once it takes over.
const sw = navigator.serviceWorker;
if (sw) {
  const hadController = !!sw.controller; // first install also fires controllerchange: no reload then
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") sw.ready.then((r) => r.update()).catch(() => {});
  });
  sw.addEventListener("controllerchange", () => {
    if (!hadController) return;
    // Never wipe a half-filled entry form: wait until the app goes to the background.
    if (!document.querySelector('[role="dialog"]')) location.reload();
    else document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && location.reload());
  });
}

createRoot(document.getElementById("root")).render(<App />);
