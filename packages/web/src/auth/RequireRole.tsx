import { Navigate, Outlet, useLocation } from "react-router-dom"
import { getCurrentUser } from "../store/authSlice"
import { useAppSelector } from "../store/store"

type RequireRoleProps = {
  roles: string[]
}

export function RequireRole({ roles }: RequireRoleProps) {
  const location = useLocation()
  const user = useAppSelector(getCurrentUser)
  const role = user?.role || ""

  if (!roles.includes(role)) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  return <Outlet />
}
