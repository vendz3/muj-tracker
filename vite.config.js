import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/muj-tracker/", // GitHub Pages repo name
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Life Journal",
        short_name: "Life Journal",
        display: "standalone",
        start_url: "/muj-tracker/",
        theme_color: "#09090B",
        background_color: "#09090B", // default theme (Midnight); the page sets theme-color per theme at runtime
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
          { src: "apple-touch-icon.png", sizes: "180x180", type: "image/png" }, // iOS can't use SVG on the home screen
        ],
      },
    }),
  ],
});
