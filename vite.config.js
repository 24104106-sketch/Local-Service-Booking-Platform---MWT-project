import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Vendor code changes far less often than app code, so splitting it
        // into its own chunk(s) means returning visitors re-download only
        // the app bundle after an update, not React/router/framer-motion too.
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-motion": ["framer-motion"],
          "vendor-leaflet": ["leaflet"],
          "vendor-qrcode": ["qrcode"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/setupTests.js",
  },
});
