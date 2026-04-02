import { useMemo } from "react"
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { ObservabilityPayload } from "../../services/api/api.types"

const MEMORY_BAR_COLORS = ["#38bdf8", "#22d3ee", "#a78bfa", "#64748b"]

const SERVICE_LABELS: Record<string, string> = {
  mongodb: "MongoDB",
  email: "Email",
  asterisk: "Asterisk (ARI)",
  openai: "OpenAI",
}

export type ServiceHealthRow = {
  id: string
  label: string
  state: "ok" | "warn" | "unknown"
  detail: string
}

function serviceRowsFromSnapshot(services: Record<string, unknown>): ServiceHealthRow[] {
  return Object.entries(services).map(([id, raw]) => {
    const v = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
    let state: ServiceHealthRow["state"] = "unknown"
    let detail = ""

    if (typeof v.ready === "boolean") {
      state = v.ready ? "ok" : "warn"
      detail = typeof v.status === "string" ? v.status : v.ready ? "Ready" : "Not ready"
    } else if (typeof v.apiKeyConfigured === "boolean") {
      state = v.apiKeyConfigured ? "ok" : "warn"
      detail = v.apiKeyConfigured ? "API key configured" : "No API key in config"
    } else {
      detail = JSON.stringify(raw)
    }

    return {
      id,
      label: SERVICE_LABELS[id] ?? id.replace(/_/g, " "),
      state,
      detail,
    }
  })
}

function bytesToMb(n: number): number {
  return n / (1024 * 1024)
}

export function HealthStatusBanner({ health }: Pick<ObservabilityPayload, "health">) {
  const ok = health.status?.toUpperCase() === "OK"
  const serviceEntries = Object.entries(health.services ?? {})
  const upCount = serviceEntries.filter(([_, raw]) => {
    const v = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
    if (typeof v.ready === "boolean") return v.ready
    if (typeof v.apiKeyConfigured === "boolean") return v.apiKeyConfigured
    return false
  }).length

  return (
    <div
      className={`admin-health-banner ${ok ? "admin-health-banner--ok" : "admin-health-banner--warn"}`}
      role="status"
    >
      <div>
        <p className="admin-health-banner-title">{ok ? "API reports healthy" : `Status: ${health.status}`}</p>
        <p className="admin-muted admin-health-banner-meta">
          {upCount}/{serviceEntries.length} dependency checks passing ·{" "}
          <time dateTime={health.timestamp}>{new Date(health.timestamp).toLocaleString()}</time>
        </p>
      </div>
      <span className={`admin-status-pill admin-status-pill--${ok ? "ok" : "warn"}`}>{health.status}</span>
    </div>
  )
}

export function ServicesHealthTable({ services }: { services: Record<string, unknown> }) {
  const rows = useMemo(() => serviceRowsFromSnapshot(services), [services])

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Service</th>
            <th>State</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <strong style={{ fontWeight: 600, color: "#e2e8f0" }}>{r.label}</strong>
              </td>
              <td>
                <span className={`admin-status-pill admin-status-pill--${r.state}`}>
                  {r.state === "ok" ? "OK" : r.state === "warn" ? "Attention" : "Unknown"}
                </span>
              </td>
              <td className="admin-muted" style={{ fontSize: "0.8125rem", maxWidth: 360 }}>
                {r.detail}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ProcessMemoryChart({ memory }: { memory: ObservabilityPayload["process"]["memory"] }) {
  const chartData = useMemo(() => {
    const entries: { name: string; mb: number }[] = []
    if (typeof memory.rss === "number") entries.push({ name: "RSS", mb: bytesToMb(memory.rss) })
    if (typeof memory.heapUsed === "number") entries.push({ name: "Heap used", mb: bytesToMb(memory.heapUsed) })
    if (typeof memory.heapTotal === "number") entries.push({ name: "Heap total", mb: bytesToMb(memory.heapTotal) })
    if (typeof memory.external === "number") entries.push({ name: "External", mb: bytesToMb(memory.external) })
    return entries
  }, [memory])

  if (chartData.length === 0) return <p className="admin-muted">No memory metrics.</p>

  const maxMb = Math.max(...chartData.map((d) => d.mb), 1)

  return (
    <div className="admin-chart-wrap">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        >
          <XAxis
            type="number"
            domain={[0, Math.ceil(maxMb * 1.15)]}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            stroke="#475569"
            tickFormatter={(v) => `${Number(v).toFixed(0)} MB`}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={92}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            stroke="#475569"
          />
          <Tooltip
            cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number) => [`${value.toFixed(2)} MB`, "Memory"]}
            labelStyle={{ color: "#cbd5e1" }}
          />
          <Bar dataKey="mb" radius={[0, 4, 4, 0]}>
            {chartData.map((row, i) => (
              <Cell key={row.name} fill={MEMORY_BAR_COLORS[i % MEMORY_BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function RawSnapshotDetails({ value }: { value: unknown }) {
  const text = useMemo(() => JSON.stringify(value, null, 2), [value])
  return (
    <details className="admin-details-raw">
      <summary>Raw JSON snapshot</summary>
      <pre className="admin-pre">{text}</pre>
    </details>
  )
}
