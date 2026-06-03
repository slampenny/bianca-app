import type { CSSProperties, FormEvent, ReactNode } from "react"
import { skipToken } from "@reduxjs/toolkit/query"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router-dom"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ChartFigure } from "../components/ChartFigure"
import { summarizeChartSeries } from "../lib/chartSummary"
import { clientInitialsFromClient } from "../lib/clientDisplayName"
import { apiRecordId, mapClientToResident, splitName } from "../lib/liveData"
import { formatStoredAlertMessage } from "../lib/storedAlertMessage"
import { intervalsForDraft, weekdayShortLabel } from "../lib/scheduleDraft"
import { LANGUAGE_OPTIONS } from "../lib/languages"
import { useGetAllAlertsQuery, liveAlertsQueryOptions } from "../services/api/alertApi"
import {
  useDeleteClientMutation,
  useGetClientQuery,
  useGetCallsByClientQuery,
  usePatchClientMutation,
  useSendFamilyDigestEmailVerificationMutation,
  useUploadClientAvatarMutation,
} from "../services/api/clientApi"
import { useGetSentimentSummaryQuery, useGetSentimentTrendQuery } from "../services/api/sentimentApi"
import { useGetMedicalAnalysisResultsQuery, useGetMedicalAnalysisSummaryQuery } from "../services/api/medicalAnalysisApi"
import { useCreateScheduleForClientMutation, useDeleteScheduleMutation, useUpdateScheduleMutation } from "../services/api/scheduleApi"
import type { Client, SentimentSummary, SentimentTrendPoint } from "../services/api/api.types"
import { Button, Modal, Tabs, TabsContent, TabsList, TabsTrigger } from "@bianca-app/ui"
import { AuthSelectField } from "../components/AuthSelectField"
import { AuthTextAreaField } from "../components/AuthTextAreaField"
import { AuthTextField } from "../components/AuthTextField"
import { ConfirmModal } from "../components/ConfirmModal"
import { AvatarPicker } from "../components/AvatarPicker"
import { NewScheduleFormFields } from "../components/NewScheduleFormFields"
import { ClientOnboardingSection } from "../components/ClientOnboardingSection"
import { FraudAbuseAnalysisPanel } from "../components/FraudAbuseAnalysisPanel"
import { MedicalAnalysisReportPanel } from "../components/MedicalAnalysisReportPanel"
import { canAddResidents } from "../lib/roleAccess"
import { getCurrentUser } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import { CheckIcon, ChevronLeftIcon, ClockIcon, MessageIcon, PhoneIcon } from "../icons"

function formatDurationSeconds(sec?: number | null): string {
  if (sec == null || Number.isNaN(sec)) return "—"
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}m ${s}s`
}

function formatConsentTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString().slice(0, 10)
}

type SentimentTimeRange = "lastCall" | "month" | "lifetime"
type AnalysisTab = "medical" | "sentiment" | "security"
type MainTab = "overview" | "analysis" | "conversations"

export function ResidentDetailPage() {
  const { t, i18n } = useTranslation()
  const { residentId } = useParams()
  const navigate = useNavigate()
  const [consentOpen, setConsentOpen] = useState(false)
  const [sentimentTimeRange, setSentimentTimeRange] = useState<SentimentTimeRange>("lastCall")
  const [mainTab, setMainTab] = useState<MainTab>("overview")
  const [analysisTab, setAnalysisTab] = useState<AnalysisTab>("sentiment")
  const [editing, setEditing] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [residentFirstName, setResidentFirstName] = useState("")
  const [residentLastName, setResidentLastName] = useState("")
  const [residentPreferredName, setResidentPreferredName] = useState("")
  const [residentAge, setResidentAge] = useState("")
  const [residentNotes, setResidentNotes] = useState("")
  const [residentEmail, setResidentEmail] = useState("")
  const [residentPhone, setResidentPhone] = useState("")
  const [residentLanguage, setResidentLanguage] = useState("en")
  const [residentRoom, setResidentRoom] = useState("")
  const [residentMoveInDate, setResidentMoveInDate] = useState("")
  const [emergencyName, setEmergencyName] = useState("")
  const [emergencyRelationship, setEmergencyRelationship] = useState("")
  const [emergencyPhone, setEmergencyPhone] = useState("")
  const [emergencyEmail, setEmergencyEmail] = useState("")
  const [familyDigestEmailEnabled, setFamilyDigestEmailEnabled] = useState(false)
  const [residentAvatarFile, setResidentAvatarFile] = useState<File | null>(null)
  const [scheduleError, setScheduleError] = useState("")
  const [scheduleNotice, setScheduleNotice] = useState("")
  const [newScheduleFrequency, setNewScheduleFrequency] = useState<"daily" | "weekly" | "monthly">("weekly")
  const [newScheduleTime, setNewScheduleTime] = useState("09:00")
  const [newScheduleWeeklyDays, setNewScheduleWeeklyDays] = useState<number[]>([1, 3, 5])
  const [newScheduleWeeklyWeeks, setNewScheduleWeeklyWeeks] = useState(1)
  const [newScheduleMonthlyDaysRaw, setNewScheduleMonthlyDaysRaw] = useState("1,15")
  const [newScheduleActive, setNewScheduleActive] = useState(true)
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null)
  const [editScheduleFrequency, setEditScheduleFrequency] = useState<"daily" | "weekly" | "monthly">("weekly")
  const [editScheduleTime, setEditScheduleTime] = useState("09:00")
  const [editScheduleWeeklyDays, setEditScheduleWeeklyDays] = useState<number[]>([])
  const [editScheduleWeeklyWeeks, setEditScheduleWeeklyWeeks] = useState(1)
  const [editScheduleMonthlyDaysRaw, setEditScheduleMonthlyDaysRaw] = useState("")
  const [editScheduleActive, setEditScheduleActive] = useState(true)
  const [expandedConversationId, setExpandedConversationId] = useState<string | null>(null)
  const [confirmDeleteResidentOpen, setConfirmDeleteResidentOpen] = useState(false)
  const [scheduleDeleteConfirmId, setScheduleDeleteConfirmId] = useState<string | null>(null)
  const [familyDigestVerificationNotice, setFamilyDigestVerificationNotice] = useState("")
  const [familyDigestVerificationError, setFamilyDigestVerificationError] = useState("")

  const authed = useAppSelector((s) => !!s.auth.tokens)
  const user = useAppSelector(getCurrentUser)
  const canManageResidents = canAddResidents(user?.role)

  const {
    data: apiClient,
    isLoading: clientLoading,
    isError: clientError,
    error: clientFetchError,
    refetch,
  } = useGetClientQuery(residentId ? { id: residentId } : skipToken)
  const [patchClient, { isLoading: savingResident }] = usePatchClientMutation()
  const [deleteClient, { isLoading: deletingResident }] = useDeleteClientMutation()
  const [uploadClientAvatar, { isLoading: uploadingAvatar }] = useUploadClientAvatarMutation()
  const [createScheduleForClient, { isLoading: creatingSchedule }] = useCreateScheduleForClientMutation()
  const [updateSchedule, { isLoading: updatingSchedule }] = useUpdateScheduleMutation()
  const [deleteSchedule, { isLoading: deletingSchedule }] = useDeleteScheduleMutation()
  const [sendFamilyDigestVerification, { isLoading: sendingFamilyDigestVerification }] =
    useSendFamilyDigestEmailVerificationMutation()

  // Call-first list (GET /clients/:id/calls) so order matches billable Call.startTime; only fetch on Conversations tab.
  const { data: convPages, isLoading: convLoading } = useGetCallsByClientQuery(
    apiClient?.id ? { clientId: apiClient.id, limit: 20 } : skipToken,
    { skip: !apiClient?.id || mainTab !== "conversations" },
  )

  const { data: apiAlerts } = useGetAllAlertsQuery(undefined, {
    ...liveAlertsQueryOptions,
    skip: !authed,
  })

  const clientIdForApi = apiClient?.id ?? ""
  const {
    data: sentimentTrend,
    isLoading: sentimentTrendLoading,
    isError: sentimentTrendError,
  } = useGetSentimentTrendQuery(
    { clientId: clientIdForApi, timeRange: sentimentTimeRange },
    { skip: !clientIdForApi },
  )
  const {
    data: sentimentSummary,
    isLoading: sentimentSummaryLoading,
    isError: sentimentSummaryError,
  } = useGetSentimentSummaryQuery({ clientId: clientIdForApi }, { skip: !clientIdForApi })
  const {
    data: medicalSummary,
    isLoading: medicalSummaryLoading,
    isError: medicalSummaryError,
  } = useGetMedicalAnalysisSummaryQuery(clientIdForApi ? { clientId: clientIdForApi } : skipToken)
  const {
    data: medicalResults,
    isLoading: medicalResultsLoading,
    isError: medicalResultsError,
  } = useGetMedicalAnalysisResultsQuery(clientIdForApi ? { clientId: clientIdForApi, limit: 1 } : skipToken)

  const resident = useMemo(() => (apiClient ? mapClientToResident(apiClient) : null), [apiClient])
  const familyDigestEmailVerified = useMemo(() => {
    const contactEmail = apiClient?.emergencyContact?.email?.trim().toLowerCase()
    const fd = apiClient?.emergencyContact?.familyDigestEmail
    if (!contactEmail || !fd?.verifiedAt || !fd.verifiedEmail) return false
    return fd.verifiedEmail.trim().toLowerCase() === contactEmail
  }, [apiClient])
  const residentMissing =
    !!clientFetchError &&
    typeof clientFetchError === "object" &&
    "status" in clientFetchError &&
    (clientFetchError as { status?: number }).status === 404

  useEffect(() => {
    if (!residentMissing) return
    navigate("/residents", { replace: true })
  }, [residentMissing, navigate])

  useEffect(() => {
    if (!apiClient) return
    const fromApi = apiClient.firstName != null && String(apiClient.firstName).trim() !== ""
    const parts = fromApi
      ? { firstName: String(apiClient.firstName).trim(), lastName: (apiClient.lastName && String(apiClient.lastName).trim()) || "" }
      : splitName(apiClient.name)
    setResidentFirstName(parts.firstName)
    setResidentLastName(parts.lastName)
    setResidentPreferredName(apiClient.preferredName || "")
    setResidentAge(apiClient.age == null ? "" : String(apiClient.age))
    setResidentNotes(apiClient.notes || "")
    setResidentEmail(apiClient.email || "")
    setResidentPhone(apiClient.phone || "")
    setResidentLanguage(apiClient.preferredLanguage || "en")
    setResidentRoom(apiClient.room || "")
    setResidentMoveInDate(toDateInputValue(apiClient.moveInDate))
    setEmergencyName(apiClient.emergencyContact?.name || "")
    setEmergencyRelationship(apiClient.emergencyContact?.relationship || "")
    setEmergencyPhone(apiClient.emergencyContact?.phone || "")
    setEmergencyEmail(apiClient.emergencyContact?.email || "")
    setFamilyDigestEmailEnabled(apiClient.emergencyContact?.familyDigestEmail?.enabled === true)
  }, [apiClient])

  const clientAlert = useMemo(
    () => (apiAlerts ?? []).find((a) => String(a.relatedClient) === residentId),
    [apiAlerts, residentId],
  )
  const alertLinkId = clientAlert ? apiRecordId(clientAlert as { id?: string; _id?: string }) : ""
  const traceabilityAlerts = useMemo(() => {
    const rows = (apiAlerts ?? []).filter((a) => String(a.relatedClient ?? "") === String(residentId ?? ""))
    return rows
      .map((a) => {
        const alertId = apiRecordId(a as { id?: string; _id?: string })
        if (!alertId) return null
        const convIdRaw = a.relatedConversation ?? a.evidence?.conversationId
        const conversationId = convIdRaw ? String(convIdRaw) : ""
        const messageIds = new Set((a.evidence?.messageIds ?? []).map((id) => String(id)))
        const snippet = String(a.evidence?.snippet ?? "").trim()
        return { alertId, conversationId, messageIds, snippet }
      })
      .filter((x): x is { alertId: string; conversationId: string; messageIds: Set<string>; snippet: string } => !!x)
  }, [apiAlerts, residentId])
  const residentAlerts = useMemo(
    () => (apiAlerts ?? []).filter((a) => String(a.relatedClient ?? "") === String(residentId ?? "")),
    [apiAlerts, residentId],
  )
  const unresolvedResidentAlerts = useMemo(
    () => residentAlerts.filter((a) => !a.resolvedAt),
    [residentAlerts],
  )
  const criticalResidentAlerts = useMemo(
    () => unresolvedResidentAlerts.filter((a) => a.importance === "high" || a.importance === "urgent"),
    [unresolvedResidentAlerts],
  )

  const atRisk = resident?.status === "at_risk"
  const canCallNow = canAddResidents(user?.role)

  const sentimentChartData = useMemo(() => {
    const pts = sentimentTrend?.dataPoints ?? []
    return pts
      .map((p, i) => {
        const score = p.sentiment?.sentimentScore
        const t = p.date ? new Date(p.date) : null
        const dateLabel =
          t && !Number.isNaN(t.getTime())
            ? t.toLocaleDateString(undefined, { month: "short", day: "numeric" })
            : `Call ${i + 1}`
        return { idx: i + 1, dateLabel, score: typeof score === "number" ? score : null }
      })
      .filter((row): row is { idx: number; dateLabel: string; score: number } => row.score !== null)
  }, [sentimentTrend?.dataPoints])

  const sentimentChartSummary = useMemo(
    () =>
      summarizeChartSeries(
        sentimentChartData,
        "dateLabel",
        "score",
        (date, score) =>
          t("residentDetail.sentimentChartSummaryItem", {
            date,
            score: `${Number(score) >= 0 ? "+" : ""}${Number(score).toFixed(2)}`,
          }),
        t("residentDetail.sentimentChartSummaryEmpty"),
      ),
    [sentimentChartData, t],
  )

  const conversationRows = useMemo(() => {
    const rows = convPages?.results ?? []
    return [...rows]
      .sort((a, b) => {
        const aWithFallback = a as { callStartTime?: string | null; createdAt?: string | null }
        const bWithFallback = b as { callStartTime?: string | null; createdAt?: string | null }
        const ta = new Date(a.startTime ?? aWithFallback.callStartTime ?? aWithFallback.createdAt ?? 0).getTime()
        const tb = new Date(b.startTime ?? bWithFallback.callStartTime ?? bWithFallback.createdAt ?? 0).getTime()
        return tb - ta
      })
      .map((c, idx) => {
        const withFallback = c as {
          callStartTime?: string | null
          createdAt?: string | null
          callDuration?: number | null
        }
        const start = c.startTime ?? withFallback.callStartTime ?? withFallback.createdAt
        const startedAt = start ? new Date(start) : null
        const hasValidTime = !!startedAt && !Number.isNaN(startedAt.getTime())
        const rawDuration = c.duration ?? withFallback.callDuration
        const durationLabel = formatDurationSeconds(rawDuration)
        const displayOutcome = outcomeLabel(c.callOutcome ?? c.status)
        const outcome = c.callOutcome
        const id = String(c.id ?? c.callSid ?? `conv-${idx}`)
        const dur =
          durationLabel === "—" ? t("residentDetail.durationUnavailable") : durationLabel
        return {
          id,
          outcome,
          outcomeLabel: displayOutcome,
          durationLabel: dur,
          summary:
            outcome === "answered"
              ? t("residentDetail.callAnswered", { duration: dur })
              : t("residentDetail.callOutcome", { outcome: displayOutcome, duration: dur }),
          description:
            outcome === "answered"
              ? t("residentDetail.callAnswered", { duration: dur })
              : t("residentDetail.callOutcome", { outcome: displayOutcome, duration: dur }),
          date: hasValidTime
            ? startedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
            : t("residentDetail.dateUnavailable"),
          time: hasValidTime
            ? startedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
            : t("residentDetail.timeUnavailable"),
          dateShort: hasValidTime
            ? startedAt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
            : t("residentDetail.dateUnavailable"),
          messageCount: Array.isArray(c.messages) ? c.messages.length : 0,
          messages: c.messages ?? [],
        }
      })
  }, [convPages?.results, t])

  const residentSchedules = useMemo(() => {
    const list = (apiClient?.schedules ?? []).filter((s) => !!s.id && s.isActive !== false)
    return [...list].sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")))
  }, [apiClient?.schedules])
  /** UI exposes a single schedule; backend may still store more than one. */
  const primarySchedule = residentSchedules[0]

  if (clientLoading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--va-slate-500)" }}>{t("residentDetail.loading")}</div>
    )
  }

  if (clientError || !resident || !apiClient) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
        <p style={{ color: "var(--va-slate-500)" }}>{t("residentDetail.notFound")}</p>
        <p style={{ color: "var(--va-slate-400)", fontSize: "0.875rem", marginTop: 6 }}>{t("residentDetail.notFoundHint")}</p>
        <button type="button" className="va-btn-ghost" style={{ marginTop: "1rem" }} onClick={() => navigate("/residents")}>
          {t("residentDetail.back")}
        </button>
        <button type="button" className="va-btn-primary" style={{ marginTop: "1rem", display: "block", margin: "1rem auto 0" }} onClick={() => void refetch()}>
          {t("common.retry")}
        </button>
      </div>
    )
  }

  const displayName = resident.displayName
  const initials = clientInitialsFromClient({
    preferredName: apiClient.preferredName,
    firstName: resident.firstName,
    lastName: resident.lastName,
  })

  /** Same request body as the add-schedule card. Returns false if weekly/monthly has no days (message set). Throws on API error. */
  const createScheduleFromAddForm = async (noticeText = t("residentDetail.scheduleAdded")): Promise<boolean> => {
    if (!apiClient.id) return false
    setScheduleError("")
    setScheduleNotice("")
    const intervals = intervalsForDraft(
      newScheduleFrequency,
      newScheduleWeeklyDays,
      newScheduleWeeklyWeeks,
      newScheduleMonthlyDaysRaw,
    )
    if (newScheduleFrequency !== "daily" && intervals.length === 0) {
      setScheduleError(t("residentDetail.scheduleIntervalError"))
      return false
    }
    await createScheduleForClient({
      clientId: String(apiClient.id),
      body: {
        frequency: newScheduleFrequency,
        intervals,
        time: newScheduleTime,
        isActive: newScheduleActive,
      },
    }).unwrap()
    setScheduleNotice(noticeText)
    return true
  }

  const handleSendFamilyDigestVerification = async () => {
    if (!apiClient?.id) return
    setFamilyDigestVerificationNotice("")
    setFamilyDigestVerificationError("")
    try {
      const res = await sendFamilyDigestVerification({ clientId: apiClient.id }).unwrap()
      setFamilyDigestVerificationNotice(res.message || t("residentDetail.familyDigestEmailVerificationSent"))
    } catch {
      setFamilyDigestVerificationError(t("residentDetail.familyDigestEmailVerificationFailed"))
    }
  }

  const onSaveResident = async (e: FormEvent) => {
    e.preventDefault()
    if (!apiClient?.id) return
    setSaveError("")
    try {
      await patchClient({
        clientId: apiClient.id,
        body: {
          firstName: residentFirstName.trim(),
          lastName: residentLastName.trim(),
          preferredName: residentPreferredName.trim() || undefined,
          age: residentAge.trim() ? Number(residentAge) : undefined,
          notes: residentNotes.trim() || undefined,
          email: residentEmail.trim(),
          phone: residentPhone.trim(),
          preferredLanguage: residentLanguage || "en",
          room: residentRoom.trim() || "",
          moveInDate: residentMoveInDate || undefined,
          emergencyContact: {
            name: emergencyName.trim(),
            relationship: emergencyRelationship.trim(),
            phone: emergencyPhone.trim(),
            email: emergencyEmail.trim().toLowerCase(),
            familyDigestEmail: { enabled: familyDigestEmailEnabled },
          },
        },
      }).unwrap()
      if (residentAvatarFile) {
        await uploadClientAvatar({ clientId: apiClient.id, file: residentAvatarFile }).unwrap()
        setResidentAvatarFile(null)
      }
      if (canManageResidents && !primarySchedule) {
        try {
          const created = await createScheduleFromAddForm(t("residentDetail.residentSavedScheduleAdded"))
          if (created) setMainTab("overview")
        } catch (schedErr: unknown) {
          const smsg = (schedErr as { data?: { message?: string } })?.data?.message
          setScheduleError(
            typeof smsg === "string" ? smsg : t("residentDetail.createScheduleOnSaveError"),
          )
        }
      }
      setEditing(false)
      await refetch()
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
      setSaveError(typeof msg === "string" ? msg : t("residentDetail.saveResidentError"))
    }
  }

  const performDeleteResident = async () => {
    if (!apiClient?.id || deletingResident) return
    try {
      await deleteClient({ clientId: apiClient.id }).unwrap()
      setConfirmDeleteResidentOpen(false)
      navigate("/residents", { replace: true })
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
      setSaveError(typeof msg === "string" ? msg : t("residentDetail.deleteResidentError"))
    }
  }

  const toggleWeeklyDay = (day: number, mode: "new" | "edit") => {
    const setter = mode === "new" ? setNewScheduleWeeklyDays : setEditScheduleWeeklyDays
    const src = mode === "new" ? newScheduleWeeklyDays : editScheduleWeeklyDays
    const next = src.includes(day) ? src.filter((d) => d !== day) : [...src, day]
    setter(next.sort((a, b) => a - b))
  }

  const startEditSchedule = (scheduleId: string) => {
    const row = residentSchedules.find((s) => String(s.id) === scheduleId)
    if (!row) return
    setEditingScheduleId(scheduleId)
    setEditScheduleFrequency(row.frequency)
    setEditScheduleTime(row.time || "09:00")
    setEditScheduleActive(row.isActive !== false)
    if (row.frequency === "weekly") {
      const days = (row.intervals ?? []).map((i) => Number(i.day)).filter((d) => Number.isFinite(d))
      setEditScheduleWeeklyDays([...new Set(days)].sort((a, b) => a - b))
      setEditScheduleWeeklyWeeks(Math.max(1, Number(row.intervals?.[0]?.weeks ?? 1)))
      setEditScheduleMonthlyDaysRaw("")
    } else if (row.frequency === "monthly") {
      const days = (row.intervals ?? []).map((i) => Number(i.day)).filter((d) => Number.isFinite(d))
      setEditScheduleMonthlyDaysRaw([...new Set(days)].sort((a, b) => a - b).join(","))
      setEditScheduleWeeklyDays([])
      setEditScheduleWeeklyWeeks(1)
    } else {
      setEditScheduleWeeklyDays([])
      setEditScheduleWeeklyWeeks(1)
      setEditScheduleMonthlyDaysRaw("")
    }
  }

  const onAddSchedule = async () => {
    if (!apiClient.id) return
    try {
      const created = await createScheduleFromAddForm()
      if (created) await refetch()
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
      setScheduleError(typeof msg === "string" ? msg : t("residentDetail.scheduleAddError"))
    }
  }

  const onSaveSchedule = async () => {
    if (!editingScheduleId) return
    setScheduleError("")
    setScheduleNotice("")
    const intervals = intervalsForDraft(
      editScheduleFrequency,
      editScheduleWeeklyDays,
      editScheduleWeeklyWeeks,
      editScheduleMonthlyDaysRaw,
    )
    if (editScheduleFrequency !== "daily" && intervals.length === 0) {
      setScheduleError(t("residentDetail.scheduleIntervalError"))
      return
    }
    try {
      await updateSchedule({
        scheduleId: editingScheduleId,
        body: {
          frequency: editScheduleFrequency,
          intervals,
          time: editScheduleTime,
          isActive: editScheduleActive,
        },
      }).unwrap()
      setEditingScheduleId(null)
      setScheduleNotice(t("residentDetail.scheduleUpdated"))
      await refetch()
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
      setScheduleError(typeof msg === "string" ? msg : t("residentDetail.scheduleUpdateError"))
    }
  }

  const performDeleteSchedule = async (scheduleId: string) => {
    setScheduleError("")
    setScheduleNotice("")
    try {
      await deleteSchedule({ scheduleId }).unwrap()
      if (editingScheduleId === scheduleId) setEditingScheduleId(null)
      setScheduleNotice(t("residentDetail.scheduleDeleted"))
      setScheduleDeleteConfirmId(null)
      await refetch()
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status === 401 || status === 403) {
        const schedule = residentSchedules.find((s) => String(s.id) === scheduleId)
        if (!schedule) {
          setScheduleError(t("residentDetail.scheduleDeleteError"))
          return
        }
        try {
          await updateSchedule({
            scheduleId,
            body: {
              frequency: schedule.frequency,
              intervals: schedule.intervals,
              time: schedule.time,
              isActive: false,
            },
          }).unwrap()
          if (editingScheduleId === scheduleId) setEditingScheduleId(null)
          setScheduleNotice(t("residentDetail.scheduleDeleted"))
          setScheduleDeleteConfirmId(null)
          await refetch()
          return
        } catch {
          setScheduleError(t("residentDetail.scheduleDeleteError"))
          return
        }
      }
      const msg = (err as { data?: { message?: string } })?.data?.message
      setScheduleError(typeof msg === "string" ? msg : t("residentDetail.scheduleDeleteError"))
    }
  }

  return (
    <div data-testid="resident-detail-page" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 900, margin: "0 auto" }}>
      <button type="button" className="va-btn-ghost" data-testid="resident-detail-back" onClick={() => navigate("/residents")}>
        <ChevronLeftIcon size={16} />
        {t("residentDetail.back")}
      </button>
      {canManageResidents ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <button
            type="button"
            className="va-btn-secondary"
            onClick={() => {
              if (!editing) setMainTab("overview")
              setEditing((v) => !v)
            }}
            data-testid="resident-edit-toggle"
          >
            {editing ? t("residentDetail.cancelEdit") : t("residentDetail.editResident")}
          </button>
          <button
            type="button"
            className="va-btn-ghost"
            onClick={() => setConfirmDeleteResidentOpen(true)}
            disabled={deletingResident}
            style={{ color: "var(--va-red-600)", borderColor: "var(--va-red-200)" }}
            data-testid="resident-delete"
          >
            {deletingResident ? t("residentDetail.deleting") : t("residentDetail.deleteResident")}
          </button>
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(37, 99, 235, 0.12)",
            color: "#1d4ed8",
            fontSize: "1.25rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {apiClient.avatar ? (
            <img
              src={apiClient.avatar}
              alt={t("residentDetail.avatarAlt", { name: displayName })}
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
              referrerPolicy="no-referrer"
            />
          ) : (
            initials
          )}
        </div>
        <div>
          <h1 className="va-page-title" style={{ fontSize: "1.75rem" }}>
            {displayName}
          </h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: 6, alignItems: "center" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--va-slate-500)" }}>{t("residentDetail.room", { room: resident.room })}</span>
            <StatusPill status={resident.status} />
            <span style={{ fontSize: "0.875rem", color: "var(--va-slate-500)" }}>
              {resident.age > 0 ? t("residentDetail.age", { age: resident.age }) : t("residentDetail.ageUnknown")}
            </span>
          </div>
        </div>
      </div>

      <Tabs value={mainTab} onValueChange={(value) => setMainTab(value as MainTab)}>
        <TabsList aria-label={t("residentDetail.sectionsAria")} data-testid="resident-main-tablist">
          {(
            [
              { id: "overview" as const, label: t("residentDetail.tabOverview") },
              { id: "analysis" as const, label: t("residentDetail.tabAnalysis") },
              { id: "conversations" as const, label: t("residentDetail.tabConversations") },
            ] as const
          ).map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} data-testid={`resident-main-tab-${tab.id}`}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

      <TabsContent value="overview">
        <>
          {canManageResidents && editing ? (
        <div className="va-card va-card-pad">
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>{t("residentDetail.editTitle")}</h2>
          <form onSubmit={(e) => void onSaveResident(e)} style={{ display: "grid", gap: "0.75rem" }}>
            <AvatarPicker
              label={t("residentDetail.photoLabel")}
              initialsSource={residentPreferredName || residentFirstName || "?"}
              existingAvatarUrl={apiClient?.avatar}
              onPick={setResidentAvatarFile}
            />
            <AuthTextField
              label={t("residentDetail.firstName")}
              type="text"
              value={residentFirstName}
              onChange={(e) => setResidentFirstName(e.target.value)}
              required
              autoComplete="given-name"
            />
            <AuthTextField
              label={t("residentDetail.lastName")}
              type="text"
              value={residentLastName}
              onChange={(e) => setResidentLastName(e.target.value)}
              autoComplete="family-name"
            />
            <AuthTextField
              label={t("residentDetail.preferredName")}
              type="text"
              value={residentPreferredName}
              onChange={(e) => setResidentPreferredName(e.target.value)}
            />
            <AuthTextField
              label={t("residentDetail.ageLabel")}
              type="number"
              min={0}
              max={150}
              value={residentAge}
              onChange={(e) => setResidentAge(e.target.value)}
            />
            <AuthTextField
              label={t("residentDetail.labelEmail")}
              type="email"
              value={residentEmail}
              onChange={(e) => setResidentEmail(e.target.value)}
              required
            />
            <AuthTextField
              label={t("residentDetail.labelPhone")}
              type="tel"
              value={residentPhone}
              onChange={(e) => setResidentPhone(e.target.value)}
              required
            />
            <AuthSelectField
              label={t("residentDetail.preferredLanguageLabel")}
              value={residentLanguage}
              onChange={(e) => setResidentLanguage(e.target.value)}
            >
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </AuthSelectField>
            <AuthTextField
              label={t("residentDetail.roomField")}
              type="text"
              value={residentRoom}
              onChange={(e) => setResidentRoom(e.target.value)}
            />
            <AuthTextField
              label={t("residentDetail.labelMoveIn")}
              type="date"
              value={residentMoveInDate}
              onChange={(e) => setResidentMoveInDate(e.target.value)}
            />
            <AuthTextField
              label={t("residentDetail.emergencyName")}
              type="text"
              value={emergencyName}
              onChange={(e) => setEmergencyName(e.target.value)}
            />
            <AuthTextField
              label={t("residentDetail.emergencyRelationship")}
              type="text"
              value={emergencyRelationship}
              onChange={(e) => setEmergencyRelationship(e.target.value)}
            />
            <AuthTextField
              label={t("residentDetail.emergencyPhone")}
              type="tel"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
            />
            <AuthTextField
              label={t("residentDetail.emergencyEmail")}
              type="email"
              value={emergencyEmail}
              onChange={(e) => setEmergencyEmail(e.target.value)}
            />
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: "0.875rem",
                color: "var(--va-slate-700)",
              }}
            >
              <span style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <input
                  type="checkbox"
                  data-testid="resident-family-digest-email-enabled"
                  checked={familyDigestEmailEnabled}
                  onChange={(e) => setFamilyDigestEmailEnabled(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                {t("residentDetail.familyDigestEmailEnabled")}
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--va-slate-500)", lineHeight: 1.45 }}>
                {t("residentDetail.familyDigestEmailEnabledHelp")}
              </span>
            </label>
            {canManageResidents ? (
              <div
                data-testid="resident-family-digest-verification"
                style={{ display: "grid", gap: 8, fontSize: "0.8125rem", color: "var(--va-slate-700)" }}
              >
                <p style={{ margin: 0 }}>
                  {emergencyEmail.trim()
                    ? familyDigestEmailVerified
                      ? t("residentDetail.familyDigestEmailVerified")
                      : t("residentDetail.familyDigestEmailUnverified")
                    : t("residentDetail.familyDigestEmailNoAddress")}
                </p>
                {emergencyEmail.trim() && !familyDigestEmailVerified ? (
                  <button
                    type="button"
                    className="va-btn-secondary"
                    data-testid="resident-send-family-digest-verification"
                    disabled={sendingFamilyDigestVerification}
                    onClick={() => void handleSendFamilyDigestVerification()}
                  >
                    {sendingFamilyDigestVerification
                      ? t("residentDetail.familyDigestEmailSendingVerification")
                      : t("residentDetail.familyDigestEmailSendVerification")}
                  </button>
                ) : null}
                {familyDigestVerificationNotice ? (
                  <p data-testid="resident-family-digest-verification-success" style={{ margin: 0, color: "var(--va-emerald-700)" }}>
                    {familyDigestVerificationNotice}
                  </p>
                ) : null}
                {familyDigestVerificationError ? (
                  <p data-testid="resident-family-digest-verification-error" style={{ margin: 0, color: "var(--va-red-600)" }}>
                    {familyDigestVerificationError}
                  </p>
                ) : null}
              </div>
            ) : null}
            <AuthTextAreaField
              label={t("residentDetail.notes")}
              value={residentNotes}
              onChange={(e) => setResidentNotes(e.target.value)}
              rows={4}
              style={{ resize: "vertical" }}
            />
            {saveError ? (
              <div className="va-login-error" role="alert">
                {saveError}
              </div>
            ) : null}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button type="submit" className="va-btn-primary" disabled={savingResident || uploadingAvatar}>
                {savingResident || uploadingAvatar ? t("residentDetail.saving") : t("residentDetail.saveChanges")}
              </button>
              <button type="button" className="va-btn-secondary" onClick={() => setEditing(false)}>
                {t("residentDetail.cancel")}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {canCallNow ? (
        <div className="va-card va-card-pad" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>{t("residentDetail.liveCallTitle")}</h2>
            <p style={{ marginTop: 4, fontSize: "0.8125rem", color: "var(--va-slate-500)" }}>
              {t("residentDetail.liveCallBody")}
            </p>
          </div>
          <button
            type="button"
            className="va-btn-primary"
            data-testid="resident-call-now"
            onClick={() => navigate(`/residents/${residentId || ""}/call`)}
          >
            {t("residentDetail.callNow")}
          </button>
        </div>
      ) : null}

      {apiClient ? <ClientOnboardingSection clientId={apiRecordId(apiClient)} residentPathId={residentId || ""} /> : null}

      {canManageResidents ? (
        <div className="va-card va-card-pad" data-testid="resident-schedules-card">
          <div style={{ marginBottom: "0.9rem" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: "var(--va-navy)" }}>{t("residentDetail.scheduleTitle")}</h2>
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.825rem", color: "var(--va-slate-500)" }}>
              {t("residentDetail.scheduleSubtitle")}
            </p>
          </div>

          {!primarySchedule ? (
            <div style={{ border: "1px solid var(--va-slate-200)", borderRadius: 10, padding: "0.85rem", display: "grid", gap: 10, background: "var(--va-slate-50)" }}>
              <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--va-navy)" }}>{t("residentDetail.addScheduleTitle")}</h3>
              <NewScheduleFormFields
                testIdPrefix="resident-schedule-new"
                frequency={newScheduleFrequency}
                setFrequency={setNewScheduleFrequency}
                time={newScheduleTime}
                setTime={setNewScheduleTime}
                active={newScheduleActive}
                setActive={setNewScheduleActive}
                weeklyDays={newScheduleWeeklyDays}
                toggleWeeklyDay={(d) => toggleWeeklyDay(d, "new")}
                weeklyWeeks={newScheduleWeeklyWeeks}
                setWeeklyWeeks={setNewScheduleWeeklyWeeks}
                monthlyDaysRaw={newScheduleMonthlyDaysRaw}
                setMonthlyDaysRaw={setNewScheduleMonthlyDaysRaw}
              />
              {scheduleError ? <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--va-red-600)" }}>{scheduleError}</p> : null}
              {scheduleNotice ? (
                <p data-testid="resident-schedule-notice" style={{ margin: 0, fontSize: "0.8rem", color: "var(--va-emerald-700)" }}>
                  {scheduleNotice}
                </p>
              ) : null}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" data-testid="resident-schedule-add" className="va-btn-primary" onClick={() => void onAddSchedule()} disabled={creatingSchedule}>
                  {creatingSchedule ? t("residentDetail.saving") : t("residentDetail.save")}
                </button>
              </div>
            </div>
          ) : editingScheduleId ? (
            <div style={{ border: "1px solid var(--va-slate-200)", borderRadius: 10, padding: "0.85rem", display: "grid", gap: 10, background: "var(--va-slate-50)" }}>
              <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--va-navy)" }}>{t("residentDetail.editScheduleTitle")}</h3>
              <NewScheduleFormFields
                testIdPrefix="resident-schedule-edit"
                frequency={editScheduleFrequency}
                setFrequency={setEditScheduleFrequency}
                time={editScheduleTime}
                setTime={setEditScheduleTime}
                active={editScheduleActive}
                setActive={setEditScheduleActive}
                weeklyDays={editScheduleWeeklyDays}
                toggleWeeklyDay={(d) => toggleWeeklyDay(d, "edit")}
                weeklyWeeks={editScheduleWeeklyWeeks}
                setWeeklyWeeks={setEditScheduleWeeklyWeeks}
                monthlyDaysRaw={editScheduleMonthlyDaysRaw}
                setMonthlyDaysRaw={setEditScheduleMonthlyDaysRaw}
              />
              {scheduleError ? <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--va-red-600)" }}>{scheduleError}</p> : null}
              {scheduleNotice ? (
                <p data-testid="resident-schedule-notice" style={{ margin: 0, fontSize: "0.8rem", color: "var(--va-emerald-700)" }}>
                  {scheduleNotice}
                </p>
              ) : null}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" data-testid="resident-schedule-save" className="va-btn-primary" onClick={() => void onSaveSchedule()} disabled={updatingSchedule}>
                  {updatingSchedule ? t("residentDetail.saving") : t("residentDetail.save")}
                </button>
                <button type="button" data-testid="resident-schedule-cancel-edit" className="va-btn-secondary" onClick={() => setEditingScheduleId(null)}>
                  {t("residentDetail.cancel")}
                </button>
              </div>
            </div>
          ) : (
            <div
              data-testid={`resident-schedule-${String(primarySchedule.id)}`}
              style={{ border: "1px solid var(--va-slate-200)", borderRadius: 10, background: "#fff" }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", padding: "0.72rem 0.8rem" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.86rem", color: "var(--va-slate-900)", fontWeight: 600 }}>
                    <span style={{ textTransform: "capitalize" }}>{primarySchedule.frequency}</span> at {primarySchedule.time}
                  </div>
                  <div style={{ marginTop: 2, fontSize: "0.79rem", color: "var(--va-slate-500)" }}>
                    {primarySchedule.frequency === "weekly"
                      ? t("residentDetail.scheduleDaysWeekly", {
                          days: primarySchedule.intervals.map((i) => weekdayShortLabel(i.day)).join(", "),
                        })
                      : primarySchedule.frequency === "monthly"
                        ? t("residentDetail.scheduleDaysMonthly", {
                            days: primarySchedule.intervals.map((i) => i.day).join(", "),
                          })
                        : t("residentDetail.everyDay")}
                    {primarySchedule.nextCallDate
                      ? t("residentDetail.nextCall", { when: new Date(primarySchedule.nextCallDate).toLocaleString() })
                      : ""}
                    {primarySchedule.isActive === false ? t("residentDetail.inactiveSuffix") : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="va-btn-secondary"
                    data-testid={`resident-schedule-edit-${String(primarySchedule.id)}`}
                    onClick={() => startEditSchedule(String(primarySchedule.id))}
                  >
                    {t("residentDetail.editBtn")}
                  </button>
                  <button
                    type="button"
                    className="va-btn-ghost"
                    data-testid={`resident-schedule-delete-${String(primarySchedule.id)}`}
                    style={{ color: "var(--va-red-600)", borderColor: "var(--va-red-200)" }}
                    onClick={() => setScheduleDeleteConfirmId(String(primarySchedule.id))}
                    disabled={deletingSchedule}
                  >
                    {t("residentDetail.deleteBtn")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <div className="va-card va-card-pad">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem" }}>{t("residentDetail.sectionInfo")}</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "0 2rem",
          }}
          className="va-res-grid"
        >
          <div>
            <InfoRow
              icon={<MessageIcon size={16} />}
              label={t("residentDetail.legalName")}
              value={`${resident.firstName} ${resident.lastName}`.trim() || "—"}
            />
            <InfoRow
              icon={<MessageIcon size={16} />}
              label={t("residentDetail.preferredName")}
              value={apiClient.preferredName?.trim() || "—"}
            />
            <InfoRow icon={<PhoneIcon size={16} />} label={t("residentDetail.labelPhone")} value={resident.phone} />
            <InfoRow icon={<MessageIcon size={16} />} label={t("residentDetail.labelEmail")} value={apiClient.email || "—"} />
            <InfoRow
              icon={<MessageIcon size={16} />}
              label={t("residentDetail.preferredLanguageLabel")}
              value={LANGUAGE_OPTIONS.find((o) => o.code === (apiClient.preferredLanguage || "en"))?.label || "English"}
            />
            <InfoRow icon={<ClockIcon size={16} />} label={t("residentDetail.labelMoveIn")} value={resident.moveInDate} />
            <InfoRow
              icon={<MessageIcon size={16} />}
              label={t("residentDetail.labelEmergency")}
              value={
                <>
                  {resident.emergencyContact.name} ({resident.emergencyContact.relationship})
                  <br />
                  {resident.emergencyContact.phone}
                  {apiClient.emergencyContact?.email ? (
                    <>
                      <br />
                      {apiClient.emergencyContact.email}
                    </>
                  ) : null}
                  <br />
                  {apiClient.emergencyContact?.familyDigestEmail?.enabled
                    ? t("residentDetail.familyDigestEmailStatusOn")
                    : t("residentDetail.familyDigestEmailStatusOff")}
                  <br />
                  {apiClient.emergencyContact?.email
                    ? familyDigestEmailVerified
                      ? t("residentDetail.familyDigestEmailVerified")
                      : t("residentDetail.familyDigestEmailUnverified")
                    : t("residentDetail.familyDigestEmailNoAddress")}
                  {canManageResidents && apiClient.emergencyContact?.email && !familyDigestEmailVerified ? (
                    <>
                      <br />
                      <button
                        type="button"
                        className="va-link"
                        data-testid="resident-send-family-digest-verification"
                        style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}
                        disabled={sendingFamilyDigestVerification}
                        onClick={() => void handleSendFamilyDigestVerification()}
                      >
                        {sendingFamilyDigestVerification
                          ? t("residentDetail.familyDigestEmailSendingVerification")
                          : t("residentDetail.familyDigestEmailSendVerification")}
                      </button>
                    </>
                  ) : null}
                  {familyDigestVerificationNotice ? (
                    <>
                      <br />
                      <span data-testid="resident-family-digest-verification-success" style={{ color: "var(--va-emerald-700)" }}>
                        {familyDigestVerificationNotice}
                      </span>
                    </>
                  ) : null}
                  {familyDigestVerificationError ? (
                    <>
                      <br />
                      <span data-testid="resident-family-digest-verification-error" style={{ color: "var(--va-red-600)" }}>
                        {familyDigestVerificationError}
                      </span>
                    </>
                  ) : null}
                </>
              }
            />
            <InfoRow icon={<MessageIcon size={16} />} label={t("residentDetail.notes")} value={apiClient.notes || "—"} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "0.75rem 0", borderBottom: "1px solid var(--va-slate-100)" }}>
              <span style={{ marginTop: 2, color: "var(--va-slate-400)" }}>
                <CheckIcon size={16} />
              </span>
              <div>
                <p style={{ fontSize: "0.75rem", color: "var(--va-slate-400)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>{t("residentDetail.consentStatus")}</p>
                <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {resident.consentOnFile ? (
                    <>
                      <span style={{ color: "var(--va-emerald-500)" }}>
                        <CheckIcon size={16} />
                      </span>
                      <span style={{ color: "var(--va-emerald-700)" }}>{t("residentDetail.onFile")}</span>
                      {apiClient.consentedAt ? (
                        <span style={{ fontSize: "0.8125rem", color: "var(--va-slate-500)" }}>
                          · {formatConsentTimestamp(apiClient.consentedAt)}
                        </span>
                      ) : null}
                      <button type="button" className="va-link" style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }} onClick={() => setConsentOpen(true)}>
                        {t("residentDetail.viewDetails")}
                      </button>
                    </>
                  ) : apiClient.consented === false ? (
                    <>
                      <span style={{ color: "var(--va-red-600)" }}>{t("residentDetail.consentNotOnFile")}</span>
                      <button type="button" className="va-link" style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }} onClick={() => setConsentOpen(true)}>
                        {t("residentDetail.viewDetails")}
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ color: "var(--va-amber-700)" }}>{t("residentDetail.consentPending")}</span>
                      <button type="button" className="va-link" style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }} onClick={() => setConsentOpen(true)}>
                        {t("residentDetail.viewDetails")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <InfoRow
              icon={<ClockIcon size={16} />}
              label={t("residentDetail.labelLastCall")}
              value={
                <>
                  {resident.lastCallDate} {t("residentDetail.at")} {resident.lastCallTime}{" "}
                  <span style={{ fontSize: "0.75rem", color: "var(--va-slate-400)" }}>
                    (
                    {resident.lastCallStatus === "completed"
                      ? t("residentDetail.lastCallCompleted")
                      : resident.lastCallStatus === "no_answer"
                        ? t("residentDetail.lastCallNoAnswer")
                        : t("residentDetail.lastCallDeclined")}
                    )
                  </span>
                </>
              }
            />
            {(apiClient.latestOverallRiskScore != null || apiClient.sentimentTrendDirection) && (
              <InfoRow
                icon={<MessageIcon size={16} />}
                label={t("residentDetail.labelScores")}
                value={
                  <span style={{ fontSize: "0.875rem" }}>
                    {apiClient.latestOverallRiskScore != null &&
                      t("residentDetail.riskScore", { score: apiClient.latestOverallRiskScore })}
                    {apiClient.sentimentTrendDirection && (
                      <>
                        {apiClient.latestOverallRiskScore != null ? " · " : ""}
                        {t("residentDetail.sentimentTrend", { dir: apiClient.sentimentTrendDirection })}
                      </>
                    )}
                  </span>
                }
              />
            )}
          </div>
        </div>
      </div>
        </>
      </TabsContent>

      <TabsContent value="analysis">
        <div className="va-card va-card-pad">
        <Tabs value={analysisTab} onValueChange={(value) => setAnalysisTab(value as AnalysisTab)}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>{t("residentDetail.analysisTitle")}</h2>
          <TabsList aria-label={t("residentDetail.analysisTabsAria")} data-testid="resident-analysis-tablist">
            {(
              [
                { id: "sentiment" as const, label: t("residentDetail.tabSentiment") },
                { id: "medical" as const, label: t("residentDetail.tabMedical") },
                { id: "security" as const, label: t("residentDetail.tabSecurity") },
              ] as const
            ).map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="medical">
            <MedicalAnalysisReportPanel
              summary={medicalSummary}
              latestResult={medicalResults?.results?.[0]}
              isLoading={medicalSummaryLoading || medicalResultsLoading}
              isError={medicalSummaryError || medicalResultsError}
            />
        </TabsContent>
        <TabsContent value="sentiment">
            <p style={{ fontSize: "0.75rem", color: "var(--va-slate-500)", marginTop: "0.6rem", marginBottom: "1rem", lineHeight: 1.45 }}>
              {t("residentDetail.sentimentApiNote")}
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "1rem" }}>
              {(
                [
                  { id: "lastCall" as const, label: t("residentDetail.tabLastCall") },
                  { id: "month" as const, label: t("residentDetail.tabMonth") },
                  { id: "lifetime" as const, label: t("residentDetail.tabLifetime") },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSentimentTimeRange(tab.id)}
                  className={sentimentTimeRange === tab.id ? "va-btn-primary" : "va-btn-ghost"}
                  style={{
                    fontSize: "0.8125rem",
                    padding: "0.35rem 0.75rem",
                    borderRadius: 999,
                    ...(sentimentTimeRange === tab.id ? {} : { border: "1px solid var(--va-slate-200)" }),
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {(sentimentTrendLoading || sentimentSummaryLoading) && (
              <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>{t("residentDetail.loadingSentiment")}</p>
            )}

            {(sentimentTrendError || sentimentSummaryError) && !sentimentTrendLoading && !sentimentSummaryLoading && (
              <p style={{ color: "var(--va-red-600)", fontSize: "0.875rem" }}>{t("residentDetail.sentimentLoadError")}</p>
            )}

            {!sentimentTrendLoading &&
              !sentimentSummaryLoading &&
              !sentimentTrendError &&
              !sentimentSummaryError &&
              sentimentSummary &&
              sentimentTrend && (
                <>
                  {sentimentTimeRange === "lastCall" ? (
                    <SentimentLastCallPanel point={sentimentSummary.recentTrend?.[0]} formatDuration={formatDurationSeconds} />
                  ) : (
                    <>
                      <SentimentSummaryStrip summary={sentimentSummary} />
                      {sentimentSummary.recentTrend && sentimentSummary.recentTrend.length > 0 && (
                        <div style={{ marginTop: "1rem" }}>
                          <h3 style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--va-slate-600)", marginBottom: 8 }}>
                            {t("residentDetail.recentAnalyzed")}
                          </h3>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {sentimentSummary.recentTrend.slice(0, 8).map((pt) => (
                              <SentimentRecentChip key={pt.conversationId} point={pt} />
                            ))}
                          </div>
                        </div>
                      )}
                      <div style={{ marginTop: "1.25rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                          <h3 style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--va-slate-600)", margin: 0 }}>
                            {t("residentDetail.sentimentTrendTitle", { range: sentimentTrend.timeRange })}
                          </h3>
                          <span style={{ fontSize: "0.75rem", color: "var(--va-slate-500)" }}>
                            {t("residentDetail.avg")} {sentimentTrend.summary.averageSentiment >= 0 ? "+" : ""}
                            {sentimentTrend.summary.averageSentiment.toFixed(2)} ·{" "}
                            <span style={trendDirectionStyle(sentimentTrend.summary.trendDirection)}>
                              {trendDirectionIcon(sentimentTrend.summary.trendDirection)}{" "}
                              {sentimentTrend.summary.trendDirection}
                            </span>
                            {sentimentTrend.summary.confidence < 0.5 && (
                              <span style={{ color: "var(--va-amber-700)", marginLeft: 6 }}>{t("residentDetail.lowConfidence")}</span>
                            )}
                          </span>
                        </div>
                        {sentimentChartData.length === 0 ? (
                          <p style={{ fontSize: "0.875rem", color: "var(--va-slate-500)", marginTop: 12 }}>
                            {(sentimentTrend.analyzedConversations ?? 0) > 0
                              ? t("residentDetail.trendNotEnough")
                              : t("residentDetail.trendNone")}
                          </p>
                        ) : sentimentChartData.length < 2 ? (
                          <p style={{ fontSize: "0.875rem", color: "var(--va-slate-500)", marginTop: 12 }}>{t("residentDetail.trendNeedTwo")}</p>
                        ) : (
                          <ChartFigure
                            title={t("residentDetail.sentimentTrendTitle", { range: sentimentTrend.timeRange })}
                            summary={t("residentDetail.sentimentChartSummary", { items: sentimentChartSummary })}
                            chartStyle={{ height: 220, marginTop: 12 }}
                          >
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={sentimentChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: "#94a3b8" }} interval="preserveStartEnd" />
                                <YAxis domain={[-1, 1]} tick={{ fontSize: 10, fill: "#94a3b8" }} width={32} />
                                <Tooltip
                                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                                  formatter={(v: number) => [`${v >= 0 ? "+" : ""}${v.toFixed(2)}`, t("residentDetail.chartSentiment")]}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="score"
                                  name={t("residentDetail.chartSentiment")}
                                  stroke="#2563eb"
                                  strokeWidth={2}
                                  dot={{ r: 3, fill: "#2563eb" }}
                                  connectNulls
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </ChartFigure>
                        )}
                        {sentimentTrend.summary.keyInsights && sentimentTrend.summary.keyInsights.length > 0 && (
                          <div
                            style={{
                              marginTop: "1rem",
                              padding: "0.75rem 1rem",
                              borderRadius: "0.75rem",
                              background: "var(--va-slate-50)",
                              fontSize: "0.8125rem",
                              color: "var(--va-slate-700)",
                            }}
                          >
                            <p style={{ fontWeight: 600, marginBottom: 8 }}>{t("residentDetail.keyInsights")}</p>
                            <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                              {sentimentTrend.summary.keyInsights.map((line) => (
                                <li key={line} style={{ marginBottom: 4 }}>
                                  {line}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

            {atRisk && (
              <div
                style={{
                  marginTop: "1rem",
                  padding: "0.75rem 1rem",
                  borderRadius: "0.75rem",
                  background: "var(--va-red-50)",
                  border: "1px solid var(--va-red-100)",
                  fontSize: "0.875rem",
                  color: "var(--va-red-700)",
                }}
              >
                {t("residentDetail.atRiskBanner")}
              </div>
            )}
        </TabsContent>
        <TabsContent value="security" style={{ marginTop: "0.8rem", display: "grid", gap: "0.85rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
              <AnalysisStat label={t("residentDetail.openAlerts")} value={String(unresolvedResidentAlerts.length)} tone={unresolvedResidentAlerts.length > 0 ? "warn" : "ok"} />
              <AnalysisStat label={t("residentDetail.highUrgent")} value={String(criticalResidentAlerts.length)} tone={criticalResidentAlerts.length > 0 ? "danger" : "ok"} />
              <AnalysisStat label={t("residentDetail.traceableLines")} value={String(traceabilityAlerts.length)} tone={traceabilityAlerts.length > 0 ? "warn" : "neutral"} />
              <AnalysisStat label={t("residentDetail.totalAlerts")} value={String(residentAlerts.length)} tone="neutral" />
            </div>
            {unresolvedResidentAlerts.length === 0 ? (
              <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--va-slate-500)" }}>{t("residentDetail.noSecurityAlerts")}</p>
            ) : (
              <div>
                <h3 style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--va-slate-600)", marginBottom: 8 }}>
                  {t("residentDetail.openAlertsTitle")}
                </h3>
                <div style={{ display: "grid", gap: 8 }}>
                  {unresolvedResidentAlerts.slice(0, 6).map((a) => {
                    const id = apiRecordId(a as { id?: string; _id?: string })
                    const label = a.message
                      ? formatStoredAlertMessage(a.message, t, i18n.language)
                      : t("residentDetail.defaultAlertLabel")
                    return (
                      <div
                        key={id || label}
                        style={{
                          borderRadius: "0.75rem",
                          border: "1px solid var(--va-slate-200)",
                          background: "var(--va-slate-50)",
                          padding: "0.55rem 0.7rem",
                        }}
                      >
                        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--va-slate-700)" }}>{label}</p>
                        {id ? (
                          <Link to={`/alerts/${id}`} className="va-link" style={{ fontSize: "0.75rem" }}>
                            {t("residentDetail.viewAlert")}
                          </Link>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{ marginTop: "0.35rem" }}>
              {clientIdForApi ? <FraudAbuseAnalysisPanel clientId={clientIdForApi} /> : null}
            </div>
        </TabsContent>
        </Tabs>
      </div>
      </TabsContent>

      <TabsContent value="conversations">
        <div className="va-card va-card-pad">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>{t("residentDetail.recentConversations")}</h2>
        {convLoading ? (
          <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>{t("residentDetail.loadingShort")}</p>
        ) : conversationRows.length === 0 ? (
          <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>{t("residentDetail.noConversations")}</p>
        ) : (
          <div>
            {conversationRows.map((c) => {
              const isExpanded = expandedConversationId === c.id
              return (
                <div key={c.id} style={{ borderBottom: "1px solid var(--va-slate-100)" }}>
                  <button
                    type="button"
                    onClick={() => setExpandedConversationId(isExpanded ? null : c.id)}
                    className="va-btn-ghost"
                    style={{
                      width: "100%",
                      padding: "0.75rem 0",
                      border: "none",
                      display: "flex",
                      gap: 12,
                      textAlign: "left",
                    }}
                    aria-expanded={isExpanded}
                  >
                    <span style={{ marginTop: 4, color: "var(--va-slate-400)", flexShrink: 0 }}>
                      <MessageIcon size={16} />
                    </span>
                    <span style={{ flex: 1, display: "block" }}>
                      <span style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        <span
                          style={{
                            fontSize: "0.8125rem",
                            fontWeight: 600,
                            color: "#1d4ed8",
                            background: "#dbeafe",
                            borderRadius: 999,
                            padding: "0.15rem 0.45rem",
                          }}
                        >
                          {c.dateShort}
                        </span>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "#047857",
                            background: "#d1fae5",
                            borderRadius: 999,
                            padding: "0.14rem 0.42rem",
                          }}
                        >
                          {c.durationLabel}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--va-slate-500)" }}>{c.outcomeLabel}</span>
                      </span>
                      <span style={{ display: "block", fontSize: "0.875rem", marginTop: 4, color: "var(--va-slate-600)" }}>
                        {c.messageCount > 0 ? t("residentDetail.messagesCount", { count: c.messageCount }) : t("residentDetail.noTranscriptMessages")}
                      </span>
                    </span>
                  </button>
                  {isExpanded ? (
                    <div style={{ padding: "0 0 0.75rem 1.75rem", display: "flex", flexDirection: "column", gap: 8 }}>
                      {c.messages.length === 0 ? (
                        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--va-slate-500)" }}>
                          {t("residentDetail.transcriptUnavailable")}
                        </p>
                      ) : (
                        c.messages.map((m, idx) => {
                          const fromClient = m.role === "client"
                          const senderLabel = fromClient ? displayName || t("residentDetail.patientLabel") : t("residentDetail.biancaLabel")
                          const messageId = String((m as { id?: string; _id?: string }).id ?? (m as { _id?: string })._id ?? "")
                          const matchedAlert = traceabilityAlerts.find((a) => {
                            if (!a.conversationId || a.conversationId !== c.id) return false
                            if (messageId && a.messageIds.has(messageId)) return true
                            if (a.snippet) {
                              const content = String(m.content ?? "").toLowerCase()
                              const snippetLower = a.snippet.toLowerCase()
                              return content.includes(snippetLower) || snippetLower.includes(content)
                            }
                            return false
                          })
                          const isAlertEvidence = Boolean(matchedAlert)
                          return (
                            <div
                              key={m.id ?? `${c.id}-msg-${idx}`}
                              style={{
                                maxWidth: "88%",
                                alignSelf: fromClient ? "flex-start" : "flex-end",
                              }}
                            >
                              <p
                                style={{
                                  margin: "0 0 0.2rem",
                                  fontSize: "0.7rem",
                                  fontWeight: 600,
                                  color: fromClient ? "#1d4ed8" : "#047857",
                                  textAlign: fromClient ? "left" : "right",
                                }}
                              >
                                {senderLabel}
                              </p>
                              <div
                                style={{
                                  background: isAlertEvidence ? "#fee2e2" : fromClient ? "#dbeafe" : "#d1fae5",
                                  border: isAlertEvidence ? "1px solid #fecaca" : fromClient ? "1px solid #bfdbfe" : "1px solid #a7f3d0",
                                  color: isAlertEvidence ? "#991b1b" : fromClient ? "#1e3a8a" : "#065f46",
                                  borderRadius: fromClient ? "16px 16px 16px 6px" : "16px 16px 6px 16px",
                                  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
                                  padding: "0.6rem 0.8rem",
                                  fontSize: "0.8125rem",
                                  lineHeight: 1.4,
                                  whiteSpace: "pre-wrap",
                                }}
                              >
                                {m.content}
                              </div>
                              {matchedAlert ? (
                                <div style={{ marginTop: 4, textAlign: fromClient ? "left" : "right" }}>
                                  <Link
                                    to={`/alerts/${matchedAlert.alertId}`}
                                    className="va-link"
                                    style={{ fontSize: "0.75rem", color: "var(--va-red-700)", textDecorationColor: "var(--va-red-300)" }}
                                  >
                                    {t("residentDetail.linkedAlert")}
                                  </Link>
                                </div>
                              ) : null}
                            </div>
                          )
                        })
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
            {clientAlert && alertLinkId ? (
              <p style={{ marginTop: 12 }}>
                <Link to={`/alerts/${alertLinkId}`} className="va-link" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {t("residentDetail.viewRelatedAlert")}
                  <span style={{ display: "inline-block", transform: "rotate(180deg)" }}>
                    <ChevronLeftIcon size={12} />
                  </span>
                </Link>
              </p>
            ) : null}
          </div>
        )}
      </div>
      </TabsContent>
      </Tabs>

      {consentOpen && apiClient ? (
        <ConsentModal client={apiClient} displayName={displayName} onClose={() => setConsentOpen(false)} />
      ) : null}

      <ConfirmModal
        open={confirmDeleteResidentOpen}
        title={t("residentDetail.deleteResidentTitle", { name: displayName || "this resident" })}
        onClose={() => setConfirmDeleteResidentOpen(false)}
        onConfirm={() => void performDeleteResident()}
        confirmLabel={deletingResident ? t("residentDetail.deleting") : t("residentDetail.deleteBtn")}
        confirmDisabled={deletingResident}
      >
        <p style={{ margin: 0 }}>{t("residentDetail.deleteResidentBody")}</p>
      </ConfirmModal>

      <ConfirmModal
        open={scheduleDeleteConfirmId !== null}
        title={t("residentDetail.deleteScheduleTitle")}
        onClose={() => setScheduleDeleteConfirmId(null)}
        onConfirm={() => (scheduleDeleteConfirmId ? void performDeleteSchedule(scheduleDeleteConfirmId) : undefined)}
        confirmLabel={deletingSchedule ? t("residentDetail.deleting") : t("residentDetail.deleteBtn")}
        confirmDisabled={deletingSchedule}
      />

      <style>{`
        @media (min-width: 768px) {
          .va-res-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  )
}

function trendDirectionIcon(dir: string): string {
  if (dir === "improving") return "↗"
  if (dir === "declining") return "↘"
  return "→"
}

function outcomeLabel(raw: string | undefined): string {
  if (!raw) return "completed"
  if (raw === "no_answer") return "no answer"
  if (raw === "failed") return "failed"
  return raw
}

function trendDirectionStyle(dir: string): CSSProperties {
  if (dir === "improving") return { color: "var(--va-emerald-600)" }
  if (dir === "declining") return { color: "var(--va-red-600)" }
  return { color: "var(--va-slate-500)" }
}

function SentimentSummaryStrip({ summary }: { summary: SentimentSummary }) {
  const { t } = useTranslation()
  const dist = summary.sentimentDistribution || {}
  const distLabels: Record<string, string> = {
    positive: t("alertDetail.sentimentPositive"),
    neutral: t("alertDetail.sentimentNeutral"),
    negative: t("residentDetail.sentimentNegative"),
    mixed: t("residentDetail.sentimentMixed"),
  }
  const trendLabels: Record<string, string> = {
    improving: t("residentDetail.trendImproving"),
    declining: t("residentDetail.trendDeclining"),
    stable: t("residentDetail.trendStable"),
  }
  const parts = (["positive", "neutral", "negative", "mixed"] as const)
    .map((k) => ({ k, n: dist[k] ?? 0 }))
    .filter((x) => x.n > 0)
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: 12,
        padding: "0.75rem 0",
        borderBottom: "1px solid var(--va-slate-100)",
      }}
    >
      <div>
        <p style={{ fontSize: "0.65rem", color: "var(--va-slate-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {t("residentDetail.stripAnalyzed")}
        </p>
        <p style={{ fontSize: "1rem", fontWeight: 600, marginTop: 4 }}>
          {summary.analyzedConversations} / {summary.totalConversations}
        </p>
      </div>
      <div>
        <p style={{ fontSize: "0.65rem", color: "var(--va-slate-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {t("residentDetail.stripAverage")}
        </p>
        <p style={{ fontSize: "1rem", fontWeight: 600, marginTop: 4 }}>
          {summary.averageSentiment >= 0 ? "+" : ""}
          {summary.averageSentiment.toFixed(2)}
        </p>
      </div>
      <div>
        <p style={{ fontSize: "0.65rem", color: "var(--va-slate-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {t("residentDetail.stripDirection")}
        </p>
        <p style={{ fontSize: "1rem", fontWeight: 600, marginTop: 4, ...trendDirectionStyle(summary.trendDirection) }}>
          {trendDirectionIcon(summary.trendDirection)} {trendLabels[summary.trendDirection] ?? summary.trendDirection}
        </p>
      </div>
      <div>
        <p style={{ fontSize: "0.65rem", color: "var(--va-slate-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {t("residentDetail.stripConfidence")}
        </p>
        <p style={{ fontSize: "1rem", fontWeight: 600, marginTop: 4 }}>{Math.round(summary.confidence * 100)}%</p>
      </div>
      {parts.length > 0 && (
        <div style={{ gridColumn: "1 / -1" }}>
          <p style={{ fontSize: "0.65rem", color: "var(--va-slate-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            {t("residentDetail.stripDistribution")}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {parts.map(({ k, n }) => (
              <span
                key={k}
                style={{
                  fontSize: "0.75rem",
                  padding: "0.2rem 0.5rem",
                  borderRadius: 6,
                  background: "var(--va-slate-100)",
                  color: "var(--va-slate-700)",
                }}
              >
                {t("residentDetail.distChip", { label: distLabels[k] ?? k, count: n })}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function sentimentScoreStyles(score: number): { fg: string; bg: string } {
  if (score > 0.3) return { fg: "var(--va-emerald-600)", bg: "rgba(16, 185, 129, 0.12)" }
  if (score < -0.3) return { fg: "var(--va-red-600)", bg: "rgba(239, 68, 68, 0.1)" }
  return { fg: "var(--va-slate-600)", bg: "var(--va-slate-100)" }
}

function SentimentRecentChip({ point }: { point: SentimentTrendPoint }) {
  const { t } = useTranslation()
  const s = point.sentiment
  const tDate = point.date ? new Date(point.date) : null
  const dateStr =
    tDate && !Number.isNaN(tDate.getTime()) ? tDate.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : t("common.emDash")
  if (!s) {
    return (
      <span
        style={{
          fontSize: "0.75rem",
          padding: "0.35rem 0.6rem",
          borderRadius: 8,
          border: "1px solid var(--va-slate-200)",
          color: "var(--va-slate-500)",
        }}
      >
        {t("residentDetail.chipPending", { date: dateStr })}
      </span>
    )
  }
  const { fg, bg } = sentimentScoreStyles(s.sentimentScore)
  return (
    <span
      style={{
        fontSize: "0.75rem",
        padding: "0.35rem 0.6rem",
        borderRadius: 8,
        border: `1px solid var(--va-slate-200)`,
        color: fg,
        background: bg,
      }}
    >
      {dateStr}: {s.overallSentiment} ({s.sentimentScore >= 0 ? "+" : ""}
      {s.sentimentScore.toFixed(1)})
    </span>
  )
}

function SentimentLastCallPanel({
  point,
  formatDuration,
}: {
  point?: SentimentTrendPoint
  formatDuration: (sec?: number | null) => string
}) {
  const { t } = useTranslation()
  if (!point?.sentiment) {
    return (
      <div style={{ padding: "1rem 0", fontSize: "0.875rem", color: "var(--va-slate-500)" }}>
        <p style={{ fontWeight: 600, color: "var(--va-slate-700)", marginBottom: 8 }}>{t("residentDetail.lastCallHeading")}</p>
        <p>{t("residentDetail.lastCallEmpty")}</p>
      </div>
    )
  }
  const s = point.sentiment
  const scoreSt = sentimentScoreStyles(s.sentimentScore)
  const callDate = point.date ? new Date(point.date) : null
  return (
    <div>
      <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--va-slate-700)", marginBottom: 12 }}>{t("residentDetail.lastCallHeading")}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 12, fontSize: "0.8125rem", color: "var(--va-slate-600)" }}>
        <span>
          {callDate && !Number.isNaN(callDate.getTime())
            ? callDate.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
            : t("common.emDash")}
        </span>
        <span>{t("residentDetail.duration", { duration: formatDuration(point.duration) })}</span>
        {point.sentimentAnalyzedAt && (
          <span style={{ color: "var(--va-slate-500)" }}>
            {t("residentDetail.analyzed", {
              date: new Date(point.sentimentAnalyzedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
            })}
          </span>
        )}
      </div>
      <div
        style={{
          padding: "1rem",
          borderRadius: "0.75rem",
          background: "var(--va-slate-50)",
          border: "1px solid var(--va-slate-100)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              textTransform: "uppercase",
              padding: "0.25rem 0.5rem",
              borderRadius: 6,
              background: scoreSt.bg,
              color: scoreSt.fg,
            }}
          >
            {s.overallSentiment}
          </span>
          <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--va-navy)" }}>
            {t("residentDetail.score", {
              score: `${s.sentimentScore >= 0 ? "+" : ""}${s.sentimentScore.toFixed(2)}`,
            })}
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--va-slate-500)" }}>
            {t("residentDetail.confidencePct", { pct: Math.round(s.confidence * 100) })}
          </span>
        </div>
        {s.clientMood && (
          <p style={{ fontSize: "0.875rem", marginBottom: 6 }}>
            <strong>{t("residentDetail.mood")}</strong> {s.clientMood}
          </p>
        )}
        {s.concernLevel && (
          <p style={{ fontSize: "0.875rem", marginBottom: 6 }}>
            <strong>{t("residentDetail.concern")}</strong> {s.concernLevel}
          </p>
        )}
        {s.keyEmotions && s.keyEmotions.length > 0 && (
          <p style={{ fontSize: "0.875rem", marginBottom: 6 }}>
            <strong>{t("residentDetail.emotions")}</strong> {s.keyEmotions.join(", ")}
          </p>
        )}
        {s.summary && <p style={{ fontSize: "0.875rem", lineHeight: 1.5, color: "var(--va-slate-700)" }}>{s.summary}</p>}
        {s.recommendations && (
          <p style={{ fontSize: "0.8125rem", lineHeight: 1.5, color: "var(--va-slate-600)", marginTop: 8 }}>
            <strong>{t("residentDetail.recommendations")}</strong> {s.recommendations}
          </p>
        )}
      </div>
    </div>
  )
}

function AnalysisStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "ok" | "warn" | "danger" | "neutral"
}) {
  const toneMap = {
    ok: { bg: "var(--va-emerald-50)", fg: "var(--va-emerald-700)", border: "var(--va-emerald-100)" },
    warn: { bg: "var(--va-amber-50)", fg: "var(--va-amber-700)", border: "var(--va-amber-100)" },
    danger: { bg: "var(--va-red-50)", fg: "var(--va-red-700)", border: "var(--va-red-100)" },
    neutral: { bg: "var(--va-slate-50)", fg: "var(--va-slate-700)", border: "var(--va-slate-200)" },
  } as const
  const st = toneMap[tone]
  return (
    <div style={{ border: `1px solid ${st.border}`, borderRadius: "0.75rem", background: st.bg, padding: "0.6rem 0.7rem" }}>
      <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--va-slate-500)" }}>{label}</p>
      <p style={{ margin: "0.15rem 0 0", fontSize: "1rem", fontWeight: 700, color: st.fg }}>{value}</p>
    </div>
  )
}


function StatusPill({ status }: { status: "active" | "inactive" | "at_risk" }) {
  const { t } = useTranslation()
  const map = {
    active: { bg: "var(--va-emerald-100)", fg: "var(--va-emerald-700)", label: t("residents.statusActive") },
    inactive: { bg: "var(--va-slate-100)", fg: "var(--va-slate-600)", label: t("residents.statusInactive") },
    at_risk: { bg: "var(--va-red-100)", fg: "var(--va-red-700)", label: t("residents.statusAtRisk") },
  }
  const s = map[status]
  return (
    <span style={{ display: "inline-flex", padding: "0.125rem 0.625rem", borderRadius: 999, fontSize: "0.75rem", fontWeight: 500, background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  )
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "0.75rem 0", borderBottom: "1px solid var(--va-slate-100)" }}>
      <span style={{ marginTop: 2, color: "var(--va-slate-400)" }}>{icon}</span>
      <div>
        <p style={{ fontSize: "0.75rem", color: "var(--va-slate-400)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>{label}</p>
        <p style={{ fontSize: "0.875rem", color: "var(--va-navy)", marginTop: 4 }}>{value}</p>
      </div>
    </div>
  )
}

function ConsentModal({ client, displayName, onClose }: { client: Client; displayName: string; onClose: () => void }) {
  const { t } = useTranslation()
  const statusLabel =
    client.consented === true
      ? t("residentDetail.onFile")
      : client.consented === false
        ? t("residentDetail.consentNotOnFile")
        : t("residentDetail.consentPending")
  const statusColor =
    client.consented === true
      ? "var(--va-emerald-700)"
      : client.consented === false
        ? "var(--va-red-600)"
        : "var(--va-amber-700)"

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={t("residentDetail.consentModalTitle")}
      subtitle={t("residentDetail.consentModalSubtitle")}
      wide
      closeLabel={t("residentDetail.close")}
      footer={
        <Button variant="primary" onClick={onClose} style={{ background: "var(--va-navy)" }}>
          {t("residentDetail.close")}
        </Button>
      }
    >
      <div style={{ background: "var(--va-slate-50)", borderRadius: 12, padding: "1rem", marginBottom: "1.25rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <span style={{ fontSize: "0.75rem", color: "var(--va-slate-400)", textTransform: "uppercase" }}>{t("residentDetail.consentResidentLabel")}</span>
            <p style={{ fontWeight: 600, color: "var(--va-slate-700)", margin: "0.25rem 0 0" }}>{displayName}</p>
          </div>
          <div>
            <span style={{ fontSize: "0.75rem", color: "var(--va-slate-400)", textTransform: "uppercase" }}>{t("residentDetail.consentStatusLabel")}</span>
            <p style={{ fontWeight: 600, color: statusColor, margin: "0.25rem 0 0" }}>{statusLabel}</p>
          </div>
          <div>
            <span style={{ fontSize: "0.75rem", color: "var(--va-slate-400)", textTransform: "uppercase" }}>{t("residentDetail.consentRecorded")}</span>
            <p style={{ fontWeight: 600, color: "var(--va-slate-700)", margin: "0.25rem 0 0" }}>{formatConsentTimestamp(client.consentedAt)}</p>
          </div>
          {client.consentEmailVersion ? (
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--va-slate-400)", textTransform: "uppercase" }}>{t("residentDetail.consentEmailVersion")}</span>
              <p style={{ fontWeight: 600, color: "var(--va-slate-700)", margin: "0.25rem 0 0" }}>{client.consentEmailVersion}</p>
            </div>
          ) : null}
        </div>
      </div>
      <p style={{ fontWeight: 600, marginBottom: 8 }}>{t("residentDetail.consentProgramScope")}</p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <li key={i} style={{ display: "flex", gap: 12, marginBottom: 10 }}>
            <span style={{ color: "var(--va-teal)", flexShrink: 0 }}>✓</span>
            <span>{t(`residentDetail.consentBullet${i}`)}</span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

export default ResidentDetailPage
