/**
 * Test configuration constants
 * Single source of truth for test URLs and ports
 */

// Frontend URL for E2E tests
export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8082'
export const FRONTEND_PORT = process.env.FRONTEND_PORT || '8082'

// Backend URL for E2E tests
export const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000'
export const BACKEND_PORT = process.env.BACKEND_PORT || '3000'

// API URL
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





