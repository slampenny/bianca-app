import { useEffect, useRef } from "react"
import { Platform } from "react-native"
import { useDispatch } from "react-redux"
import { ssoService } from "../services/ssoService"
import { setAuthTokens, setAuthEmail, setCurrentUser } from "../store/authSlice"
import { setCaregiver } from "../store/caregiverSlice"
import { setOrg } from "../store/orgSlice"
import { setClientsForCaregiver } from "../store/clientSlice"

const SSO_REDIRECT_ERROR_KEY = "sso_redirect_error"

/**
 * On web, completes SSO when the app loads after redirect from Google/Microsoft.
 * Dispatches auth state on success; stores error in sessionStorage for Login screen to show on failure.
 */
export function useSSORedirectCompletion() {
  const dispatch = useDispatch()
  const didRun = useRef(false)

  useEffect(() => {
    if (Platform.OS !== "web" || didRun.current) return
    didRun.current = true

    ssoService.tryCompleteRedirectAuth().then((result) => {
      if (!result) return
      if ("redirecting" in result) return

      if ("error" in result) {
        try {
          sessionStorage.setItem(
            SSO_REDIRECT_ERROR_KEY,
            JSON.stringify({ description: result.description || result.error })
          )
        } catch {
          // ignore
        }
        return
      }

      const user = result as typeof result & {
        tokens?: any
        backendUser?: any
        backendOrg?: any
        backendClients?: any[]
      }
      if (user.tokens && user.backendUser) {
        dispatch(setAuthTokens(user.tokens))
        dispatch(setAuthEmail(user.email))
        dispatch(setCurrentUser(user.backendUser))
        dispatch(setCaregiver(user.backendUser))
        if (user.backendOrg) dispatch(setOrg(user.backendOrg))
        if (user.backendClients && user.backendUser?.id) {
          dispatch(
            setClientsForCaregiver({
              caregiverId: user.backendUser.id,
              clients: user.backendClients,
            })
          )
        }
      }
    })
  }, [dispatch])
}

/**
 * Read and clear SSO redirect error set by useSSORedirectCompletion (for Login screen to show).
 */
export function consumeSSORedirectError(): string | null {
  if (Platform.OS !== "web" || typeof sessionStorage === "undefined") return null
  try {
    const raw = sessionStorage.getItem(SSO_REDIRECT_ERROR_KEY)
    sessionStorage.removeItem(SSO_REDIRECT_ERROR_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { description?: string }
    return parsed.description ?? null
  } catch {
    return null
  }
}
