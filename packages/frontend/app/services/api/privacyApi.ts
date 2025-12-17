import { createApi } from "@reduxjs/toolkit/query/react"
import baseQueryWithReauth from "./baseQueryWithAuth"
import { logger } from "../../utils/logger"

export interface PrivacyRequest {
  _id?: string
  id?: string
  requestType: "access" | "correction"
  requestorId: string
  requestorModel: string
  informationRequested: string
  status: "pending" | "processing" | "completed" | "denied"
  requestDate?: string
  responseDeadline?: string
  responseDate?: string
  accessMethod?: "email" | "download" | "mail"
  correctionDetails?: {
    field: string
    currentValue: string
    requestedValue: string
    reason: string
  }
  informationProvided?: any[]
  createdAt?: string
  updatedAt?: string
}

export interface PrivacyRequestPages {
  limit: number
  page: number
  results: PrivacyRequest[]
  totalPages: number
  totalResults: number
}

export interface ConsentRecord {
  _id?: string
  id?: string
  userId: string
  userModel: string
  consentType: "collection" | "use" | "disclosure" | "recording"
  purpose: string
  granted: boolean
  withdrawn: boolean
  method: "explicit" | "implied"
  createdAt?: string
  withdrawnAt?: string
}

export interface PrivacyComplaint {
  _id?: string
  id?: string
  complaintType: "PIPEDA" | "HIPAA" | "GENERAL"
  complainantType: "caregiver" | "patient" | "external"
  complainantId: string
  subject: string
  description: string
  violationType: "unauthorized_access" | "unauthorized_disclosure" | "incorrect_information" | "denied_access" | "denied_correction" | "consent_issue" | "retention_issue" | "breach_notification" | "complaint_handling" | "other"
  status: "submitted" | "acknowledged" | "investigating" | "resolved" | "dismissed"
  complaintDate?: string
  acknowledgedAt?: string
  resolvedAt?: string
  resolution?: string
  organizationCountry?: string
  createdAt?: string
  updatedAt?: string
}

export interface PrivacyComplaintPages {
  limit: number
  page: number
  results: PrivacyComplaint[]
  totalPages: number
  totalResults: number
}

export const privacyApi = createApi({
  reducerPath: "privacyApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["PrivacyRequest", "ConsentRecord", "PrivacyComplaint"],
  endpoints: (builder) => ({
    // Create access request
    createAccessRequest: builder.mutation<
      PrivacyRequest,
      { informationRequested?: string; accessMethod?: "email" | "download" | "mail" }
    >({
      query: (body) => {
        logger.debug("[privacyApi] createAccessRequest called with:", body)
        return {
          url: "/privacy/requests/access",
          method: "POST",
          body: {
            informationRequested: body.informationRequested || "All my personal information",
            accessMethod: body.accessMethod || "email",
          },
        }
      },
      invalidatesTags: [{ type: "PrivacyRequest", id: "LIST" }],
    }),

    // Create correction request
    createCorrectionRequest: builder.mutation<
      PrivacyRequest,
      {
        informationRequested: string
        correctionDetails: {
          field: string
          currentValue: string
          requestedValue: string
          reason: string
        }
      }
    >({
      query: (body) => {
        logger.debug("[privacyApi] createCorrectionRequest called with:", body)
        return {
          url: "/privacy/requests/correction",
          method: "POST",
          body,
        }
      },
      invalidatesTags: [{ type: "PrivacyRequest", id: "LIST" }],
    }),

    // Get privacy requests (paginated)
    getPrivacyRequests: builder.query<
      PrivacyRequestPages,
      { page?: number; limit?: number }
    >({
      query: (params) => {
        logger.debug("[privacyApi] getPrivacyRequests called with params:", params)
        return {
          url: "/privacy/requests",
          method: "GET",
          params: {
            page: params.page || 1,
            limit: params.limit || 10,
          },
        }
      },
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ _id, id }) => ({ type: "PrivacyRequest" as const, id: _id || id })),
              { type: "PrivacyRequest" as const, id: "LIST" },
            ]
          : [{ type: "PrivacyRequest" as const, id: "LIST" }],
    }),

    // Get single privacy request
    getPrivacyRequest: builder.query<PrivacyRequest, { requestId: string }>({
      query: ({ requestId }) => {
        logger.debug("[privacyApi] getPrivacyRequest called for requestId:", requestId)
        return {
          url: `/privacy/requests/${requestId}`,
          method: "GET",
        }
      },
      providesTags: (result, error, { requestId }) => [
        { type: "PrivacyRequest", id: requestId },
      ],
    }),

    // Get active consent
    getActiveConsent: builder.query<
      ConsentRecord[],
      { consentType?: string }
    >({
      query: (params) => {
        logger.debug("[privacyApi] getActiveConsent called with params:", params)
        return {
          url: "/privacy/consent",
          method: "GET",
          params: params.consentType ? { consentType: params.consentType } : {},
        }
      },
      providesTags: ["ConsentRecord"],
    }),

    // Check consent
    checkConsent: builder.query<
      { hasConsent: boolean },
      { consentType: string; purpose: string }
    >({
      query: (params) => {
        logger.debug("[privacyApi] checkConsent called with params:", params)
        return {
          url: "/privacy/consent/check",
          method: "GET",
          params,
        }
      },
    }),

    // Get consent history
    getConsentHistory: builder.query<ConsentRecord[], void>({
      query: () => {
        logger.debug("[privacyApi] getConsentHistory called")
        return {
          url: "/privacy/consent/history",
          method: "GET",
        }
      },
      providesTags: ["ConsentRecord"],
    }),

    // Withdraw consent
    withdrawConsent: builder.mutation<
      ConsentRecord,
      {
        consentId: string
        withdrawalMethod?: string
        withdrawalReason?: string
      }
    >({
      query: ({ consentId, withdrawalMethod, withdrawalReason }) => {
        logger.debug("[privacyApi] withdrawConsent called for consentId:", consentId)
        return {
          url: `/privacy/consent/${consentId}/withdraw`,
          method: "POST",
          body: {
            withdrawalMethod: withdrawalMethod || "app",
            withdrawalReason: withdrawalReason || "User requested withdrawal",
          },
        }
      },
      invalidatesTags: ["ConsentRecord"],
    }),

    // Create privacy complaint
    createComplaint: builder.mutation<
      PrivacyComplaint,
      {
        subject: string
        description: string
        violationType?: string
      }
    >({
      query: (body) => {
        logger.debug("[privacyApi] createComplaint called with:", body)
        return {
          url: "/privacy/complaints",
          method: "POST",
          body: {
            subject: body.subject,
            description: body.description,
            violationType: body.violationType || "other",
          },
        }
      },
      invalidatesTags: ["PrivacyComplaint"],
    }),

    // Get privacy complaints (paginated)
    getComplaints: builder.query<
      PrivacyComplaintPages,
      { page?: number; limit?: number }
    >({
      query: (params) => {
        logger.debug("[privacyApi] getComplaints called with params:", params)
        return {
          url: "/privacy/complaints",
          method: "GET",
          params: {
            page: params.page || 1,
            limit: params.limit || 10,
          },
        }
      },
      providesTags: ["PrivacyComplaint"],
    }),

    // Get single privacy complaint
    getComplaint: builder.query<PrivacyComplaint, { complaintId: string }>({
      query: ({ complaintId }) => {
        logger.debug("[privacyApi] getComplaint called for complaintId:", complaintId)
        return {
          url: `/privacy/complaints/${complaintId}`,
          method: "GET",
        }
      },
      providesTags: (result, error, { complaintId }) => [
        { type: "PrivacyComplaint", id: complaintId },
      ],
    }),

    // Request data deletion
    requestDataDeletion: builder.mutation<
      { deleted: any; country: string; jurisdiction: string },
      { dataType?: "all" | "calls" | "conversations" | "medicalAnalysis" }
    >({
      query: (body) => {
        logger.debug("[privacyApi] requestDataDeletion called with:", body)
        return {
          url: "/privacy/deletion",
          method: "POST",
          body: {
            dataType: body.dataType || "all",
          },
        }
      },
      invalidatesTags: [{ type: "PrivacyRequest", id: "LIST" }],
    }),
  }),
})

export const {
  useCreateAccessRequestMutation,
  useCreateCorrectionRequestMutation,
  useGetPrivacyRequestsQuery,
  useGetPrivacyRequestQuery,
  useGetActiveConsentQuery,
  useCheckConsentQuery,
  useGetConsentHistoryQuery,
  useWithdrawConsentMutation,
  useCreateComplaintMutation,
  useGetComplaintsQuery,
  useGetComplaintQuery,
  useRequestDataDeletionMutation,
} = privacyApi


