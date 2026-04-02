// Caregiver.ts
export interface NewUser {
  name: string
  email: string
  phone: string
  password: string
}

export interface AuthTokens {
  access: {
    /** ISO string or Unix seconds (backend `moment().unix()`). */
    expires: string | number
    token: string
  }
  refresh: {
    expires: string | number
    token: string
  }
}

export interface CaregiverPages {
  limit: number
  page: number
  results: Caregiver[]
  totalPages: number
  totalResults: number
}

export type CaregiverRole = "admin" | "staff" | "orgAdmin" | "superAdmin" | "unverified"

export type OnboardingPersona = "organization" | "caregiver" | "agingInPlace"

export interface Caregiver {
  id?: string
  name: string
  avatar: string
  email: string
  phone: string
  org: string
  role: CaregiverRole
  clients: string[] // Client IDs assigned to this caregiver
  preferredLanguage?: string
  isEmailVerified?: boolean
  isPhoneVerified?: boolean
  ssoProvider?: "google" | "microsoft" | null
  ssoProviderId?: string | null
  onboardingComplete?: boolean
  persona?: OnboardingPersona
}

export interface AlertPages {
  limit: number
  page: number
  results: Alert[]
  totalPages: number
  totalResults: number
}

export type CreatedModel = "Client" | "Caregiver" | "Org" | "Schedule"
export type AlertVisibility = "orgAdmin" | "allCaregivers" | "assignedCaregivers"
export type AlertImportance = "low" | "medium" | "high"
export type AlertType = "conversation" | "client" | "system"

export interface Alert {
  id?: string
  message: string
  importance: AlertImportance
  alertType: AlertType
  relatedClient?: string
  relatedConversation?: string // Conversation ID if alert is related to a conversation
  createdBy: string // Assuming this is the ID of the creator
  createdModel: CreatedModel
  visibility: AlertVisibility
  readBy: string[] // Assuming these are the IDs of the caregivers who have read the alert
  relevanceUntil?: Date
}

export interface OrgPages {
  limit: number
  page: number
  results: Org[]
  totalPages: number
  totalResults: number
}

export interface Org {
  country?: string
  id?: string
  stripeCustomerId: string
  name: string
  avatar: string
  logo?: string
  email: string
  phone: string
  isEmailVerified: boolean
  timezone?: string // IANA timezone identifier (e.g., 'America/New_York', 'Europe/London')
  caregivers: string[]
  clients: string[]
  planName?: string
  nextBillingDate?: string
  requireClientConsent?: boolean
  callRetrySettings?: {
    retryCount: number
    retryIntervalMinutes: number
    alertOnAllMissedCalls: boolean
  }
}

export interface ClientPages {
  limit: number
  page: number
  results: Client[]
  totalPages: number
  totalResults: number
}

export interface Client {
  id?: string
  name: string
  avatar: string
  email: string
  phone: string
  preferredLanguage?: string
  org: string | null
  caregivers: string[]
  schedules: Schedule[]
  room?: string | null
  /** ISO date string from API */
  moveInDate?: string | null
  emergencyContact?: { name?: string; relationship?: string; phone?: string } | null
  /** Most recent call attempt (any outcome), ISO string */
  lastCallAttemptAt?: string | null
  /** Most recent call with outcome answered, ISO string */
  lastAnsweredCallAt?: string | null
  /** ~30d sentiment summary (reports) */
  sentimentTrendDirection?: "improving" | "stable" | "declining" | null
  sentimentAnalyzedConversations?: number | null
  /** Latest medical analysis overall health score (0–100), if any */
  latestOverallHealthScore?: number | null
  /** Latest fraud/abuse overall risk score (0–100), if any */
  latestOverallRiskScore?: number | null
}

export interface OnboardingResponseRow {
  id?: string
  clientId?: string
  dayNumber: number
  questionId: string
  responseType: string
  responseValue: unknown
  verbatimTranscript?: string
  callId?: string
  conversationId?: string
  capturedAt?: string
  safety_flag?: boolean
  memory_flag?: boolean
  mood_flag?: boolean
  distress_flag?: boolean
  confusion_flag?: boolean
  notes?: string
}

export interface ClientOnboardingJourneyDay {
  dayNumber: number
  totalQuestions: number
  capturedCount: number
  sessionCompleted: boolean
  sessionCompletedAt?: string | null
  sessionEndedReason?: string | null
}

export interface ClientOnboardingJourney {
  days: ClientOnboardingJourneyDay[]
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

export interface ClientOnboardingPayload {
  journey: ClientOnboardingJourney
  responses: OnboardingResponseRow[]
  flags: ClientOnboardingFlags
  questionCount: number
}

export interface Interval {
  day?: number
  weeks?: number
}

export interface Schedule {
  id?: string | null | undefined
  client?: string | null
  frequency: "daily" | "weekly" | "monthly"
  intervals: Interval[]
  time: string
  isActive: boolean
}

export type MessageRole = "client" | "assistant" | "system" | "debug-user"

export interface Message {
  id?: string
  role: MessageRole
  content: string
  createdAt?: string
  updatedAt?: string
}

export interface ConversationPages {
  limit: number
  page: number
  results: Conversation[]
  totalPages: number
  totalResults: number
}

export interface Conversation {
  id?: string
  callSid: string
  clientId: string
  lineItemId: string | null
  messages: Message[]
  history: string
  analyzedData: Record<string, unknown>
  metadata: Record<string, unknown>
  startTime: string
  endTime: string
  duration: number
  status?: string
  callType?: string
  
  // Call workflow fields - using status field only
  callStartTime?: string
  callEndTime?: string
  callDuration?: number
  callOutcome?: 'answered' | 'no_answer' | 'busy' | 'failed' | 'voicemail'
  caregiverId?: string
  callNotes?: string
  
  // Sentiment analysis fields
  sentiment?: SentimentAnalysis
  sentimentAnalyzedAt?: string
}

// api.types.ts
export type InvoiceStatus = "draft" | "pending" | "paid" | "void" | "overdue"

export interface LineItem {
  id: string
  clientId: string
  invoiceId?: string
  amount: number
  description: string
  periodStart?: string
  periodEnd?: string
  quantity?: number
  unitPrice?: number
  createdAt?: string
  updatedAt?: string
}

export interface Invoice {
  id: string
  org: string
  invoiceNumber: string
  issueDate: string
  dueDate: string
  status: InvoiceStatus
  totalAmount: number
  paymentMethod?: string
  stripePaymentIntentId?: string
  stripeInvoiceId?: string
  paidAt?: string
  notes?: string
  createdAt?: string
  updatedAt?: string
  lineItems?: LineItem[]
}

export interface PaymentMethod {
  id?: string
  stripePaymentMethodId: string
  org: string
  isDefault: boolean
  type: "card" | "bank_account" | "us_bank_account"
  brand?: string
  last4?: string
  expMonth?: number
  expYear?: number
  bankName?: string
  accountType?: string
  billingDetails?: {
    name?: string
    email?: string
    phone?: string
    address?: {
      line1?: string
      line2?: string
      city?: string
      state?: string
      postal_code?: string
      country?: string
    }
  }
  metadata?: Record<string, string>
  createdAt?: string
  updatedAt?: string
}

/**
 * The options used to configure apisauce.
 */
export interface ApiConfig {
  /**
   * The URL of the api.
   */
  url: string

  /**
   * Milliseconds before we timeout the request.
   */
  timeout: number
}

// Sentiment Analysis Types
export type SentimentType = "positive" | "negative" | "neutral" | "mixed"
export type TrendDirection = "improving" | "declining" | "stable"
export type ConcernLevel = "low" | "medium" | "high"

export interface SentimentAnalysis {
  overallSentiment: SentimentType
  sentimentScore: number // -1 to 1
  confidence: number // 0 to 1
  clientMood?: string
  keyEmotions?: string[]
  concernLevel?: ConcernLevel
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
    trendDirection: TrendDirection
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
  trendDirection: TrendDirection
  confidence: number
  keyInsights: string[]
  recentTrend: SentimentTrendPoint[]
}

// Medical Analysis Types
export type MedicalAnalysisConfidence = "high" | "medium" | "low" | "none"
export type MedicalAnalysisTrigger = "monthly" | "manual" | "on-demand"

export interface CognitiveMetrics {
  riskScore: number
  fillerWordDensity: number
  vagueReferenceDensity: number
  repetitionRate: number
  repetitionScore?: number
  complexityScore: number
  attentionDeficit: number
  memoryIssues: number
  languageDecline: number
  temporalConfusionCount?: number
  wordFindingDifficultyCount?: number
  informationDensity?: { score?: number }
  indicators?: Array<{ severity?: string; message?: string }>
}

export interface PsychiatricMetrics {
  depressionScore: number
  anxietyScore: number
  overallRiskScore: number
  crisisIndicators?: { hasCrisisIndicators?: boolean }
  emotionalTone?: { dominantTone?: string; negativeRatio?: number }
  protectiveFactors?: number | string
  detailedAnalysis: {
    depression: {
      sadness: { count: number; examples: string[] }
      hopelessness: { count: number; examples: string[] }
      worthlessness: { count: number; examples: string[] }
      suicidal: { count: number; examples: string[] }
    }
    anxiety: {
      worry: { count: number; examples: string[] }
      catastrophicThinking: { count: number; examples: string[] }
      hypervigilance: { count: number; examples: string[] }
      panic: { count: number; examples: string[] }
    }
  }
}

export interface VocabularyMetrics {
  complexityScore: number
  avgSentenceLength: number
  avgWordLength?: number
  uniqueWords?: number
  typeTokenRatio: number
  lexicalDiversity: number
  sophisticatedWords: number
  simpleWords: number
  totalWords: number
}

export interface MedicalAnalysisResult {
  clientId: string
  analysisDate: string
  conversationCount: number
  messageCount: number
  totalWords: number
  cognitiveMetrics: CognitiveMetrics
  psychiatricMetrics: PsychiatricMetrics
  vocabularyMetrics: VocabularyMetrics
  warnings: string[]
  confidence: MedicalAnalysisConfidence
  trigger: MedicalAnalysisTrigger
  batchId?: string
  error?: string
  status?: string
}

export interface MedicalAnalysisTrendPoint {
  analysisId: string
  date: string
  analysis: MedicalAnalysisResult
}

export interface MedicalAnalysisTrend {
  clientId: string
  timeRange: "month" | "quarter" | "year"
  startDate: string
  endDate: string
  totalAnalyses: number
  dataPoints: MedicalAnalysisTrendPoint[]
  summary: {
    averageCognitiveRisk: number
    averagePsychiatricRisk: number
    cognitiveTrend: TrendDirection
    psychiatricTrend: TrendDirection
    vocabularyTrend: TrendDirection
    confidence: number
    keyInsights: string[]
    criticalWarnings: string[]
  }
}

export interface MedicalAnalysisSummary {
  totalAnalyses: number
  averageCognitiveRisk: number
  averagePsychiatricRisk: number
  cognitiveTrend: TrendDirection
  psychiatricTrend: TrendDirection
  vocabularyTrend: TrendDirection
  confidence: number
  keyInsights: string[]
  criticalWarnings: string[]
  recentAnalyses: MedicalAnalysisTrendPoint[]
}

// Fraud and Abuse Analysis Types
export type FraudAbuseConfidence = "high" | "medium" | "low" | "none"

export interface FinancialRiskMetrics {
  riskScore: number
  confidence: FraudAbuseConfidence
  indicators: Array<{
    type: string
    severity: "low" | "medium" | "high"
    message: string
  }>
  largeAmountMentions: number
  transferMethodMentions: number
  scamIndicatorMentions: number
  urgencyMentions: number
  helpRequestMentions: number
  relationshipMoneyMentions: number
  temporalPatterns: {
    hasEscalation: boolean
    trend: "increasing" | "decreasing" | "stable" | "insufficient_data"
    recentAverage?: number
    earlierAverage?: number
  }
  flaggedPhrases: string[]
}

export interface AbuseRiskMetrics {
  riskScore: number
  confidence: FraudAbuseConfidence
  indicators: Array<{
    type: string
    severity: "low" | "medium" | "high"
    message: string
  }>
  physicalAbuseScore: number
  emotionalAbuseScore: number
  neglectScore: number
  injuryMentions: number
  isolationMentions: number
  fearMentions: number
  basicNeedsMentions: number
  temporalPatterns: {
    hasEscalation: boolean
    trend: "increasing" | "decreasing" | "stable" | "insufficient_data"
    recentAverage?: number
    earlierAverage?: number
  }
  flaggedPhrases: string[]
}

export interface RelationshipRiskMetrics {
  riskScore: number
  confidence: FraudAbuseConfidence
  indicators: Array<{
    type: string
    severity: "low" | "medium" | "high"
    message: string
  }>
  newPeopleCount: number
  isolationCount: number
  controlCount: number
  dependencyCount: number
  suspiciousBehaviorCount: number
  temporalChanges: {
    hasChanges: boolean
    hasIsolationIncrease?: boolean
    hasNewPeopleIncrease?: boolean
    trend: "increasing" | "decreasing" | "stable" | "insufficient_data"
    earlyPeriod?: { count: number; messages: number }
    middlePeriod?: { count: number; messages: number }
    latePeriod?: { count: number; messages: number }
  }
  flaggedPeople: Array<{
    context: string
    timestamp: string
    conversationId: string
  }>
  relationshipTimeline: Array<{
    timestamp: string
    type: "new_person" | "isolation"
    excerpt: string
  }>
}

export interface FraudAbuseAnalysisResult {
  id?: string
  clientId: string
  analysisDate: string
  timeRange: "month" | "quarter" | "year" | "custom"
  conversationCount: number
  messageCount: number
  totalWords: number
  financialRisk: FinancialRiskMetrics
  abuseRisk: AbuseRiskMetrics
  relationshipRisk: RelationshipRiskMetrics
  overallRiskScore: number
  confidence: FraudAbuseConfidence
  warnings: string[]
  recommendations: Array<{
    category: "financial" | "abuse" | "neglect" | "relationship" | "overall" | "general"
    priority: "low" | "medium" | "high"
    action: string
    description: string
  }>
  changeFromBaseline?: {
    financial?: {
      riskScore: number
      largeAmountMentions: number
      transferMethodMentions: number
    }
    abuse?: {
      riskScore: number
      physicalAbuseScore: number
      emotionalAbuseScore: number
      neglectScore: number
    }
    relationship?: {
      riskScore: number
      newPeopleCount: number
      isolationCount: number
    }
    overall?: {
      riskScore: number
    }
  }
}
