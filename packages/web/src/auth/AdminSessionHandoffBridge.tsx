import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import type { AuthTokens, Caregiver, Org } from "../services/api/api.types"
import { notifyAuthSuccess } from "../services/api/baseQueryWithAuth"
import { setAuthEmail, setAuthTokens, setCurrentUser } from "../store/authSlice"
import { setOrg } from "../store/orgSlice"
import { resetRtkCachesAfterHandoff } from "../store/resetRtkCachesAfterHandoff"
import { store } from "../store/store"

/** Must match packages/admin sessionHandoff.ts */
const MSG_TYPE = "BIANCA_INJECT_SESSION"

function normalizeOrigin(url: string): string {
  return url.replace(/\/$/, "")
}

function isAuthTokens(value: unknown): value is AuthTokens {
  if (!value || typeof value !== "object") return false
  const v = value as AuthTokens
  return (
    typeof v.access?.token === "string" &&
    typeof v.refresh?.token === "string"
  )
}

/**
 * Origins allowed to inject a facility session via postMessage.
 * Production: set VITE_ADMIN_APP_ORIGIN to the admin app origin (e.g. https://admin.example.com).
 * Development: if unset, localhost:5174 and 127.0.0.1:5174 are accepted (default Vite port for @bianca-app/admin).
 */
function trustedAdminOrigins(): string[] {
  const raw = import.meta.env.VITE_ADMIN_APP_ORIGIN?.trim()
  if (raw) {
    return [normalizeOrigin(raw)]
  }
  if (import.meta.env.DEV) {
    return [normalizeOrigin("http://localhost:5174"), normalizeOrigin("http://127.0.0.1:5174")]
  }
  return []
}

/**
 * Accepts session payloads from the super-admin app (postMessage).
 */
export function AdminSessionHandoffBridge() {
  const navigate = useNavigate()

  useEffect(() => {
    const origins = trustedAdminOrigins()
    if (origins.length === 0) {
      if (import.meta.env.PROD) {
        console.warn(
          "[Bianca] Super-admin session handoff disabled: set VITE_ADMIN_APP_ORIGIN to your admin app origin.",
        )
      }
      return
    }

    const onMessage = (event: MessageEvent) => {
      const from = normalizeOrigin(event.origin)
      if (!origins.includes(from)) return

      const data = event.data as {
        type?: string
        payload?: { tokens?: unknown; caregiver?: unknown; org?: unknown }
      }
      if (!data || data.type !== MSG_TYPE || !data.payload?.caregiver) return
      if (!isAuthTokens(data.payload.tokens)) return

      // Admin retries postMessage every 200ms until the tab is ready; applying each time
      // resets RTK Query and refetches the whole dashboard (visible flicker).
      const incomingAccess = data.payload.tokens.access.token
      if (incomingAccess === store.getState().auth.tokens?.access?.token) {
        return
      }

      const caregiver = data.payload.caregiver as Caregiver
      store.dispatch(setAuthTokens(data.payload.tokens))
      store.dispatch(setCurrentUser(caregiver))
      if (typeof caregiver.email === "string") {
        store.dispatch(setAuthEmail(caregiver.email))
      }
      store.dispatch(setOrg((data.payload.org as Org | null | undefined) ?? null))
      resetRtkCachesAfterHandoff()
      notifyAuthSuccess()
      navigate("/", { replace: true })
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [navigate])

  return null
}
