import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

/** Local Grafana from `yarn dev:observability` (Docker profile); override with VITE_GRAFANA_URL. */
const DEFAULT_DEV_GRAFANA = "http://localhost:3333"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname), "")
  const grafanaFromEnv = typeof env.VITE_GRAFANA_URL === "string" ? env.VITE_GRAFANA_URL.trim() : ""
  const grafanaUrl = grafanaFromEnv || (mode === "development" ? DEFAULT_DEV_GRAFANA : "")

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@bianca-app/shared": path.resolve(__dirname, "../shared/src/index.ts"),
      },
    },
    server: {
      port: 5174,
    },
    define: {
      "import.meta.env.VITE_GRAFANA_URL": JSON.stringify(grafanaUrl),
    },
  }
})
