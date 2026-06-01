import { createContext, useCallback, useContext } from "react"
import type { DemoAction, DemoState } from "../types"

/** Inert state when DemoProvider is absent (production builds). */
export const EMPTY_DEMO_STATE: DemoState = {
  residents: [],
  alerts: [],
  transcripts: [],
  activityFeed: [],
  alertTriggered: false,
  toastVisible: false,
  toastMessage: "",
  sidebarCollapsed: false,
}

function noopDispatch() {
  /* production no-op */
}

export const DemoContext = createContext<{
  state: DemoState
  dispatch: React.Dispatch<DemoAction>
}>({
  state: EMPTY_DEMO_STATE,
  dispatch: noopDispatch as React.Dispatch<DemoAction>,
})

export function useDemo() {
  return useContext(DemoContext)
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
