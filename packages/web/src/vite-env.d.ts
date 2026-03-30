/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  /** Origin of the super-admin app (e.g. http://localhost:5174) for postMessage session handoff */
  readonly VITE_ADMIN_APP_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
