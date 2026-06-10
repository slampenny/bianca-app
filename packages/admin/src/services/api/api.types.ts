export interface AuthTokens {
  access: { expires: string | number; token: string }
  refresh: { expires: string | number; token: string }
}

export type CaregiverRole = "admin" | "staff" | "orgAdmin" | "superAdmin" | "unverified" | "invited"

export interface Caregiver {
  id?: string
  name: string
  email: string
  role: CaregiverRole
  org?: string
}

export interface Org {
  id?: string
  name: string
}

export interface AdminCaregiverSearchRow {
  id?: string
  name: string
  email: string
  role: string
  orgName?: string | null
}

export interface AdminCaregiverSearchResponse {
  results: AdminCaregiverSearchRow[]
  page: number
  limit: number
  totalPages: number
  totalResults: number
}

export interface AdminOrgSearchRow {
  id?: string
  name: string
  email: string
}

export interface AdminOrgSearchResponse {
  results: AdminOrgSearchRow[]
  page: number
  limit: number
  totalPages: number
  totalResults: number
}

/** GET/PATCH /v1/orgs/:orgId (super admin) */
export interface VoiceOnboardingQuestion {
  id: string
  prompt: string
  compressionPriority?: boolean
}

export interface VoiceOnboardingDay {
  dayNumber?: number
  theme?: string
  opening?: string
  questions: VoiceOnboardingQuestion[]
}

export interface VoiceOnboardingConfig {
  useDefault: boolean
  days?: VoiceOnboardingDay[]
}

export interface RequiredCallQuestion {
  id: string
  prompt: string
}

export interface RequiredCallQuestionsConfig {
  enabled: boolean
  questions: RequiredCallQuestion[]
}

export interface VoiceOnboardingPlan {
  useDefault: boolean
  totalDays: number
  days: VoiceOnboardingDay[]
}

export interface AdminOrgDetail {
  id?: string
  name: string
  email: string
  debugAudioUploadEnabled?: boolean
  timezone?: string
  country?: string
  requireClientConsent?: boolean
  voiceOnboarding?: VoiceOnboardingConfig
  requiredCallQuestions?: RequiredCallQuestionsConfig
}

export interface ScimAdminStatus {
  enabled: boolean
  tokenHint: string | null
  scimBaseUrl: string
}

export interface ScimTokenIssueResponse {
  token: string
  scimBaseUrl: string
  tokenHint: string
}

export interface ImpersonateResponse {
  impersonation: boolean
  org: Org | null
  caregiver: Caregiver
  clients: unknown[]
  alerts: unknown[]
  tokens: AuthTokens
}

export interface ObservabilityPayload {
  health: {
    status: string
    timestamp: string
    environment: string
    services: Record<string, unknown>
  }
  process: {
    uptimeSeconds: number
    nodeVersion: string
    pid: number
    memory: {
      rss?: number
      heapTotal?: number
      heapUsed?: number
      external?: number
    }
  }
  api: {
    name: string
    version: string
  }
}

export type EmbeddingAnchorDetector =
  | "emergencyDetector"
  | "abuseNeglectDetector"
  | "financialExploitationDetector"
  | "relationshipPatternDetector"

export interface EmbeddingAnchorPhraseRow {
  _id: string
  detector: EmbeddingAnchorDetector
  category: string | null
  bucket: string
  phrase: string
  order: number
  isActive: boolean
  emergencySeverity?: "CRITICAL" | "HIGH" | "MEDIUM" | null
  emergencyCategory?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface EmbeddingAnchorMergeResponse {
  merged: number
}

export interface CorpEmailForwardStaffRow {
  caregiverId: string | null
  name: string
  loginEmail: string | null
  corpEmail: string
  forwardToEmail: string | null
  updatedAt?: string | null
}

export interface CorpEmailForwardsListResponse {
  domain: string
  zohoConfigured: boolean
  staff: CorpEmailForwardStaffRow[]
}

export interface SaveCorpEmailForwardsResult {
  corpEmail: string
  forwardToEmail?: string | null
  forwardChanged?: boolean
  notificationSent?: boolean
  zoho?: { synced: boolean; reason?: string }
  ok: boolean
  error?: string
}

export interface SaveCorpEmailForwardsResponse {
  results: SaveCorpEmailForwardsResult[]
}

export type BreachLogStatus =
  | "INVESTIGATING"
  | "FALSE_POSITIVE"
  | "SECURITY_EVENT_CONFIRMED"
  | "BREACH_CONFIRMED"
  | "CLOSED"
  | "CONFIRMED"
  | "MITIGATED"
  | "RESOLVED"

export interface BreachLogSummary {
  id: string
  type: string
  severity: string
  status: BreachLogStatus
  jurisdiction: string
  organizationCountry?: string | null
  detectedAt: string
  details: string
  ipAddress?: string | null
  userId?: string | null
  userName?: string | null
  userEmail?: string | null
  userRole?: string | null
  orgId?: string | null
  orgName?: string | null
  affectedResourceType?: string | null
  affectedResourceIds?: string[]
  affectedCount?: number
  notificationDeadline?: string | null
  requiresHHSNotification?: boolean
  requiresPrivacyCommissionerNotification?: boolean
  resolvedAt?: string | null
  resolvedBy?: string | null
  resolutionReason?: string | null
  resolutionNotes?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface BreachLogListResponse {
  results: BreachLogSummary[]
  page: number
  limit: number
  totalPages: number
  totalResults: number
}

export interface BreachLogStatusHistoryEntry {
  status: string
  changedAt: string
  changedBy?: string | null
  notes?: string | null
  resolutionReason?: string | null
}

export interface BreachLogRelatedAuditLog {
  id: string
  timestamp: string
  action: string
  resource: string
  resourceId: string
  outcome: string
  ipAddress: string
  userRole?: string
}

export interface BreachLogDetail extends Omit<BreachLogSummary, "resolvedBy"> {
  userAgent?: string | null
  evidence?: string | null
  alertSnapshot?: { subject?: string; text?: string } | null
  statusHistory: BreachLogStatusHistoryEntry[]
  resolvedBy?: { id?: string; name?: string; email?: string } | null
  org?: { id?: string; name?: string; timezone?: string | null; country?: string | null } | null
  relatedAuditLogs: BreachLogRelatedAuditLog[]
  mitigationSteps?: unknown[]
  rootCause?: string | null
  preventiveMeasures?: string | null
}

export interface UpdateBreachLogStatusBody {
  status: BreachLogStatus
  resolutionNotes?: string
  resolutionReason?: string
}

export interface HipaaBackupRow {
  key: string
  backupType: string
  fileName: string
  sizeBytes: number
  lastModified: string | null
  storageClass: string
}

export interface HipaaBackupsListResponse {
  environment: string
  bucket: string
  backups: HipaaBackupRow[]
  total: number
}

export interface HipaaBackupTriggerResponse {
  environment: string
  backupType: string
  success?: boolean
  backupId?: string
  s3Key?: string
  sizeMB?: string
  timestamp?: string
}

export interface HipaaBackupRestoreResponse {
  environment: string
  backupKey: string
  success?: boolean
  backupRestored?: string
  timestamp?: string
}
