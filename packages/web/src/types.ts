export interface EmergencyContact {
  name: string
  relationship: string
  phone: string
}

export interface Resident {
  id: string
  firstName: string
  lastName: string
  age: number
  room: string
  status: "active" | "inactive" | "at_risk"
  consentOnFile: boolean
  phone: string
  moveInDate: string
  lastCallDate: string
  lastCallTime: string
  lastCallStatus: "completed" | "no_answer" | "declined"
  riskLevel: "none" | "low" | "medium" | "high"
  riskType: string | null
  emergencyContact: EmergencyContact
}

export interface RecommendedAction {
  action: string
  priority: string
  assignTo: string
}

export interface Alert {
  id: string
  residentId: string
  residentName: string
  type: string
  severity: string
  confidence: number
  status: "new" | "acknowledged"
  detectedAt: string
  summary: string
  riskIndicators: string[]
  baselineComparison: {
    baseline: Record<string, string>
    current: Record<string, string>
  }
  recommendedActions: RecommendedAction[]
}

export interface TranscriptLine {
  speaker: string
  text: string
  timestamp: string
  sentiment: string
  annotations: { type: string; label: string; detail: string }[]
}

export interface Transcript {
  id: string
  alertId: string
  residentId: string
  residentName: string
  callDate: string
  callTime: string
  duration: string
  lines: TranscriptLine[]
}

export interface ActivityItem {
  id: string
  type: "call_completed" | "alert"
  residentName: string
  residentId: string
  timestamp: Date
  message: string
}

export interface DemoState {
  residents: Resident[]
  alerts: Alert[]
  transcripts: Transcript[]
  activityFeed: ActivityItem[]
  alertTriggered: boolean
  toastVisible: boolean
  toastMessage: string
  sidebarCollapsed: boolean
}

export type DemoAction =
  | { type: "TRIGGER_ALERT" }
  | { type: "DISMISS_TOAST" }
  | { type: "TOGGLE_SIDEBAR" }
  | { type: "ACKNOWLEDGE_ALERT"; alertId: string }
  | { type: "ADD_RANDOM_ACTIVITY" }
