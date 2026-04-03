import { useEffect, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import type { AuthTokens, Caregiver } from "../services/api/api.types"
import {
  hasSSOCallbackInUrl,
  tryCompleteRedirectAuth,
  SSO_REDIRECT_ERROR_KEY,
} from "../services/webSsoService"
import { setAuthEmail, setAuthTokens, setCurrentUser } from "../store/authSlice"
import { useAppDispatch } from "../store/store"

/**
 * When the admin SPA loads with OAuth `code` on the root URL (redirect_uri = origin),
 * complete PKCE + backend login before rendering the rest of the app.
 */
export function SSOCallbackGate({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [status, setStatus] = useState<"completing" | "done">(() =>
    typeof window !== "undefined" && hasSSOCallbackInUrl() ? "completing" : "done",
  )

  useEffect(() => {
    if (status !== "completing") return

    void tryCompleteRedirectAuth().then((result) => {
      if (!result) {
        setStatus("done")
        return
      }
      if ("error" in result) {
        try {
          sessionStorage.setItem(
            SSO_REDIRECT_ERROR_KEY,
            JSON.stringify({ description: result.description || result.error }),
          )
        } catch {
          /* ignore */
        }
        setStatus("done")
        navigate("/login", { replace: true })
        return
      }

      const user = result as typeof result & {
        tokens?: AuthTokens
        backendUser?: Caregiver
      }
      if (user.tokens && user.backendUser) {
        dispatch(setAuthTokens(user.tokens))
        dispatch(setAuthEmail(user.email))
        dispatch(setCurrentUser(user.backendUser))
        navigate("/", { replace: true })
      }
      setStatus("done")
    })
  }, [status, dispatch, navigate])

  if (status === "completing") {
    return (
      <div className="admin-shell">
        <div className="admin-card admin-card--narrow">
          <p className="admin-muted" style={{ textAlign: "center", margin: 0 }}>
            Signing you in…
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
