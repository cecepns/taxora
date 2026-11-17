import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  plugins: [react(), VitePWA({ registerType: "autoUpdate", manifest: { name: "TAXORA - Tax Center PKN STAN", short_name: "TAXORA", theme_color: "#0E5A7C", background_color: "#ffffff", display: "standalone",
    icons: [{ src: "/logo.jpeg", sizes: "512x512", type: "image/jpeg" }] } })],
});
