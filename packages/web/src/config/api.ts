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
    return fromEnv.replace(/\/$/, "")
  }
  return "http://localhost:3000/v1"
}
