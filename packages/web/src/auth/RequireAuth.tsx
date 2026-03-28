import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAppSelector } from "../store/store"
import { isAuthenticated } from "../store/authSlice"

export function RequireAuth() {
  const authed = useAppSelector(isAuthenticated)
  const location = useLocation()

  if (!authed) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
