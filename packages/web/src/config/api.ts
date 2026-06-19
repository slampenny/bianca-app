const PRODUCTION_API_URL = "https://api.biancawellness.com/v1"

/** Show the configured API URL on the login page (dev/staging only). */
export function shouldShowLoginApiHint(): boolean {
  if (import.meta.env.DEV) return true
  return import.meta.env.VITE_API_URL !== PRODUCTION_API_URL
}

/**
 * Backend API base URL (same shape as mobile: …/v1).
 * Override with VITE_API_URL at build time, e.g. https://api.example.com/v1
 *
 * When the app is served from localhost (e.g. CI Playwright + Docker), use the
 * local backend so the same image tag as staging can run integration tests.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const h = window.location.hostname
    if (h === "localhost" || h === "127.0.0.1") {
      return "http://localhost:3000/v1"
    }
  }
  const fromEnv = import.meta.env.VITE_API_URL
  if (typeof fromEnv === "string" && fromEnv.trim() !== "") {
    const base = fromEnv.trim().replace(/\/$/, "")
    return base.endsWith("/v1") ? base : `${base}/v1`
  }
  return "http://localhost:3000/v1"
}

/**
 * HTTP origin for Socket.IO (same host as the API, without `/v1`).
 * The backend mounts `/socket.io` on the root server, not under the REST prefix.
 */
export function getSocketBaseUrl(): string {
  const api = getApiBaseUrl()
  return api.replace(/\/v1\/?$/, "")
}
