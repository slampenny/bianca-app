import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { setSessionExpiredHandler } from "../services/api/baseQueryWithAuth"
import { store } from "../store/store"
import { clearAuth } from "../store/authSlice"
import { setOrg } from "../store/orgSlice"

/**
 * Registers the 401 handler so expired sessions redirect to /login (web equivalent of mobile auth modal).
 */
export function AuthSessionBridge() {
  const navigate = useNavigate()

  useEffect(() => {
    setSessionExpiredHandler(() => {
      store.dispatch(clearAuth())
      store.dispatch(setOrg(null))
      navigate("/login", {
        replace: true,
        state: { sessionExpired: true },
      })
    })
    return () => setSessionExpiredHandler(null)
  }, [navigate])

  return null
}
