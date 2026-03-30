/**
 * Backend API base URL (…/v1). Override with VITE_API_URL.
 */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL
  if (typeof fromEnv === "string" && fromEnv.trim() !== "") {
    return fromEnv.replace(/\/$/, "")
  }
  return "http://localhost:3000/v1"
}
