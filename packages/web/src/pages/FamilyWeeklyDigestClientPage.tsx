import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import { ConfirmModal } from "../components/ConfirmModal"
import { ReportDocumentBody } from "../components/ReportDocumentBody"
import { isDevDemoEnabled } from "../lib/devDemo"
import {
  familyWeeklyDigestWeekMeta,
  localDateInputValue,
  weekReferenceFromDateInput,
} from "../lib/familyWeeklyDigestWeek"
import { downloadReportPayloadCsv, printReportFromPayload } from "../lib/reportExport"
import { familyWeeklyDigestPreviewToReportPayload } from "../lib/familyWeeklyDigestReportPayload"
import {
  isFamilyWeeklyDigestRedacted,
  useCreateFamilyWeeklyDigestMutation,
  useListFamilyWeeklyDigestsQuery,
  usePreviewFamilyWeeklyDigestMutation,
  useSendFamilyWeeklyDigestMutation,
  type FamilyWeeklyDigest,
  type FamilyWeeklyDigestPreviewResponse,
} from "../services/api/familyWeeklyDigestApi"
import { isAuthenticated } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import { ChevronLeftIcon, DownloadIcon, PrintIcon } from "../icons"
import "../app.css"

const FamilyWeeklyDigestSample = import.meta.env.DEV
  ? lazy(() => import("./FamilyWeeklyDigestSample.dev").then((m) => ({ default: m.FamilyWeeklyDigestSample })))
  : null

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function familyDigestMutationError(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined
  const data = (err as { data?: { message?: string } }).data
  return data?.message
}

export function FamilyWeeklyDigestClientPage() {
  const { t } = useTranslation()
  const { clientId } = useParams<{ clientId: string }>()
  const navigate = useNavigate()
  const authed = useAppSelector(isAuthenticated)
  const isSample = clientId === "sample"

  if (!clientId) {
    return <Navigate to="/reports/family_weekly_digest" replace />
  }

  if (isSample) {
    if (!isDevDemoEnabled() || !FamilyWeeklyDigestSample) {
      return <Navigate to="/reports/family_weekly_digest" replace />
    }
    const Sample = FamilyWeeklyDigestSample
    return (
      <Suspense fallback={null}>
        <Sample />
      </Suspense>
    )
  }

  return <FamilyWeeklyDigestLive clientId={clientId} authed={authed} navigate={navigate} t={t} />
}

function FamilyWeeklyDigestEligibilityBanner({
  data,
  t,
}: {
  data: FamilyWeeklyDigestPreviewResponse | undefined
  t: ReturnType<typeof useTranslation>["t"]
}) {
  const eligibility = data?.eligibility ?? data?.payload?.eligibility
  if (!eligibility || eligibility.ok) {
    return null
  }

  return (
    <div
      data-testid="family-weekly-digest-eligibility"
      role="note"
      style={{
        padding: "0.75rem 0.85rem",
        borderRadius: 8,
        border: "1px solid var(--va-amber-200)",
        background: "var(--va-amber-50)",
        color: "var(--va-slate-800)",
        fontSize: "0.8125rem",
        lineHeight: 1.5,
        marginBottom: "1rem",
      }}
    >
      <strong style={{ display: "block", marginBottom: 4 }}>{t("familyWeeklyDigest.eligibilityBlockedTitle")}</strong>
      <p style={{ margin: "0 0 0.5rem" }}>{t("familyWeeklyDigest.eligibilityPreviewNote")}</p>
      <ul style={{ margin: 0, paddingLeft: "1.15rem" }}>
        {eligibility.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </div>
  )
}

function FamilyWeeklyDigestWeekMeta({
  data,
  t,
}: {
  data: FamilyWeeklyDigestPreviewResponse | undefined
  t: ReturnType<typeof useTranslation>["t"]
}) {
  const meta = familyWeeklyDigestWeekMeta(data)
  if (!meta.localWeekKey && !meta.weekRangeLabel && !meta.timezone) {
    return null
  }

  return (
    <div
      data-testid="family-weekly-digest-week-meta"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem",
        fontSize: "0.8125rem",
        color: "var(--va-slate-600)",
        lineHeight: 1.45,
      }}
    >
      {meta.localWeekKey ? (
        <strong data-testid="family-weekly-digest-local-week-key">
          {t("familyWeeklyDigest.weekOfLabel", { date: meta.localWeekKey })}
        </strong>
      ) : null}
      {meta.weekRangeLabel ? (
        <span data-testid="family-weekly-digest-week-range">{meta.weekRangeLabel}</span>
      ) : null}
      {meta.timezone ? (
        <span data-testid="family-weekly-digest-timezone">
          {t("familyWeeklyDigest.timezoneLabel", { timezone: meta.timezone })}
        </span>
      ) : null}
      {meta.legacyUtcWeek ? (
        <span
          data-testid="family-weekly-digest-legacy-utc"
          role="note"
          style={{ color: "var(--va-slate-500)", fontSize: "0.75rem" }}
        >
          {t("familyWeeklyDigest.legacyUtcWeekBanner")}
        </span>
      ) : null}
    </div>
  )
}

function PhiRedactedBanner({ t }: { t: ReturnType<typeof useTranslation>["t"] }) {
  return (
    <p
      data-testid="family-weekly-digest-phi-redacted-banner"
      role="note"
      style={{
        margin: "0 0 1rem",
        padding: "0.65rem 0.85rem",
        borderRadius: 8,
        fontSize: "0.8125rem",
        fontWeight: 600,
        color: "var(--va-slate-700)",
        background: "var(--va-slate-100)",
        border: "1px solid var(--va-slate-300)",
        lineHeight: 1.45,
      }}
    >
      {t("familyWeeklyDigest.phiRedactedBanner")}
    </p>
  )
}

function SavedDigestStatus({
  digest,
  t,
}: {
  digest: FamilyWeeklyDigest
  t: ReturnType<typeof useTranslation>["t"]
}) {
  const redacted = isFamilyWeeklyDigestRedacted(digest)
  const statusLabel = redacted
    ? t("familyWeeklyDigest.statusRedacted")
    : digest.status === "sent"
      ? t("familyWeeklyDigest.statusSent")
      : t("familyWeeklyDigest.statusDraft")

  return (
    <div
      data-testid="family-weekly-digest-saved-status"
      className="va-card va-card-pad"
      style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
    >
      <h2 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700, color: "var(--va-navy)" }}>
        {t("familyWeeklyDigest.savedForWeekTitle")}
      </h2>
      <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--va-slate-700)" }}>
        <strong data-testid="family-weekly-digest-saved-status-label">{statusLabel}</strong>
        {digest.recipient?.email ? (
          <>
            {" "}
            · {t("familyWeeklyDigest.recipientLabel")}:{" "}
            <span data-testid="family-weekly-digest-recipient-email">{digest.recipient.email}</span>
          </>
        ) : null}
      </p>
      {digest.status === "sent" && digest.sentAt ? (
        <p data-testid="family-weekly-digest-sent-at" style={{ margin: 0, fontSize: "0.8125rem", color: "var(--va-slate-600)" }}>
          {t("familyWeeklyDigest.sentAtLabel", { at: formatTimestamp(digest.sentAt) })}
        </p>
      ) : null}
      {digest.status === "sent" && !redacted ? (
        <p
          data-testid="family-weekly-digest-sent-immutable-banner"
          role="note"
          style={{
            margin: 0,
            padding: "0.65rem 0.85rem",
            borderRadius: 8,
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--va-teal-900, var(--va-navy))",
            background: "rgba(20, 184, 166, 0.1)",
            border: "1px solid rgba(20, 184, 166, 0.35)",
            lineHeight: 1.45,
          }}
        >
          {t("familyWeeklyDigest.sentImmutableBanner")}
        </p>
      ) : null}
    </div>
  )
}

function FamilyWeeklyDigestLive({
  clientId,
  authed,
  navigate,
  t,
}: {
  clientId: string
  authed: boolean
  navigate: ReturnType<typeof useNavigate>
  t: ReturnType<typeof useTranslation>["t"]
}) {
  const [weekRef, setWeekRef] = useState(() => localDateInputValue())
  const [actionError, setActionError] = useState("")
  const [actionSuccess, setActionSuccess] = useState("")
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false)

  const [preview, { data, isLoading, isError, reset }] = usePreviewFamilyWeeklyDigestMutation()
  const { data: listData, isError: listError, refetch: refetchList } = useListFamilyWeeklyDigestsQuery(
    { clientId, limit: 20, sortBy: "weekStart:desc" },
    { skip: !authed },
  )
  const [createDigest, { isLoading: creating }] = useCreateFamilyWeeklyDigestMutation()
  const [sendDigest, { isLoading: sending }] = useSendFamilyWeeklyDigestMutation()

  const loadLive = useCallback(
    (options?: { keepMessages?: boolean }) => {
      if (!options?.keepMessages) {
        setActionError("")
        setActionSuccess("")
      }
      void preview({ clientId, weekStart: weekReferenceFromDateInput(weekRef) })
    },
    [clientId, preview, weekRef],
  )

  useEffect(() => {
    if (!clientId || !authed) {
      reset()
      return
    }
    loadLive()
  }, [authed, clientId, loadLive, reset])

  const eligibility = data?.eligibility ?? data?.payload?.eligibility
  const canCreateOrSend = eligibility?.ok === true

  const weekDigest = useMemo(() => {
    if (!data?.localWeekKey || !listData?.results?.length) return null
    return listData.results.find((d) => d.localWeekKey === data.localWeekKey) ?? null
  }, [data?.localWeekKey, listData?.results])

  const weekDigestRedacted = isFamilyWeeklyDigestRedacted(weekDigest)
  const weekDigestSent = weekDigest?.status === "sent"
  const recipientEmail = weekDigest?.recipient?.email || data?.payload?.subtitleParts?.recipientLine || ""

  const livePayload = useMemo(() => {
    if (!data?.payload || weekDigestRedacted) return null
    return familyWeeklyDigestPreviewToReportPayload(data.payload)
  }, [data?.payload, weekDigestRedacted])

  const onCreateDraft = useCallback(async () => {
    if (!canCreateOrSend) return
    setActionError("")
    setActionSuccess("")
    try {
      await createDigest({ clientId, weekStart: weekReferenceFromDateInput(weekRef) }).unwrap()
      setActionSuccess(t("familyWeeklyDigest.createDraftSuccess"))
      await refetchList()
      loadLive({ keepMessages: true })
    } catch (err) {
      setActionError(familyDigestMutationError(err) || t("familyWeeklyDigest.createDraftError"))
    }
  }, [canCreateOrSend, clientId, createDigest, loadLive, refetchList, t, weekRef])

  const onConfirmSend = useCallback(async () => {
    if (!weekDigest?.id || !canCreateOrSend) return
    setActionError("")
    setActionSuccess("")
    try {
      const sent = await sendDigest({ digestId: weekDigest.id, clientId }).unwrap()
      setSendConfirmOpen(false)
      setActionSuccess(t("familyWeeklyDigest.sendSuccess", { email: sent.emailRecipient || sent.recipient?.email || "" }))
      await refetchList()
      loadLive({ keepMessages: true })
    } catch (err) {
      setSendConfirmOpen(false)
      const msg = familyDigestMutationError(err) || ""
      if (/already sent/i.test(msg)) {
        setActionError(t("familyWeeklyDigest.sendAlreadySent"))
      } else if (/consent|verified|opt-in|eligible|email/i.test(msg)) {
        setActionError(t("familyWeeklyDigest.sendEligibilityChanged"))
      } else {
        setActionError(msg || t("familyWeeklyDigest.sendError"))
      }
    }
  }, [canCreateOrSend, clientId, loadLive, refetchList, sendDigest, t, weekDigest?.id])

  const showCreateButton = authed && canCreateOrSend && !weekDigestSent && !weekDigestRedacted
  const showSendButton =
    authed && canCreateOrSend && weekDigest?.status === "draft" && !weekDigestRedacted && Boolean(weekDigest?.id)

  return (
    <div
      data-testid="report-detail-page"
      style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: 900, margin: "0 auto", paddingBottom: 48 }}
    >
      <button
        type="button"
        className="va-btn-ghost"
        data-testid="report-detail-back"
        onClick={() => navigate("/reports/family_weekly_digest")}
      >
        <ChevronLeftIcon size={16} />
        {t("familyWeeklyDigest.back")}
      </button>

      {authed ? (
        <div className="va-card va-card-pad" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.75rem", color: "var(--va-slate-600)" }}>
              {t("familyWeeklyDigest.weekLabel")}
              <input
                type="date"
                className="va-input"
                data-testid="family-weekly-digest-week-input"
                value={weekRef}
                onChange={(e) => setWeekRef(e.target.value)}
                style={{ padding: "0.5rem 0.65rem", borderRadius: 6, border: "1px solid var(--va-slate-200)" }}
              />
            </label>
            <button type="button" className="va-btn-secondary" onClick={() => loadLive()} disabled={isLoading}>
              {isLoading ? t("familyWeeklyDigest.loadingPreview") : t("familyWeeklyDigest.refreshPreview")}
            </button>
          </div>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--va-slate-500)", lineHeight: 1.45 }}>
            {t("familyWeeklyDigest.weekDateHelper")}
          </p>
          {data ? <FamilyWeeklyDigestWeekMeta data={data} t={t} /> : null}
        </div>
      ) : null}

      {authed ? (
        <p
          data-testid="family-weekly-digest-external-email-notice"
          style={{ margin: 0, fontSize: "0.8125rem", color: "var(--va-slate-600)", lineHeight: 1.5 }}
        >
          {t("familyWeeklyDigest.externalEmailNotice")}
        </p>
      ) : null}

      {weekDigest ? <SavedDigestStatus digest={weekDigest} t={t} /> : authed && data && !listError ? (
        <p data-testid="family-weekly-digest-no-saved" style={{ margin: 0, fontSize: "0.8125rem", color: "var(--va-slate-500)" }}>
          {t("familyWeeklyDigest.noSavedForWeek")}
        </p>
      ) : null}

      {listError ? (
        <p style={{ margin: 0, color: "var(--va-red-600)", fontSize: "0.8125rem" }} role="alert">
          {t("familyWeeklyDigest.listLoadError")}
        </p>
      ) : null}

      <div className="va-card va-card-pad">
        {authed && data ? <FamilyWeeklyDigestEligibilityBanner data={data} t={t} /> : null}

        {authed && canCreateOrSend ? (
          <p
            data-testid="family-weekly-digest-ai-disclaimer"
            style={{
              margin: "0 0 1rem",
              padding: "0.65rem 0.85rem",
              borderRadius: 8,
              fontSize: "0.75rem",
              color: "var(--va-slate-600)",
              background: "var(--va-slate-50)",
              border: "1px solid var(--va-slate-200)",
              lineHeight: 1.45,
            }}
          >
            {t("familyWeeklyDigest.aiDisclaimer")}
          </p>
        ) : null}

        {actionError ? (
          <p data-testid="family-weekly-digest-action-error" style={{ margin: "0 0 1rem", color: "var(--va-red-600)" }} role="alert">
            {actionError}
          </p>
        ) : null}
        {actionSuccess ? (
          <p data-testid="family-weekly-digest-action-success" style={{ margin: "0 0 1rem", color: "var(--va-teal-700)" }} role="status">
            {actionSuccess}
          </p>
        ) : null}

        {authed && isError ? (
          <p style={{ margin: 0, color: "var(--va-red-600)" }} role="alert">
            {t("familyWeeklyDigest.loadError")}
          </p>
        ) : authed && isLoading && !data ? (
          <p style={{ margin: 0, color: "var(--va-slate-600)" }}>{t("familyWeeklyDigest.loadingPreview")}</p>
        ) : weekDigestRedacted ? (
          <PhiRedactedBanner t={t} />
        ) : livePayload ? (
          <>
            <ReportDocumentBody payload={livePayload} />
            <div className="va-report-modal-actions">
              <button type="button" className="va-btn-secondary" onClick={() => printReportFromPayload(livePayload)}>
                <PrintIcon size={18} />
                {t("reportDetail.printPdf")}
              </button>
              <button
                type="button"
                className="va-btn-secondary"
                onClick={() => downloadReportPayloadCsv(livePayload, "bianca-weekly-family-digest")}
              >
                <DownloadIcon size={18} />
                {t("reportDetail.downloadCsv")}
              </button>
            </div>
          </>
        ) : authed ? (
          <p style={{ margin: 0, color: "var(--va-slate-600)" }}>{t("familyWeeklyDigest.loadingPreview")}</p>
        ) : null}

        {authed ? (
          <div
            data-testid="family-weekly-digest-actions"
            style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1.25rem" }}
          >
            {showCreateButton ? (
              <button
                type="button"
                className="va-btn-primary"
                data-testid="family-weekly-digest-create-draft"
                disabled={creating || sending}
                onClick={() => void onCreateDraft()}
              >
                {creating ? t("familyWeeklyDigest.creatingDraft") : t("familyWeeklyDigest.createDraft")}
              </button>
            ) : null}
            {showSendButton ? (
              <button
                type="button"
                className="va-btn-secondary"
                data-testid="family-weekly-digest-send"
                disabled={creating || sending}
                onClick={() => setSendConfirmOpen(true)}
              >
                {sending ? t("familyWeeklyDigest.sending") : t("familyWeeklyDigest.sendToFamily")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {authed && listData?.results?.length ? (
        <div className="va-card va-card-pad" data-testid="family-weekly-digest-recent-list">
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "0.9375rem", fontWeight: 700, color: "var(--va-navy)" }}>
            {t("familyWeeklyDigest.recentTitle")}
          </h2>
          <ul style={{ margin: 0, paddingLeft: "1.15rem", fontSize: "0.8125rem", color: "var(--va-slate-700)", lineHeight: 1.6 }}>
            {listData.results.map((d) => {
              const status = isFamilyWeeklyDigestRedacted(d)
                ? t("familyWeeklyDigest.statusRedacted")
                : d.status === "sent"
                  ? t("familyWeeklyDigest.statusSent")
                  : t("familyWeeklyDigest.statusDraft")
              return (
                <li key={d.id} data-testid={`family-weekly-digest-recent-${d.id}`}>
                  {t("familyWeeklyDigest.listWeekStatus", { week: d.localWeekKey, status })}
                  {d.recipient?.email ? ` · ${d.recipient.email}` : ""}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <ConfirmModal
        open={sendConfirmOpen}
        title={t("familyWeeklyDigest.sendConfirmTitle")}
        onClose={() => setSendConfirmOpen(false)}
        onConfirm={() => void onConfirmSend()}
        confirmLabel={sending ? t("familyWeeklyDigest.sending") : t("familyWeeklyDigest.sendConfirmButton")}
        confirmDisabled={sending}
      >
        <p style={{ margin: 0 }}>{t("familyWeeklyDigest.sendConfirmBody", { email: weekDigest?.recipient?.email || recipientEmail })}</p>
        <p style={{ margin: "0.75rem 0 0", fontSize: "0.8125rem", color: "var(--va-slate-600)" }}>{t("familyWeeklyDigest.aiDisclaimer")}</p>
      </ConfirmModal>
    </div>
  )
}
