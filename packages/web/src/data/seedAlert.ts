import type { Alert } from "../types"

/** Mirrors Vercel prototype `Vr[0]` — injected when user clicks Simulate Alert. */
export const SEED_ALERT: Alert = {
  id: "ALT-2026-0089",
  residentId: "R042",
  residentName: "Margaret Thompson",
  type: "financial_exploitation",
  severity: "high",
  confidence: 92,
  status: "new",
  detectedAt: "2026-03-25T14:23:00Z",
  summary:
    "Detected repeated confusion about recent financial transactions and mention of unfamiliar individual requesting money. Pattern analysis indicates potential financial exploitation risk.",
  riskIndicators: [
    "Confusion about recent bank transactions",
    "Mention of unknown person requesting funds",
    "Deviation from established financial awareness baseline",
    "Increased anxiety when discussing money",
    "References to phone calls from unrecognized numbers",
  ],
  baselineComparison: {
    baseline: {
      financialAwareness: "Strong — consistently tracked expenses and bank activity",
      socialPattern: "Regular contact with daughter and two close friends",
      cognitiveBaseline: "Clear and organized speech patterns",
      emotionalBaseline: "Generally positive and engaged",
    },
    current: {
      financialAwareness: "Confusion about recent transactions, unable to recall amounts",
      socialPattern: "Mentions of unfamiliar individual not in contact history",
      cognitiveBaseline: "Increased hesitation and fragmented responses",
      emotionalBaseline: "Elevated anxiety, particularly around financial topics",
    },
  },
  recommendedActions: [
    { action: "Conduct in-person wellness check", priority: "high", assignTo: "Care team lead" },
    { action: "Notify family member (daughter: Sarah Thompson)", priority: "high", assignTo: "Family liaison" },
    { action: "Review recent financial activity with resident", priority: "medium", assignTo: "Social worker" },
    { action: "Document interaction for compliance records", priority: "medium", assignTo: "Care coordinator" },
  ],
}

export const LINKED_ALERT_ID = "ALT-2026-0089"
