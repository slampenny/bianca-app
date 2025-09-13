// Caregiver.ts
export interface NewUser {
  name: string
  email: string
  phone: string
  password: string
}

export interface AuthTokens {
  access: {
    expires: string
    token: string
  }
  refresh: {
    expires: string
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

export type CaregiverRole = "admin" | "staff" | "orgAdmin" | "superAdmin"

export interface Caregiver {
  id?: string
  name: string
  avatar: string
  email: string
  phone: string
  org: string
  role: CaregiverRole
  patients: string[] // Assuming this is the ID of the caregiver
}

export interface AlertPages {
  limit: number
  page: number
  results: Alert[]
  totalPages: number
  totalResults: number
}

export type CreatedModel = "Patient" | "Caregiver" | "Org" | "Schedule"
export type AlertVisibility = "orgAdmin" | "allCaregivers" | "assignedCaregivers"
export type AlertImportance = "low" | "medium" | "high"
export type AlertType = "conversation" | "patient" | "system"

export interface Alert {
  id?: string
  message: string
  importance: AlertImportance
  alertType: AlertType
  relatedPatient?: string // Patient ID if alert is related to a patient or conversation
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
  id?: string
  stripeCustomerId: string
  name: string
  avatar: string
  logo?: string
  email: string
  phone: string
  isEmailVerified: boolean
  caregivers: string[]
  patients: string[]
  planName?: string
  nextBillingDate?: string
}

export interface PatientPages {
  limit: number
  page: number
  results: Patient[]
  totalPages: number
  totalResults: number
}

export interface Patient {
  id?: string
  name: string
  avatar: string
  email: string
  phone: string
  preferredLanguage?: string
  org: string | null
  caregivers: string[]
  schedules: Schedule[]
}

export interface Interval {
  day?: number
  weeks?: number
}

export interface Schedule {
  id?: string | null | undefined
  patient?: string | null
  frequency: "daily" | "weekly" | "monthly"
  intervals: Interval[]
  time: string
  isActive: boolean
}

export type MessageRole = "patient" | "assistant" | "system" | "debug-user"

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
  patientId: string
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
  agentId?: string
  callNotes?: string
  
  // Sentiment analysis fields
  sentiment?: SentimentAnalysis
  sentimentAnalyzedAt?: string
}

// api.types.ts
export type InvoiceStatus = "draft" | "pending" | "paid" | "void" | "overdue"

export interface LineItem {
  id: string
  patientId: string
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
  patientMood?: string
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
  patientId: string
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
  complexityScore: number
  attentionDeficit: number
  memoryIssues: number
  languageDecline: number
}

export interface PsychiatricMetrics {
  depressionScore: number
  anxietyScore: number
  overallRiskScore: number
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
  typeTokenRatio: number
  lexicalDiversity: number
  sophisticatedWords: number
  simpleWords: number
  totalWords: number
}

export interface MedicalAnalysisResult {
  patientId: string
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
  patientId: string
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
