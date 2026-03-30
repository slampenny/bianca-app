const backend = process.env.BACKEND_URL || "http://localhost:3000"

export const BACKEND_URL = backend.replace(/\/$/, "")
export const API_URL = `${BACKEND_URL}/v1`
