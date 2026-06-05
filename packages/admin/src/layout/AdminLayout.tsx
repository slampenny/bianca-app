import { Outlet } from "react-router-dom"
import { AdminHeaderNav } from "../components/AdminHeaderNav"

export function AdminLayout() {
  return (
    <div className="admin-app">
      <header className="admin-topbar">
        <div className="admin-topbar-brand">
          <span className="admin-badge">Admin</span>
        </div>
        <AdminHeaderNav />
      </header>
      <Outlet />
    </div>
  )
}
