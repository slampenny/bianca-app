/**
 * Backend API base URL (same shape as mobile: …/v1).
 * Override with VITE_API_URL, e.g. http://localhost:3000/v1
 */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL
  if (typeof fromEnv === "string" && fromEnv.trim() !== "") {
    return fromEnv.replace(/\/$/, "")
  }
  return "http://localhost:3000/v1"
}
