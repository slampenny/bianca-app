import { Navigate, Outlet } from "react-router-dom"
import { useAppSelector } from "../store/store"
import { getCurrentUser, isAuthenticated } from "../store/authSlice"

export function RequireSuperAdmin() {
  const authed = useAppSelector(isAuthenticated)
  const user = useAppSelector(getCurrentUser)

  if (!authed) {
    return <Navigate to="/login" replace />
  }

  if (user?.role !== "superAdmin") {
    return <Navigate to="/forbidden" replace />
  }

  return <Outlet />
}
