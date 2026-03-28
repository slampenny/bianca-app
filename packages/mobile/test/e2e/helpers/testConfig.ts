/**
 * Test configuration constants
 * Single source of truth for test URLs and ports
 */

// Frontend URL for E2E tests — must match the dev server you run:
//   `yarn web` → 8084 (default)   |   `yarn web:staging` / `yarn start` web → 8082
export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8084'
export const FRONTEND_PORT = process.env.FRONTEND_PORT || '8084'

// Backend URL for E2E tests (API is /v1)
export const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000'
export const BACKEND_PORT = process.env.BACKEND_PORT || '3000'

// API base (same as API_BASE_URL in backend helpers when unset)
export const API_URL = `${BACKEND_URL}/v1`

// Helper to construct URLs
export const getFrontendUrl = (path: string = '') => {
  const base = FRONTEND_URL.replace(/\/$/, '') // Remove trailing slash
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${cleanPath}`
}

export const getBackendUrl = (path: string = '') => {
  const base = BACKEND_URL.replace(/\/$/, '') // Remove trailing slash
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${cleanPath}`
}



















