import { useEffect, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { notifyAuthSuccess } from "../services/api/baseQueryWithAuth"
import type { AuthTokens, Caregiver, Org } from "../services/api/api.types"
import {
  hasSSOCallbackInUrl,
  tryCompleteRedirectAuth,
  SSO_REDIRECT_ERROR_KEY,
} from "../services/webSsoService"
import { setAuthEmail, setAuthTokens, setCurrentUser } from "../store/authSlice"
import { setOrg } from "../store/orgSlice"
import { useAppDispatch } from "../store/store"

/**
 * When the SPA loads with OAuth `code` in the URL, finish PKCE exchange and backend login
 * before showing the router tree (avoids a flash of the login screen when already signed in).
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
        backendOrg?: Org
      }
      if (user.tokens && user.backendUser) {
        dispatch(setAuthTokens(user.tokens))
        dispatch(setAuthEmail(user.email))
        dispatch(setCurrentUser(user.backendUser))
        if (user.backendOrg) dispatch(setOrg(user.backendOrg))
        notifyAuthSuccess()
        navigate("/", { replace: true })
      }
      setStatus("done")
    })
  }, [status, dispatch, navigate])

  if (status === "completing") {
    return (
      <div className="va-login">
        <div className="va-login-card" style={{ textAlign: "center" }}>
          <p className="va-login-tagline">Signing you in…</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
