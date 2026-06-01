import type { ReportPayload } from "../data/reportCatalog"

function escapeCsvCell(s: string): string {
  return `"${String(s).replace(/"/g, '""')}"`
}

export function downloadReportCsv(filename: string, headers: string[], rows: string[][]): void {
  const lines = [headers.map(escapeCsvCell).join(","), ...rows.map((r) => r.map(escapeCsvCell).join(","))]
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** CSV from any report payload (live or dev sample). */
export function downloadReportPayloadCsv(p: ReportPayload, filenameBase: string): void {
  const day = new Date().toISOString().slice(0, 10)
  const primary = p.tables[0]
  if (!primary) return
  downloadReportCsv(`${filenameBase}-${day}.csv`, primary.headers, primary.rows)
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function payloadToPrintableHtml(p: ReportPayload): string {
  const narrativeBlock =
    p.narrative && p.narrative.length > 0
      ? `<ul>${p.narrative.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
      : ""
  const tablesBlock = p.tables
    .map((tab) => {
      const cap = tab.caption ? `<p class="cap">${escapeHtml(tab.caption)}</p>` : ""
      const head = `<tr>${tab.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>`
      const body = tab.rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`).join("")
      return `${cap}<table><thead>${head}</thead><tbody>${body}</tbody></table>`
    })
    .join("")

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${escapeHtml(p.title)}</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; padding: 28px; color: #0f172a; max-width: 720px; margin: 0 auto; line-height: 1.45; }
  .brand { font-weight: 700; font-size: 1.05rem; letter-spacing: 0.02em; margin-bottom: 20px; }
  .brand .dot { color: #14b8a6; }
  h1 { font-size: 1.35rem; margin: 0 0 6px; font-weight: 700; }
  .meta { color: #64748b; font-size: 0.875rem; margin-bottom: 18px; }
  .cap { font-weight: 600; font-size: 0.875rem; margin: 18px 0 8px; }
  table { border-collapse: collapse; width: 100%; font-size: 0.8125rem; margin-bottom: 8px; }
  th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #f8fafc; font-weight: 600; }
  ul { font-size: 0.875rem; margin: 0 0 16px; padding-left: 1.25rem; }
</style></head><body>
  <div class="brand">bianca<span class="dot">.</span></div>
  <h1>${escapeHtml(p.title)}</h1>
  <p class="meta">${escapeHtml(p.subtitle)} · ${escapeHtml(p.facilityLine)} · ${escapeHtml(p.generatedAtLabel)}</p>
  ${narrativeBlock}
  ${tablesBlock}
</body></html>`
}

/** Opens the browser print dialog (save as PDF from there). */
export function printReportFromPayload(p: ReportPayload): void {
  const html = payloadToPrintableHtml(p)
  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700")
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  w.print()
}
