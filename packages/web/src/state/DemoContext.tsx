import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react"
import residentsJson from "../data/residents.json"
import transcriptsJson from "../data/transcripts.json"
import { SEED_ALERT } from "../data/seedAlert"
import { generateActivityFeed, randomCallActivity } from "../lib/activityFeed"
import { clientDisplayName } from "../lib/clientDisplayName"
import type { DemoAction, DemoState, Resident, Transcript } from "../types"

function normalizeResidents(list: Resident[]): Resident[] {
  return list.map((r) => {
    const preferredName =
      "preferredName" in r && r.preferredName != null && r.preferredName !== ""
        ? String(r.preferredName)
        : null
    const displayName = clientDisplayName({
      name: `${r.firstName} ${r.lastName}`.trim(),
      preferredName,
      firstName: r.firstName,
      lastName: r.lastName,
    })
    const base: Resident = { ...r, preferredName, displayName }
    return base.firstName === "Margaret" && base.lastName === "Thompson"
      ? { ...base, status: "active", riskLevel: "none", riskType: null }
      : base
  })
}

function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "TRIGGER_ALERT": {
      if (state.alertTriggered) return state
      const alert = { ...SEED_ALERT, status: "new" as const }
      const activityItem = {
        id: `act-alert-${Date.now()}`,
        type: "alert" as const,
        residentName: alert.residentName,
        residentId: alert.residentId,
        timestamp: new Date(),
        message: `ALERT: ${alert.summary}`,
      }
      return {
        ...state,
        alerts: [alert, ...state.alerts],
        alertTriggered: true,
        toastVisible: true,
        toastMessage:
          "High-confidence financial risk detected — Margaret Thompson",
        activityFeed: [activityItem, ...state.activityFeed].slice(0, 50),
        residents: state.residents.map((r) =>
          r.id === alert.residentId
            ? {
                ...r,
                status: "at_risk",
                riskLevel: "high",
                riskType: "financial",
              }
            : r,
        ),
      }
    }
    case "DISMISS_TOAST":
      return { ...state, toastVisible: false }
    case "TOGGLE_SIDEBAR":
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed }
    case "ACKNOWLEDGE_ALERT":
      return {
        ...state,
        alerts: state.alerts.map((a) =>
          a.id === action.alertId ? { ...a, status: "acknowledged" as const } : a,
        ),
      }
    case "ADD_RANDOM_ACTIVITY":
      if (state.residents.length === 0) return state
      return {
        ...state,
        activityFeed: [
          randomCallActivity(state.residents),
          ...state.activityFeed,
        ].slice(0, 50),
      }
    default:
      return state
  }
}

function buildInitialState(): DemoState {
  const raw = residentsJson as Resident[]
  const residents = normalizeResidents(raw)
  return {
    residents,
    alerts: [],
    transcripts: transcriptsJson as Transcript[],
    activityFeed: generateActivityFeed(residents),
    alertTriggered: false,
    toastVisible: false,
    toastMessage: "",
    sidebarCollapsed: false,
  }
}

const DemoContext = createContext<{
  state: DemoState
  dispatch: React.Dispatch<DemoAction>
} | null>(null)

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(demoReducer, undefined, buildInitialState)

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    const schedule = () => {
      const delay = 15_000 + Math.floor(Math.random() * 15_000)
      timeout = setTimeout(() => {
        dispatch({ type: "ADD_RANDOM_ACTIVITY" })
        schedule()
      }, delay)
    }
    schedule()
    return () => clearTimeout(timeout)
  }, [])

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch])

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}

export function useDemo() {
  const ctx = useContext(DemoContext)
  if (!ctx) throw new Error("useDemo must be used within DemoProvider")
  return ctx
}

export function useDemoActions() {
  const { dispatch } = useDemo()
  return {
    triggerAlert: useCallback(() => dispatch({ type: "TRIGGER_ALERT" }), [dispatch]),
    dismissToast: useCallback(() => dispatch({ type: "DISMISS_TOAST" }), [dispatch]),
    toggleSidebar: useCallback(() => dispatch({ type: "TOGGLE_SIDEBAR" }), [dispatch]),
    acknowledgeAlert: useCallback(
      (alertId: string) => dispatch({ type: "ACKNOWLEDGE_ALERT", alertId }),
      [dispatch],
    ),
  }
}
