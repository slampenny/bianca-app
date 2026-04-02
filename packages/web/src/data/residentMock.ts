/** Static timelines / conversation summaries matching Vercel `Nz` / `Pz`. */
export const TIMELINE_AT_RISK = [
  {
    id: "tl-1",
    date: "Mar 25, 2026",
    time: "10:47 AM",
    description:
      "Financial exploitation alert detected -- pattern of unusual financial references identified",
    type: "alert" as const,
  },
  {
    id: "tl-2",
    date: "Mar 25, 2026",
    time: "10:42 AM",
    description: "Call completed -- resident mentioned new friend helping with finances",
    type: "normal" as const,
  },
  {
    id: "tl-3",
    date: "Mar 24, 2026",
    time: "10:15 AM",
    description: "Call completed -- no concerns",
    type: "normal" as const,
  },
  {
    id: "tl-4",
    date: "Mar 23, 2026",
    time: "10:30 AM",
    description: "Call completed -- no concerns",
    type: "normal" as const,
  },
  {
    id: "tl-5",
    date: "Mar 22, 2026",
    time: "10:20 AM",
    description: "Call -- no answer",
    type: "no_answer" as const,
  },
  {
    id: "tl-6",
    date: "Mar 21, 2026",
    time: "10:35 AM",
    description: "Call completed -- no concerns",
    type: "normal" as const,
  },
  {
    id: "tl-7",
    date: "Mar 20, 2026",
    time: "10:10 AM",
    description: "Call completed -- no concerns",
    type: "normal" as const,
  },
  {
    id: "tl-8",
    date: "Mar 19, 2026",
    time: "10:45 AM",
    description: "Call completed -- no concerns",
    type: "normal" as const,
  },
]

export const TIMELINE_NORMAL = [
  {
    id: "tl-1",
    date: "Mar 25, 2026",
    time: "9:32 AM",
    description: "Call completed -- no concerns",
    type: "normal" as const,
  },
  {
    id: "tl-2",
    date: "Mar 24, 2026",
    time: "10:05 AM",
    description: "Call completed -- no concerns",
    type: "normal" as const,
  },
  {
    id: "tl-3",
    date: "Mar 23, 2026",
    time: "9:48 AM",
    description: "Call -- no answer",
    type: "no_answer" as const,
  },
  {
    id: "tl-4",
    date: "Mar 22, 2026",
    time: "10:12 AM",
    description: "Call completed -- no concerns",
    type: "normal" as const,
  },
  {
    id: "tl-5",
    date: "Mar 21, 2026",
    time: "9:55 AM",
    description: "Call completed -- no concerns",
    type: "normal" as const,
  },
  {
    id: "tl-6",
    date: "Mar 20, 2026",
    time: "10:20 AM",
    description: "Call completed -- no concerns",
    type: "normal" as const,
  },
]

export const CONVERSATIONS_AT_RISK = [
  {
    id: "ts-1",
    date: "March 25, 2026",
    duration: "5 min 23 sec",
    summary:
      "Financial exploitation indicators detected -- resident referenced new acquaintance managing bank accounts, gifting behavior, and confusion about recent withdrawals",
    hasLink: true,
  },
  {
    id: "ts-2",
    date: "March 24, 2026",
    duration: "4 min 02 sec",
    summary: "No concerns",
    hasLink: false,
  },
  {
    id: "ts-3",
    date: "March 23, 2026",
    duration: "3 min 48 sec",
    summary: "No concerns",
    hasLink: false,
  },
]

export const CONVERSATIONS_NORMAL = [
  {
    id: "ts-1",
    date: "March 25, 2026",
    duration: "4 min 12 sec",
    summary: "No concerns",
    hasLink: false,
  },
  {
    id: "ts-2",
    date: "March 24, 2026",
    duration: "3 min 48 sec",
    summary: "No concerns",
    hasLink: false,
  },
  {
    id: "ts-3",
    date: "March 23, 2026",
    duration: "4 min 30 sec",
    summary: "No concerns",
    hasLink: false,
  },
  {
    id: "ts-4",
    date: "March 22, 2026",
    duration: "3 min 55 sec",
    summary: "No concerns",
    hasLink: false,
  },
]

export const CONSENT_BULLETS = [
  "Ambient environmental monitoring in private living quarters (temperature, humidity, light levels)",
  "AI-powered voice wellness check-ins via scheduled telephone calls",
  "Pattern analysis of daily routines including sleep, mobility, and activity levels",
  "Automated alerts to designated care staff when anomalies are detected",
  "Secure storage of wellness data in HIPAA-compliant encrypted systems",
  "Periodic sharing of aggregated wellness reports with authorized family members",
] as const
