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
  clients: string[]
  preferredLanguage?: string
  isEmailVerified?: boolean
  isPhoneVerified?: boolean
  ssoProvider?: "google" | "microsoft" | null
  ssoProviderId?: string | null
  onboardingComplete?: boolean
  mfaEnabled?: boolean
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
}

export interface Client {
  id?: string
  name: string
  avatar?: string
  email: string
  phone: string
  preferredLanguage?: string
  org: string | null
  caregivers: string[]
  schedules: Schedule[]
  age?: number
  consented?: boolean
  preferredName?: string
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
}

export interface ConversationMessage {
  id?: string
  role: string
  content: string
  timestamp?: string
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
