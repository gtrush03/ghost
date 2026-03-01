import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3003",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:3003",
        changeOrigin: true,
      },
      "/price": {
        target: "http://localhost:3002",
        changeOrigin: true,
      },
    },
  },
});
