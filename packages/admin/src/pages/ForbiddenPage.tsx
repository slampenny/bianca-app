import { useNavigate } from "react-router-dom"
import { useLogoutMutation } from "../services/api/authApi"
import { clearAuth, getAuthTokens, getCurrentUser } from "../store/authSlice"
import { useAppDispatch, useAppSelector } from "../store/store"

export function ForbiddenPage() {
  const user = useAppSelector(getCurrentUser)
  const tokens = useAppSelector(getAuthTokens)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [logout] = useLogoutMutation()

  const handleSignOut = async () => {
    const rt = tokens?.refresh?.token
    try {
      if (rt) await logout({ refreshToken: rt }).unwrap()
    } catch {
      /* still clear local session */
    }
    dispatch(clearAuth())
    navigate("/login", { replace: true })
  }

  return (
    <div className="admin-shell">
      <div className="admin-card" style={{ maxWidth: 480 }}>
        <h1 className="admin-title">Access restricted</h1>
        <p className="admin-muted">
          Signed in as <strong>{user?.email}</strong> ({user?.role}). This console is only for super administrators.
        </p>
        <div className="admin-actions">
          <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void handleSignOut()}>
            Sign out
          </button>
          <a className="admin-btn admin-btn--primary" href={import.meta.env.VITE_FACILITY_APP_URL || "http://localhost:5173/"}>
            Open facility app
          </a>
        </div>
      </div>
    </div>
  )
}
