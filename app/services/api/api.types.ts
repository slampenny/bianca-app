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

export type CreatedModel = "Patient" | "Caregiver" | "Org"
export type AlertVisibility = "orgAdmin" | "allCaregivers" | "assignedCaregivers"
export type AlertImportance = "low" | "medium" | "high"

export interface Alert {
  id?: string
  message: string
  importance: AlertImportance
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

export interface Message {
  id?: string
  role: string
  content: string
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
