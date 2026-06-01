/** Shared API shapes (aligned with mobile / backend where applicable). */

export interface ApiConfig {
  url: string
  timeout: number
}

export interface AuthTokens {
  access: {
    expires: string | number
    token: string
  }
  refresh: {
    expires: string | number
    token: string
  }
}

export type CaregiverRole = "admin" | "staff" | "orgAdmin" | "superAdmin" | "unverified"

export interface Caregiver {
  id?: string
  name: string
  avatar: string
  email: string
  phone: string
  org: string
  role: CaregiverRole
  active?: boolean
  externalId?: string
  clients: string[]
  preferredLanguage?: string
  isEmailVerified?: boolean
  isPhoneVerified?: boolean
  ssoProvider?: "google" | "microsoft" | null
  ssoProviderId?: string | null
  onboardingComplete?: boolean
  mfaEnabled?: boolean
  notificationPreferences?: {
    dailyDigestEmail?: boolean
  }
}

export interface Org {
  id?: string
  name: string
  avatar: string
  email: string
  phone: string
  stripeCustomerId: string
  isEmailVerified: boolean
  caregivers: string[]
  clients: string[]
}

export interface RegisterResult {
  message: string
  caregiver: Caregiver
  requiresEmailVerification: boolean
}

export interface VerifyEmailSuccess {
  success: boolean
  message?: string
  alreadyVerified?: boolean
  caregiver?: Caregiver
  tokens?: AuthTokens
  org?: unknown
  clients?: Client[]
  error?: string
}

/** Backend /clients + login payload */
export interface Schedule {
  id?: string | null
  client?: string | null
  frequency: "daily" | "weekly" | "monthly"
  intervals: { day?: number; weeks?: number }[]
  time: string
  isActive: boolean
  nextCallDate?: string
}

export interface Client {
  id?: string
  name: string
  firstName?: string
  lastName?: string
  preferredName?: string | null
  notes?: string | null
  avatar?: string
  email: string
  phone: string
  preferredLanguage?: string
  org: string | null
  caregivers: string[]
  schedules: Schedule[]
  age?: number
  consented?: boolean
  /** ISO string when consent was recorded */
  consentedAt?: string | null
  consentEmailVersion?: string | null
  room?: string | null
  moveInDate?: string | null
  emergencyContact?: { name?: string; relationship?: string; phone?: string; email?: string } | null
  lastCallAttemptAt?: string | null
  lastAnsweredCallAt?: string | null
  sentimentTrendDirection?: "improving" | "stable" | "declining" | null
  sentimentAnalyzedConversations?: number | null
  latestOverallHealthScore?: number | null
  latestOverallRiskScore?: number | null
}

export interface ClientPages {
  limit: number
  page: number
  results: Client[]
  totalPages: number
  totalResults: number
}

/** GET /clients/:id/onboarding — voice onboarding journey for a client */
export interface ClientOnboardingJourneyDay {
  dayNumber: number
  theme?: string | null
  totalQuestions: number
  capturedCount: number
  sessionCompleted: boolean
  sessionCompletedAt?: string | null
  sessionEndedReason?: string | null
}

export interface ClientOnboardingJourney {
  days: ClientOnboardingJourneyDay[]
  totalDays: number
  enabled?: boolean
  currentDay: number | null
  journeyComplete: boolean
  sessionsCompletedCount: number
  hasAnyOnboardingActivity: boolean
}

export interface ClientOnboardingFlags {
  safety: boolean
  memory: boolean
  mood: boolean
  distress: boolean
  confusion: boolean
}

export interface ClientOnboardingResponseRow {
  id?: string
  clientId?: string
  dayNumber: number
  questionId: string
  responseType?: string
  responseValue?: unknown
  verbatimTranscript?: string | null
  callId?: string
  conversationId?: string
  capturedAt?: string
  safety_flag?: boolean
  memory_flag?: boolean
  mood_flag?: boolean
  distress_flag?: boolean
  confusion_flag?: boolean
  notes?: string | null
}

export interface ClientOnboardingDashboard {
  journey: ClientOnboardingJourney
  responses: ClientOnboardingResponseRow[]
  flags: ClientOnboardingFlags
  questionCount: number
}

/** GET /clients/onboarding-rollups — per-client summary for lists / dashboard */
export interface ClientOnboardingRollup {
  totalDays: number
  enabled?: boolean
  sessionsCompletedCount: number
  journeyComplete: boolean
  currentDay: number | null
  hasAnyOnboardingActivity: boolean
  flags: ClientOnboardingFlags
  questionCount: number
}

export interface CaregiverPages {
  limit: number
  page: number
  results: Caregiver[]
  totalPages: number
  totalResults: number
}

/** Evidence / suggested actions (release/mvp alert model) */
export interface ApiAlertEvidence {
  snippet?: string
  conversationId?: string
  messageIds?: string[]
  detector?: string
  confidence?: number
  language?: string
}

export interface ApiAlertRecommendedAction {
  id: string
  labelKey: string
  actionType: string
}

export interface ApiAlertResolvedBy {
  id?: string
  name?: string
  email?: string
}

/** Alert document as returned by GET /alerts */
export interface ApiAlertRecord {
  id?: string
  message: string
  importance: string
  alertType: string
  relatedClient?: string | null
  relatedConversation?: string | null
  readBy?: string[]
  createdAt?: string
  updatedAt?: string
  visibility?: string
  createdBy?: string
  createdModel?: string
  evidence?: ApiAlertEvidence
  recommendedActions?: ApiAlertRecommendedAction[]
  resolutionNote?: string | null
  resolvedAt?: string | null
  resolvedBy?: ApiAlertResolvedBy | string | null
}

export interface ConversationMessage {
  id?: string
  role: string
  content: string
  timestamp?: string
}

/** Populated message from GET /conversations/:id (Message model + timestamps). */
export interface ConversationMessageApi extends ConversationMessage {
  _id?: string
  createdAt?: string
  updatedAt?: string
  metadata?: Record<string, unknown>
}

/** Single conversation returned by GET /conversations/:conversationId (ConversationDTO). */
export interface ConversationDetail {
  id?: string
  callSid?: string
  clientId: string
  messages?: ConversationMessageApi[]
  startTime?: string | null
  endTime?: string | null
  duration?: number
  callStartTime?: string | null
  callEndTime?: string | null
  callDuration?: number
  status?: string
  callOutcome?: string
  callNotes?: string | null
}

export interface Conversation {
  id?: string
  callSid?: string
  clientId: string
  messages?: ConversationMessage[]
  startTime?: string
  endTime?: string
  duration?: number
  status?: string
  callOutcome?: string
}

export interface ConversationPages {
  limit: number
  page: number
  results: Conversation[]
  totalPages: number
  totalResults: number
}

/** Sentiment (GET /sentiment/client/:id/trend|summary) — aligned with mobile. */
export type SentimentType = "positive" | "negative" | "neutral" | "mixed"
export type SentimentTrendDirection = "improving" | "declining" | "stable"
export type SentimentConcernLevel = "low" | "medium" | "high"

export interface SentimentAnalysis {
  overallSentiment: SentimentType
  sentimentScore: number
  confidence: number
  clientMood?: string
  keyEmotions?: string[]
  concernLevel?: SentimentConcernLevel
  satisfactionIndicators?: {
    positive?: string[]
    negative?: string[]
  }
  summary?: string
  recommendations?: string
  fallback?: boolean
}

export interface SentimentTrendPoint {
  conversationId: string
  date: string
  duration: number
  sentiment: SentimentAnalysis | null
  sentimentAnalyzedAt?: string
}

export interface SentimentTrend {
  clientId: string
  timeRange: "lastCall" | "month" | "lifetime"
  startDate: string
  endDate: string
  totalConversations: number
  analyzedConversations: number
  dataPoints: SentimentTrendPoint[]
  summary: {
    averageSentiment: number
    sentimentDistribution: Record<SentimentType, number>
    trendDirection: SentimentTrendDirection
    confidence: number
    keyInsights: string[]
    analyzedConversations?: number
  }
}

export interface SentimentSummary {
  totalConversations: number
  analyzedConversations: number
  averageSentiment: number
  sentimentDistribution: Record<SentimentType, number>
  trendDirection: SentimentTrendDirection
  confidence: number
  keyInsights: string[]
  recentTrend: SentimentTrendPoint[]
}
