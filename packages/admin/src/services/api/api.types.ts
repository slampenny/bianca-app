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
export interface AdminOrgDetail {
  id?: string
  name: string
  email: string
  debugAudioUploadEnabled?: boolean
  timezone?: string
  country?: string
  requireClientConsent?: boolean
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
