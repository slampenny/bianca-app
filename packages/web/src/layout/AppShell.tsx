import { skipToken } from "@reduxjs/toolkit/query"
import { useEffect, useMemo, useRef, useState } from "react"
import { NavLink, Outlet } from "react-router-dom"
import { isAlertUnreadForCaregiver } from "../lib/liveData"
import { useGetAllAlertsQuery } from "../services/api/alertApi"
import { useDemo, useDemoActions } from "../state/DemoContext"
import { useAppSelector } from "../store/store"
import { getCurrentUser } from "../store/authSlice"
import {
  BellIcon,
  DashboardIcon,
  FileTextIcon,
  PanelIcon,
  SettingsIcon,
  UsersIcon,
  ZapIcon,
} from "../icons"
import { formatHeaderLastActivity } from "../lib/timeFormat"
import "../vercel-app.css"

const NAV = [
  { to: "/", label: "Dashboard", icon: DashboardIcon, badge: false },
  { to: "/alerts", label: "Alerts", icon: BellIcon, badge: true },
  { to: "/residents", label: "Residents", icon: UsersIcon, badge: false },
  { to: "/reports", label: "Reports", icon: FileTextIcon, badge: false },
  { to: "/settings", label: "Settings", icon: SettingsIcon, badge: false },
] as const

function userInitials(name: string | undefined): string {
  if (!name?.trim()) return "—"
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0] ?? ""
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""
  return (a + b).toUpperCase() || "—"
}

export function AppShell() {
  const currentUser = useAppSelector(getCurrentUser)
  const authed = useAppSelector((s) => !!s.auth.tokens)
  const org = useAppSelector((s) => s.org)
  const facilityName = org?.name || "Sunrise Memory Care"
  const avatarLabel = useMemo(() => userInitials(currentUser?.name), [currentUser?.name])

  const { data: apiAlerts } = useGetAllAlertsQuery(authed ? undefined : skipToken)
  const liveUnread = useMemo(
    () => (apiAlerts ?? []).filter((a) => isAlertUnreadForCaregiver(a, currentUser?.id)).length,
    [apiAlerts, currentUser?.id],
  )

  const { state } = useDemo()
  const { toggleSidebar, triggerAlert, dismissToast } = useDemoActions()
  const { sidebarCollapsed, activityFeed, alerts, toastVisible, toastMessage } = state
  const demoNew = alerts.filter((a) => a.status === "new").length
  const newAlertCount = liveUnread + demoNew
  const first = activityFeed[0]
  const [lastLabel, setLastLabel] = useState(
    () => (first ? formatHeaderLastActivity(first.timestamp) : "No activity"),
  )

  useEffect(() => {
    const tick = () => {
      setLastLabel(
        first ? formatHeaderLastActivity(first.timestamp) : "No activity",
      )
    }
    tick()
    const id = setInterval(tick, 10_000)
    return () => clearInterval(id)
  }, [first])

  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (toastVisible) {
      toastRef.current = setTimeout(() => dismissToast(), 8000)
    }
    return () => {
      if (toastRef.current) clearTimeout(toastRef.current)
    }
  }, [toastVisible, dismissToast])

  return (
    <div className="va-app">
      <aside
        className={`va-aside ${sidebarCollapsed ? "va-aside--collapsed" : "va-aside--open"} group/sidebar`}
      >
        <div className="va-aside-top">
          {!sidebarCollapsed ? (
            <span className="va-logo">
              bianca<span className="va-logo-teal">.</span>
            </span>
          ) : (
            <span className="va-logo va-logo-teal" style={{ margin: "0 auto" }}>
              b.
            </span>
          )}
          <button
            type="button"
            className="va-icon-btn"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggleSidebar}
          >
            <PanelIcon size={16} rotated={sidebarCollapsed} />
          </button>
        </div>
        <nav className="va-nav">
          {NAV.map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `va-nav-link ${isActive ? "va-nav-link--active" : ""} ${sidebarCollapsed ? "justify-center" : ""}`
              }
            >
              <Icon size={20} />
              {!sidebarCollapsed && <span>{label}</span>}
              {badge && newAlertCount > 0 && (
                <span className="va-badge">{newAlertCount > 9 ? "9+" : newAlertCount}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="va-simulate-wrap">
          <button type="button" className="va-simulate-btn" onClick={triggerAlert}>
            <ZapIcon size={14} />
            {!sidebarCollapsed && <span>Simulate Alert</span>}
          </button>
        </div>
      </aside>

      <div className="va-main-col">
        <header className="va-header">
          <div className="va-header-loc">
            <span>{facilityName}</span>
            <span style={{ color: "var(--va-slate-300)", margin: "0 0.35rem" }}>—</span>
            <span style={{ color: "var(--va-slate-500)", fontWeight: 400 }}>Phoenix, AZ</span>
          </div>
          <div className="va-header-status">
            <span className="va-pulse" />
            <span style={{ color: "var(--va-success)", fontWeight: 600 }}>System Active</span>
          </div>
          <div className="va-header-meta">
            <span>
              Last activity: <strong style={{ color: "var(--va-slate-600)" }}>{lastLabel}</strong>
            </span>
            <div className="va-avatar" title={currentUser?.email || undefined}>
              {avatarLabel}
            </div>
          </div>
        </header>
        <main className="va-scroll">
          <Outlet />
        </main>
      </div>

      {toastVisible && (
        <div className="va-toast" role="status">
          <div className="va-toast-inner">
            <AlertOctagonInline />
            <p style={{ fontSize: "0.875rem", color: "var(--va-slate-700)", flex: 1 }}>{toastMessage}</p>
            <button type="button" className="va-toast-close" aria-label="Dismiss" onClick={dismissToast}>
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function AlertOctagonInline() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="var(--va-red-600)" strokeWidth="2">
      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
      <line x1="12" x2="12" y1="8" y2="12" strokeLinecap="round" />
      <line x1="12" x2="12.01" y1="16" y2="16" strokeLinecap="round" />
    </svg>
  )
}
