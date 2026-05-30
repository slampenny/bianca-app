/// <reference types="vitest/config" />

import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const locale = id.match(/[/\\]i18n[/\\]locales[/\\](es|fr|de|zh|ja|pt|it|ru|ar|ko|hu)\.ts/)
          if (locale) return `locale-${locale[1]}`
        },
      },
    },
  },
  resolve: {
    alias: {
      "@bianca-app/shared": path.resolve(__dirname, "../shared/src/index.ts"),
      "@bianca-app/ui/styles.css": path.resolve(__dirname, "../ui/src/styles.css"),
      "@bianca-app/ui": path.resolve(__dirname, "../ui/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // WSL / LAN: bind all interfaces; align HMR WebSocket with the page origin
    host: true,
    hmr: {
      protocol: "ws",
      port: 5173,
      clientPort: 5173,
    },
    watch: {
      usePolling: process.env.VITE_USE_POLLING === "1",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: true,
    pool: "forks",
  },
})
