import { skipToken } from "@reduxjs/toolkit/query"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { isAlertUnreadForCaregiver } from "../lib/liveData"
import { canManageCaregivers } from "../lib/roleAccess"
import { useGetAllAlertsQuery, liveAlertsQueryOptions } from "../services/api/alertApi"
import { useGetCaregiverQuery } from "../services/api/caregiverApi"
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
import { LocaleSync } from "../i18n/LocaleSync"
import { useDocumentTitle } from "../hooks/useDocumentTitle"
import { RealtimeSocketBridge } from "../realtime/RealtimeSocketBridge"
import "../app.css"

type NavItem = {
  to: string
  labelKey: string
  icon: typeof DashboardIcon
  badge: boolean
  orgAdminOnly?: boolean
  testId?: string
}

const NAV: NavItem[] = [
  { to: "/", labelKey: "nav.dashboard", icon: DashboardIcon, badge: false },
  { to: "/alerts", labelKey: "nav.alerts", icon: BellIcon, badge: true },
  { to: "/residents", labelKey: "nav.residents", icon: UsersIcon, badge: false },
  { to: "/caregivers", labelKey: "nav.caregivers", icon: UsersIcon, badge: false, orgAdminOnly: true },
  { to: "/reports", labelKey: "nav.reports", icon: FileTextIcon, badge: false },
  { to: "/settings", labelKey: "nav.settings", icon: SettingsIcon, badge: false },
]

function userInitials(name: string | undefined): string {
  if (!name?.trim()) return "—"
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0] ?? ""
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""
  return (a + b).toUpperCase() || "—"
}

export function AppShell() {
  const { t } = useTranslation()
  useDocumentTitle()
  const navigate = useNavigate()
  const currentUser = useAppSelector(getCurrentUser)
  const authed = useAppSelector((s) => !!s.auth.tokens)
  const org = useAppSelector((s) => s.org)
  const facilityName = org?.name || t("appShell.defaultFacility")
  const userId = currentUser?.id != null ? String(currentUser.id) : ""
  const { data: caregiverFresh } = useGetCaregiverQuery({ id: userId }, { skip: !authed || !userId })
  const avatarLabel = useMemo(() => userInitials(currentUser?.name), [currentUser?.name])
  const avatarRaw = caregiverFresh?.avatar ?? currentUser?.avatar
  const avatarUrl = avatarRaw && String(avatarRaw).trim() ? String(avatarRaw).trim() : ""

  const { data: apiAlerts } = useGetAllAlertsQuery(undefined, {
    ...liveAlertsQueryOptions,
    skip: !authed,
  })
  const liveUnread = useMemo(
    () => (apiAlerts ?? []).filter((a) => isAlertUnreadForCaregiver(a, currentUser?.id)).length,
    [apiAlerts, currentUser?.id],
  )

  const { state } = useDemo()
  const { toggleSidebar, triggerAlert, dismissToast } = useDemoActions()
  const { sidebarCollapsed, activityFeed, alerts, toastVisible, toastMessage } = state
  const demoNew = alerts.filter((a) => a.status === "new").length
  const newAlertCount = liveUnread + demoNew
  const navItems = useMemo(
    () =>
      NAV.filter((n) => !n.orgAdminOnly || canManageCaregivers(currentUser?.role)),
    [currentUser?.role],
  )
  const first = activityFeed[0]
  const [lastLabel, setLastLabel] = useState(
    () => (first ? formatHeaderLastActivity(first.timestamp) : t("header.noActivity")),
  )

  useEffect(() => {
    const tick = () => {
      setLastLabel(
        first ? formatHeaderLastActivity(first.timestamp) : t("header.noActivity"),
      )
    }
    tick()
    const id = setInterval(tick, 10_000)
    return () => clearInterval(id)
  }, [first, t])

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
      <LocaleSync />
      <RealtimeSocketBridge />
      <aside
        className={`va-aside ${sidebarCollapsed ? "va-aside--collapsed" : "va-aside--open"} group/sidebar`}
      >
        <div className="va-aside-top">
          {!sidebarCollapsed ? (
            <div className="va-logo-row">
              <img
                src="/bianca-mark.png"
                alt=""
                className="va-logo-mark"
                decoding="async"
                aria-hidden
              />
              <span className="va-logo">
                bianca<span className="va-logo-teal">.</span>
              </span>
            </div>
          ) : (
            <img
              src="/bianca-mark.png"
              alt="Bianca"
              className="va-logo-mark va-logo-mark--collapsed"
              decoding="async"
              style={{ margin: "0 auto" }}
            />
          )}
          <button
            type="button"
            className="va-icon-btn"
            aria-label={sidebarCollapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
            onClick={toggleSidebar}
          >
            <PanelIcon size={16} rotated={sidebarCollapsed} />
          </button>
        </div>
        <nav className="va-nav">
          {navItems.map(({ to, labelKey, icon: Icon, badge, testId }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              data-testid={testId ?? `nav-${labelKey.split(".").pop()}`}
              className={({ isActive }) =>
                `va-nav-link ${isActive ? "va-nav-link--active" : ""} ${sidebarCollapsed ? "justify-center" : ""}`
              }
            >
              <Icon size={20} />
              {!sidebarCollapsed && <span>{t(labelKey)}</span>}
              {badge && newAlertCount > 0 && (
                <span className="va-badge">{newAlertCount > 9 ? "9+" : newAlertCount}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="va-simulate-wrap">
          <button type="button" className="va-simulate-btn" onClick={triggerAlert}>
            <ZapIcon size={14} />
            {!sidebarCollapsed && <span>{t("nav.simulateAlert")}</span>}
          </button>
        </div>
      </aside>

      <div className="va-main-col">
        <a href="#main-content" className="va-skip-link">
          {t("appShell.skipToMain")}
        </a>
        <header className="va-header">
          <div className="va-header-loc">
            <span>{facilityName}</span>
            <span style={{ color: "var(--va-slate-300)", margin: "0 0.35rem" }}>—</span>
            <span style={{ color: "var(--va-slate-500)", fontWeight: 400 }}>{t("appShell.locationLine")}</span>
          </div>
          <div className="va-header-status">
            <span className="va-pulse" />
            <span style={{ color: "var(--va-success)", fontWeight: 600 }}>{t("header.systemActive")}</span>
          </div>
          <div className="va-header-meta">
            <span>
              {t("header.lastActivity")}{" "}
              <strong style={{ color: "var(--va-slate-600)" }}>{lastLabel}</strong>
            </span>
            <button
              type="button"
              className="va-avatar"
              title={currentUser?.email || undefined}
              aria-label={t("profile.ariaProfile")}
              onClick={() => navigate("/profile")}
              style={{ cursor: "pointer" }}
            >
              {avatarUrl ? (
                <img
                  className="va-avatar-img"
                  src={avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                avatarLabel
              )}
            </button>
          </div>
        </header>
        <main id="main-content" className="va-scroll" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      {toastVisible && (
        <div className="va-toast" role="status">
          <div className="va-toast-inner">
            <AlertOctagonInline />
            <p style={{ fontSize: "0.875rem", color: "var(--va-slate-700)", flex: 1 }}>{toastMessage}</p>
            <button type="button" className="va-toast-close" aria-label={t("common.dismiss")} onClick={dismissToast}>
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
