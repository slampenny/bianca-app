import { useEffect, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { notifyAuthSuccess } from "../services/api/baseQueryWithAuth"
import type { AuthTokens, Caregiver, Org } from "../services/api/api.types"
import {
  clearOAuthCallbackActive,
  isOAuthCallbackActive,
  tryCompleteRedirectAuth,
  SSO_REDIRECT_ERROR_KEY,
} from "../services/webSsoService"
import { needsOnboarding, resolvePostAuthPath } from "../lib/postAuthNavigation"
import { setAuthEmail, setAuthTokens, setCurrentUser, setPendingOnboarding } from "../store/authSlice"
import { setOrg } from "../store/orgSlice"
import { useAppDispatch } from "../store/store"

function storeSsoError(message: string) {
  try {
    sessionStorage.setItem(SSO_REDIRECT_ERROR_KEY, JSON.stringify({ description: message }))
  } catch {
    /* ignore */
  }
}

/**
 * When the SPA loads with OAuth `code` in the URL, finish PKCE exchange and backend login
 * before showing the router tree (avoids a flash of the login screen when already signed in).
 */
export function SSOCallbackGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [completing, setCompleting] = useState(() => isOAuthCallbackActive())

  useEffect(() => {
    if (!isOAuthCallbackActive()) return

    setCompleting(true)

    void tryCompleteRedirectAuth()
      .then((result) => {
        if (!result) {
          storeSsoError("Sign-in could not be completed. Please try again.")
          navigate("/login", { replace: true })
          return
        }

        if ("error" in result) {
          storeSsoError(result.description || result.error)
          navigate("/login", { replace: true })
          return
        }

        const user = result as typeof result & {
          tokens?: AuthTokens
          backendUser?: Caregiver
          backendOrg?: Org
        }

        if (!user.tokens || !user.backendUser) {
          storeSsoError("Sign-in succeeded but the app did not receive a session. Please try again.")
          navigate("/login", { replace: true })
          return
        }

        const caregiver = user.backendUser as Caregiver
        dispatch(setAuthTokens(user.tokens))
        dispatch(setAuthEmail(user.email))
        dispatch(setCurrentUser(caregiver))
        dispatch(setPendingOnboarding(needsOnboarding(caregiver)))
        if (user.backendOrg) dispatch(setOrg(user.backendOrg))
        notifyAuthSuccess()
        navigate(resolvePostAuthPath(caregiver), { replace: true })
      })
      .finally(() => {
        clearOAuthCallbackActive()
        setCompleting(false)
      })
  }, [dispatch, navigate])

  if (completing) {
    return (
      <div className="va-login">
        <div className="va-login-card" style={{ textAlign: "center" }}>
          <p className="va-login-tagline">{t("sso.signingIn")}</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
