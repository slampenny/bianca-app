import type { ReactNode } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useLogoutMutation } from "../services/api/authApi"
import { clearAuth, getAuthTokens, getCurrentUser } from "../store/authSlice"
import { useAppDispatch, useAppSelector } from "../store/store"

const NAV_LINKS: { to: string; label: string; end?: boolean }[] = [
  { to: "/", label: "Observability", end: true },
  { to: "/voice-onboarding", label: "Voice onboarding" },
  { to: "/backups", label: "Backups" },
  { to: "/org-flags", label: "Org flags" },
  { to: "/scim", label: "SCIM" },
  { to: "/embedding-anchors", label: "Embedding anchors" },
  { to: "/corp-email", label: "Corp email" },
  { to: "/security-events", label: "Security events" },
  { to: "/impersonate", label: "Sign in as user" },
]

function navActive(pathname: string, to: string, end?: boolean) {
  if (end) return pathname === to || pathname === ""
  return pathname === to || pathname.startsWith(`${to}/`)
}

type AdminHeaderNavProps = {
  children?: ReactNode
}

export function AdminHeaderNav({ children }: AdminHeaderNavProps) {
  const user = useAppSelector(getCurrentUser)
  const tokens = useAppSelector(getAuthTokens)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const [logout] = useLogoutMutation()

  const handleSignOut = async () => {
    const rt = tokens?.refresh?.token
    try {
      if (rt) await logout({ refreshToken: rt }).unwrap()
    } catch {
      /* ignore */
    }
    dispatch(clearAuth())
    navigate("/login", { replace: true })
  }

  return (
    <>
      <span className="admin-muted admin-header-user">{user?.email}</span>
      {NAV_LINKS.map(({ to, label, end }) => {
        const active = navActive(location.pathname, to, end)
        return (
          <Link
            key={to}
            to={to}
            className="admin-btn admin-btn--ghost"
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        )
      })}
      {children}
      <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void handleSignOut()}>
        Sign out
      </button>
    </>
  )
}
