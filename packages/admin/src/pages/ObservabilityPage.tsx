import { Link, useNavigate } from "react-router-dom"
import { useLogoutMutation } from "../services/api/authApi"
import { useGetObservabilityQuery } from "../services/api/adminApi"
import { clearAuth, getAuthTokens, getCurrentUser, isAuthenticated } from "../store/authSlice"
import { useAppDispatch, useAppSelector } from "../store/store"
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query"
import {
  HealthStatusBanner,
  ProcessMemoryChart,
  RawSnapshotDetails,
  ServicesHealthTable,
} from "./observability/ObservabilityVisualizations"

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatUptime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 48) return `${Math.floor(h / 24)}d ${h % 24}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function ObservabilityPage() {
  const authed = useAppSelector(isAuthenticated)
  const user = useAppSelector(getCurrentUser)
  const tokens = useAppSelector(getAuthTokens)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [logout] = useLogoutMutation()

  const { data, isLoading, isFetching, isError, error, refetch } = useGetObservabilityQuery(undefined, {
    skip: !authed,
  })

  const errMsg = (() => {
    if (!isError) return ""
    const e = error as FetchBaseQueryError
    if (e.status === 403) return "Forbidden — your account is not a super administrator."
    if (e.status === "FETCH_ERROR") return "Network error — is the API running?"
    return "Could not load observability data."
  })()

  const grafanaUrl = import.meta.env.VITE_GRAFANA_URL?.trim()

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
    <div className="admin-app">
      <header className="admin-header">
        <div>
          <span className="admin-badge">Admin</span>
          <h1 className="admin-header-title">Observability</h1>
          <p className="admin-header-sub">API health, process stats, and deployment metadata</p>
        </div>
        <div className="admin-header-actions">
          <span className="admin-muted admin-header-user">{user?.email}</span>
          <Link to="/scim" className="admin-btn admin-btn--ghost">
            SCIM
          </Link>
          <Link to="/org-flags" className="admin-btn admin-btn--ghost">
            Org flags
          </Link>
          <Link to="/voice-onboarding" className="admin-btn admin-btn--ghost">
            Voice onboarding
          </Link>
          <Link to="/embedding-anchors" className="admin-btn admin-btn--ghost">
            Embedding anchors
          </Link>
          <Link to="/corp-email" className="admin-btn admin-btn--ghost">
            Corp email
          </Link>
          <Link to="/impersonate" className="admin-btn admin-btn--ghost">
            Sign in as user
          </Link>
          <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
          <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void handleSignOut()}>
            Sign out
          </button>
        </div>
      </header>

      <main className="admin-main">
        {isLoading ? <p className="admin-muted">Loading…</p> : null}
        {isError ? (
          <div className="admin-card admin-card--warn">
            <p className="admin-error" role="alert">
              {errMsg}
            </p>
          </div>
        ) : null}

        {data ? (
          <div className="admin-grid">
            <section className="admin-card admin-card--wide">
              <HealthStatusBanner health={data.health} />
              <p className="admin-muted" style={{ marginTop: "0.75rem" }}>
                Environment <code className="admin-code">{data.health.environment}</code>
              </p>
            </section>

            <section className="admin-card admin-card--wide">
              <h2 className="admin-section-title">Dependency health</h2>
              <p className="admin-muted" style={{ marginBottom: "1rem" }}>
                Integration status from the same snapshot as <code className="admin-code">GET /health</code>.
              </p>
              <ServicesHealthTable services={data.health.services} />
              <RawSnapshotDetails value={data.health.services} />
            </section>

            <section className="admin-card">
              <h2 className="admin-section-title">API package</h2>
              <p className="admin-muted">
                {data.api.name} <code className="admin-code">{data.api.version}</code>
              </p>
            </section>

            <section className="admin-card">
              <h2 className="admin-section-title">Process</h2>
              <ul className="admin-kv">
                <li>
                  <span>Uptime</span>
                  <strong>{formatUptime(data.process.uptimeSeconds)}</strong>
                </li>
                <li>
                  <span>Node</span>
                  <strong>{data.process.nodeVersion}</strong>
                </li>
                <li>
                  <span>PID</span>
                  <strong>{data.process.pid}</strong>
                </li>
                <li>
                  <span>Heap used</span>
                  <strong>{formatBytes(data.process.memory.heapUsed)}</strong>
                </li>
                <li>
                  <span>RSS</span>
                  <strong>{formatBytes(data.process.memory.rss)}</strong>
                </li>
              </ul>
            </section>

            <section className="admin-card admin-card--wide">
              <h2 className="admin-section-title">Process memory (MB)</h2>
              <p className="admin-muted" style={{ marginBottom: "0.75rem" }}>
                Node <code className="admin-code">process.memoryUsage()</code> at snapshot time.
              </p>
              <ProcessMemoryChart memory={data.process.memory} />
            </section>

            <section className="admin-card admin-card--wide admin-card--grafana">
              <h2 className="admin-section-title">Metrics &amp; dashboards</h2>
              <p className="admin-muted" style={{ marginBottom: "0.75rem", lineHeight: 1.5 }}>
                Numbers here are a fresh snapshot when you refresh. For trends, SLOs, and alerting, scrape the API&apos;s{" "}
                <code className="admin-code">/metrics</code> with Prometheus and chart in Grafana (or another TSDB).
              </p>
              {grafanaUrl ? (
                <a href={grafanaUrl} target="_blank" rel="noreferrer" className="admin-btn admin-btn--primary">
                  Open Grafana
                </a>
              ) : null}
              <details className="admin-details-raw">
                <summary>Deployment &amp; scraping notes</summary>
                <ul
                  className="admin-muted"
                  style={{ margin: "0.75rem 0 0", paddingLeft: "1.25rem", fontSize: "0.8125rem", lineHeight: 1.55 }}
                >
                  <li>
                    <strong>Local Grafana stack:</strong> from the repo root run{" "}
                    <code className="admin-code">yarn dev:observability</code> (Prometheus on{" "}
                    <code className="admin-code">:9090</code>, Grafana on <code className="admin-code">:3333</code>, login{" "}
                    <code className="admin-code">admin</code> / <code className="admin-code">admin</code>). Keep the API on{" "}
                    <code className="admin-code">:3000</code> so Prometheus can scrape <code className="admin-code">/metrics</code>{" "}
                    via <code className="admin-code">host.docker.internal</code>.
                  </li>
                  <li>
                    Prometheus target: <code className="admin-code">GET /metrics</code> on the API host (see{" "}
                    <code className="admin-code">packages/backend/docker/observability/prometheus.yml</code>).
                  </li>
                  <li>
                    In production and staging, a bearer token may be required when{" "}
                    <code className="admin-code">METRICS_SCRAPE_TOKEN</code> is set on the backend — send{" "}
                    <code className="admin-code">Authorization: Bearer …</code> from Prometheus or your scraper.
                  </li>
                  <li>
                    Override the admin <strong>Open Grafana</strong> link with{" "}
                    <code className="admin-code">VITE_GRAFANA_URL</code> in the admin app env (defaults to{" "}
                    <code className="admin-code">http://localhost:3333</code> in Vite development).
                  </li>
                  <li>Centralize application logs with Loki, CloudWatch, or your stack if you need log search alongside metrics.</li>
                </ul>
              </details>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  )
}
