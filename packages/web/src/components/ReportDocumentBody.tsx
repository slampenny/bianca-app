import type { ReportPayload } from "../data/reportCatalog"

export function ReportDocumentBody({ payload }: { payload: ReportPayload }) {
  return (
    <div className="va-report-doc">
      <div className="va-report-doc-brand">
        bianca<span className="va-report-doc-brand-dot">.</span>
      </div>
      <h2 className="va-report-doc-title">{payload.title}</h2>
      <p className="va-report-doc-meta">
        {payload.subtitle} · {payload.facilityLine} · {payload.generatedAtLabel}
      </p>
      {payload.narrative && payload.narrative.length > 0 ? (
        <ul className="va-report-doc-narrative">
          {payload.narrative.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {payload.tables.map((tab, idx) => (
        <div key={idx}>
          {tab.caption ? <div className="va-report-doc-table-cap">{tab.caption}</div> : null}
          <table className="va-report-doc-table">
            <thead>
              <tr>
                {tab.headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tab.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
