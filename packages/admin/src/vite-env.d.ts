/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_FACILITY_APP_URL?: string
  /** Optional link target for “Open Grafana” on the observability page */
  readonly VITE_GRAFANA_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
