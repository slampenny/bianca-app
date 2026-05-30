import { skipToken } from "@reduxjs/toolkit/query"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ChevronLeftIcon } from "../icons"
import { AuthTextField } from "../components/AuthTextField"
import { useGetClientQuery } from "../services/api/clientApi"
import { useEndCallMutation, useGetCallStatusQuery, useInitiateCallMutation } from "../services/api/callWorkflowApi"
import { mapClientToResident } from "../lib/liveData"
import { canAddResidents } from "../lib/roleAccess"
import { getCurrentUser } from "../store/authSlice"
import { useAppSelector } from "../store/store"

type ActiveResidentCall = {
  conversationId: string
  status: string
  callStatus?: string
  callType?: string
  onboardingDay?: number | null
  onboardingJourneyComplete?: boolean
  onboardingSessionsCompleted?: number
  onboardingCurrentStageDay?: number | null
  onboardingTotalDays?: number
  isOnboardingCall?: boolean
}

export function ResidentCallPage() {
  const { t } = useTranslation()
  const { residentId } = useParams()
  const navigate = useNavigate()
  const user = useAppSelector(getCurrentUser)
  const canCallNow = canAddResidents(user?.role)

  const [callNotesDraft, setCallNotesDraft] = useState("")
  const [callError, setCallError] = useState("")
  const [activeCall, setActiveCall] = useState<ActiveResidentCall | null>(null)
  const [hasAutoCalled, setHasAutoCalled] = useState(true)
  const autoCallAttempted = useRef(false)

  const { data: apiClient, isLoading: loadingClient } = useGetClientQuery(residentId ? { id: residentId } : skipToken)
  const [initiateCall, { isLoading: isInitiatingCall }] = useInitiateCallMutation()
  const [endCall, { isLoading: isEndingCall }] = useEndCallMutation()

  const terminalCallStatuses = new Set(["completed", "failed"])
  const {
    data: liveCallStatus,
    isFetching: liveCallFetching,
    isError: liveCallStatusError,
  } = useGetCallStatusQuery(
    activeCall?.conversationId ? { conversationId: activeCall.conversationId } : skipToken,
    { pollingInterval: activeCall && !terminalCallStatuses.has(activeCall.status) ? 2000 : 0 },
  )

  useEffect(() => {
    if (!liveCallStatus?.data) return
    setActiveCall((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        status: liveCallStatus.data.status || prev.status,
        callStatus: liveCallStatus.data.callStatus || prev.callStatus,
        callType: liveCallStatus.data.callType || prev.callType,
      }
    })
  }, [liveCallStatus?.data])

  const resident = apiClient ? mapClientToResident(apiClient) : null
  const displayName = resident ? resident.displayName : t("residentCall.defaultResidentName")
  const effectiveCallStatus = liveCallStatus?.data?.status || activeCall?.status || ""
  const twilioLiveCallStatus = liveCallStatus?.data?.callStatus
  const isLiveCall =
    effectiveCallStatus === "in-progress" ||
    ["ringing", "connected", "answered"].includes(twilioLiveCallStatus || "")
  const liveCallMessages = liveCallStatus?.data?.messages ?? []
  const liveOnboarding = liveCallStatus?.data?.onboarding
  const liveIsOnboardingCall = liveOnboarding?.isOnboardingCall ?? activeCall?.isOnboardingCall ?? false
  const liveOnboardingDay = liveOnboarding?.onboardingDay ?? activeCall?.onboardingDay ?? null
  const liveSessionsCompleted = liveOnboarding?.sessionsCompleted ?? activeCall?.onboardingSessionsCompleted ?? 0
  const liveOnboardingTotalDays = liveOnboarding?.totalDays ?? activeCall?.onboardingTotalDays ?? 4
  const liveCurrentStageDay = liveOnboarding?.currentStageDay ?? activeCall?.onboardingCurrentStageDay ?? null

  const onCallNow = useCallback(async () => {
    if (!apiClient?.id || isInitiatingCall || !canCallNow) return
    setCallError("")
    try {
      const resp = await initiateCall({
        clientId: apiClient.id,
        callNotes:
          callNotesDraft.trim() ||
          t("residentCall.manualCallNotes", { name: displayName || t("residentCall.defaultResidentName") }),
      }).unwrap()
      setActiveCall({
        conversationId: String(resp.conversationId),
        status: resp.status || "initiated",
        callStatus: resp.callStatus,
        callType: resp.callType,
        onboardingDay: resp.onboardingDay ?? null,
        onboardingJourneyComplete: resp.onboardingJourneyComplete,
        onboardingSessionsCompleted: resp.onboardingSessionsCompleted,
        onboardingCurrentStageDay: resp.onboardingCurrentStageDay,
        onboardingTotalDays: resp.onboardingTotalDays,
        isOnboardingCall: resp.isOnboardingCall,
      })
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
      setCallError(typeof msg === "string" ? msg : t("residentCall.initiateError"))
    }
  }, [apiClient?.id, callNotesDraft, canCallNow, displayName, initiateCall, isInitiatingCall, t])

  useEffect(() => {
    if (loadingClient || !apiClient?.id || !canCallNow || activeCall || isInitiatingCall || autoCallAttempted.current) return
    autoCallAttempted.current = true
    void onCallNow()
  }, [activeCall, apiClient?.id, canCallNow, isInitiatingCall, loadingClient, onCallNow])

  const showAutoInitiating = !activeCall && (loadingClient || isInitiatingCall || (hasAutoCalled && !callError))

  const onEndLiveCall = async () => {
    if (!activeCall?.conversationId || isEndingCall) return
    setCallError("")
    try {
      await endCall({ conversationId: activeCall.conversationId, outcome: "answered", notes: "Call ended from resident page" }).unwrap()
      setActiveCall((prev) => (prev ? { ...prev, status: "completed" } : prev))
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
      setCallError(typeof msg === "string" ? msg : t("residentCall.endError"))
    }
  }

  const statusMessage = callStatusMessage(
    t,
    effectiveCallStatus,
    liveCallStatus?.data?.callOutcome,
    displayName,
    isLiveCall,
  )

  const durationSuffix = liveCallStatus?.data?.startTime
    ? formatLiveCallDuration(
        t,
        liveCallStatus.data.startTime,
        isLiveCall ? "in-progress" : effectiveCallStatus,
        liveCallStatus.data.duration,
      )
    : ""

  if (!canCallNow) {
    return (
      <div style={{ padding: "2rem", color: "var(--va-slate-600)" }}>
        <button type="button" className="va-btn-ghost" onClick={() => navigate(`/residents/${residentId || ""}`)}>
          <ChevronLeftIcon size={16} />
          {t("residentCall.back")}
        </button>
        <p style={{ marginTop: "1rem" }}>{t("settings.adminOnlyCalls")}</p>
      </div>
    )
  }

  return (
    <div data-testid="resident-call-page" style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: "1rem" }}>
      <button type="button" className="va-btn-ghost" onClick={() => navigate(`/residents/${residentId || ""}`)}>
        <ChevronLeftIcon size={16} />
        {t("residentCall.backToResident")}
      </button>
      <div className="va-card va-card-pad">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <h1 className="va-page-title" style={{ marginBottom: 0 }}>
              {t("residentCall.liveCallTitle")}
            </h1>
            <p style={{ marginTop: 4, fontSize: "0.85rem", color: "var(--va-slate-500)" }}>
              {loadingClient ? t("residentCall.loadingResident") : t("residentCall.residentLabel", { name: displayName })}
            </p>
          </div>
          {activeCall ? (
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                padding: "0.2rem 0.55rem",
                borderRadius: 999,
                background: callStatusTone(isLiveCall ? "in-progress" : effectiveCallStatus).bg,
                color: callStatusTone(isLiveCall ? "in-progress" : effectiveCallStatus).fg,
              }}
            >
              {(isLiveCall ? "in-progress" : effectiveCallStatus).toUpperCase()}
            </span>
          ) : null}
        </div>

        {!activeCall ? (
          <div style={{ marginTop: "0.75rem", display: "grid", gap: 10 }}>
            {showAutoInitiating ? (
              <p data-testid="resident-call-initiating" style={{ margin: 0, fontSize: "0.85rem", color: "var(--va-slate-600)" }}>
                {loadingClient ? t("residentCall.loadingResident") : t("residentCall.calling", { name: displayName })}
              </p>
            ) : (
              <>
                <AuthTextField
                  label={t("residentCall.callNotesLabel")}
                  value={callNotesDraft}
                  onChange={(e) => setCallNotesDraft(e.target.value)}
                  placeholder={t("residentCall.callNotesPlaceholder")}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="va-btn-primary"
                    data-testid="resident-call-workspace-submit"
                    disabled={isInitiatingCall || !apiClient?.id}
                    onClick={() => void onCallNow()}
                  >
                    {isInitiatingCall ? t("residentCall.callingButton") : t("residentCall.callNow")}
                  </button>
                  <span style={{ fontSize: "0.75rem", color: "var(--va-slate-500)" }}>{t("residentCall.liveStatusHint")}</span>
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ marginTop: "0.75rem", display: "grid", gap: 10 }}>
            {!liveOnboarding?.journeyComplete ? (
              <div
                style={{
                  borderRadius: "0.65rem",
                  border: "1px solid var(--va-amber-200)",
                  background: "var(--va-amber-50)",
                  padding: "0.55rem 0.65rem",
                }}
              >
                <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 600, color: "var(--va-amber-800)" }}>
                  {t("residentCall.onboardingProgressTitle")}
                </p>
                <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "var(--va-amber-800)" }}>
                  {t("residentCall.onboardingProgressLine", {
                    completed: liveSessionsCompleted,
                    total: liveOnboardingTotalDays,
                    thisCall:
                      liveIsOnboardingCall && liveOnboardingDay != null
                        ? t("residentCall.thisCallDay", { day: liveOnboardingDay })
                        : "",
                    nextDay:
                      !liveIsOnboardingCall && liveCurrentStageDay != null
                        ? t("residentCall.nextDay", { day: liveCurrentStageDay })
                        : "",
                  })}
                </p>
              </div>
            ) : null}

            <p style={{ margin: 0, fontSize: "0.72rem" }}>
              <Link to={`/residents/${residentId ?? ""}#voice-onboarding`} style={{ color: "#2563eb" }}>
                {t("residentCall.fullJourneyLink")}
              </Link>
            </p>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--va-slate-600)" }}>
                {statusMessage}
                {durationSuffix}
                {liveCallFetching ? t("residentCall.updating") : ""}
                {liveCallStatusError ? t("residentCall.statusUnavailable") : ""}
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  className="va-btn-secondary"
                  onClick={() => {
                    setActiveCall(null)
                    setHasAutoCalled(false)
                  }}
                >
                  {t("residentCall.dismiss")}
                </button>
                {isLiveCall ? (
                  <button
                    type="button"
                    className="va-btn-primary"
                    style={{ background: "var(--va-red-600)" }}
                    onClick={() => void onEndLiveCall()}
                    disabled={isEndingCall}
                  >
                    {isEndingCall ? t("residentCall.ending") : t("residentCall.endCall")}
                  </button>
                ) : null}
              </div>
            </div>

            <div
              style={{
                maxHeight: 420,
                overflow: "auto",
                border: "1px solid var(--va-slate-200)",
                borderRadius: "0.75rem",
                padding: "0.65rem",
              }}
            >
              {liveCallMessages.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--va-slate-500)" }}>
                  {t("residentCall.waitingTranscript")}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {liveCallMessages.map((m, idx) => {
                    const fromClient = m.role === "client"
                    return (
                      <div
                        key={m.id ?? m._id ?? `live-msg-${idx}`}
                        style={{
                          maxWidth: "88%",
                          alignSelf: fromClient ? "flex-start" : "flex-end",
                          background: fromClient ? "#dbeafe" : "#d1fae5",
                          border: fromClient ? "1px solid #bfdbfe" : "1px solid #a7f3d0",
                          color: fromClient ? "#1e3a8a" : "#065f46",
                          borderRadius: fromClient ? "14px 14px 14px 6px" : "14px 14px 6px 14px",
                          padding: "0.5rem 0.7rem",
                          fontSize: "0.8rem",
                          lineHeight: 1.4,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {m.content}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        {callError ? <p style={{ marginTop: 8, fontSize: "0.8rem", color: "var(--va-red-600)" }}>{callError}</p> : null}
      </div>
    </div>
  )
}

function formatDurationSeconds(sec?: number | null): string {
  if (sec == null || Number.isNaN(sec)) return "—"
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}m ${s}s`
}

function callStatusTone(status: string): { bg: string; fg: string } {
  if (status === "in-progress") return { bg: "var(--va-emerald-100)", fg: "var(--va-emerald-700)" }
  if (status === "failed") return { bg: "var(--va-red-100)", fg: "var(--va-red-700)" }
  if (status === "completed") return { bg: "var(--va-blue-100, #dbeafe)", fg: "var(--va-blue-700, #1d4ed8)" }
  return { bg: "var(--va-amber-100)", fg: "var(--va-amber-700)" }
}

function callStatusMessage(
  t: TFunction,
  status: string,
  outcome: string | undefined,
  residentName: string,
  isLiveCall?: boolean,
): string {
  if (outcome === "voicemail") return t("residentCall.statusVoicemail")
  if (outcome === "no_answer") return t("residentCall.statusNoAnswer")
  if (outcome === "busy") return t("residentCall.statusBusy")
  if (isLiveCall) return t("residentCall.statusConnected", { name: residentName })
  if (status === "initiated") return t("residentCall.statusSettingUp")
  if (status === "in-progress") return t("residentCall.statusConnected", { name: residentName })
  if (status === "completed") return outcome === "answered" ? t("residentCall.statusCompleted") : t("residentCall.statusEnded")
  if (status === "failed") return t("residentCall.statusFailed")
  return t("residentCall.statusUnknown")
}

function formatLiveCallDuration(
  t: TFunction,
  startIso: string,
  status: string,
  apiDuration: number | undefined,
): string {
  if (status === "completed" || status === "failed") {
    return ` · ${t("residentCall.durationPrefix")} ${formatDurationSeconds(apiDuration)}`
  }
  const start = new Date(startIso)
  if (Number.isNaN(start.getTime())) return ` · ${t("residentCall.durationUnavailable")}`
  const sec = Math.max(0, Math.round((Date.now() - start.getTime()) / 1000))
  return ` · ${t("residentCall.durationPrefix")} ${formatDurationSeconds(sec)}`
}
