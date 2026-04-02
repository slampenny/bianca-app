/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  /** Origin of the super-admin app (e.g. http://localhost:5174) for postMessage session handoff */
  readonly VITE_ADMIN_APP_ORIGIN?: string
  /** Google OAuth web client ID (defaults match mobile `app.config.ts` when unset) */
  readonly VITE_GOOGLE_CLIENT_ID?: string
  readonly VITE_MICROSOFT_CLIENT_ID?: string
  readonly VITE_MICROSOFT_TENANT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
