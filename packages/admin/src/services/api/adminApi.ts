import { createApi } from "@reduxjs/toolkit/query/react"
import type {
  AdminCaregiverSearchResponse,
  AdminCaregiverSearchRow,
  AdminOrgSearchResponse,
  AdminOrgDetail,
  BreachLogDetail,
  BreachLogListResponse,
  UpdateBreachLogStatusBody,
  CorpEmailForwardsListResponse,
  EmbeddingAnchorMergeResponse,
  EmbeddingAnchorPhraseRow,
  ImpersonateResponse,
  HipaaBackupRestoreResponse,
  HipaaBackupsListResponse,
  HipaaBackupTriggerResponse,
  ObservabilityPayload,
  SaveCorpEmailForwardsResponse,
  ScimAdminStatus,
  ScimTokenIssueResponse,
  VoiceOnboardingConfig,
  VoiceOnboardingDay,
  VoiceOnboardingPlan,
} from "./api.types"
import baseQueryWithAuth from "./baseQueryWithAuth"

export const adminApi = createApi({
  reducerPath: "adminApi",
  baseQuery: baseQueryWithAuth(),
  tagTypes: ["Observability", "Scim", "EmbeddingAnchors", "OrgDetail", "CorpEmailForwards", "BreachLogs", "Backups"],
  endpoints: (builder) => ({
    getObservability: builder.query<ObservabilityPayload, void>({
      query: () => ({
        url: "/admin/observability",
        method: "GET",
      }),
      providesTags: ["Observability"],
    }),
    searchCaregivers: builder.query<AdminCaregiverSearchResponse, { q: string; page?: number; limit?: number }>({
      query: ({ q, page = 1, limit = 20 }) => ({
        url: "/admin/caregivers",
        method: "GET",
        params: { q, page, limit },
      }),
    }),
    searchOrgs: builder.query<AdminOrgSearchResponse, { q: string; page?: number; limit?: number }>({
      query: ({ q, page = 1, limit = 20 }) => ({
        url: "/admin/orgs",
        method: "GET",
        params: { q, page, limit },
      }),
    }),
    getOrg: builder.query<AdminOrgDetail, string>({
      query: (orgId) => ({
        url: `/orgs/${orgId}`,
        method: "GET",
      }),
      providesTags: (_r, _e, orgId) => [{ type: "OrgDetail", id: orgId }],
    }),
    getDefaultVoiceOnboardingPlan: builder.query<{ plan: VoiceOnboardingPlan }, void>({
      query: () => ({
        url: "/admin/onboarding/default-plan",
        method: "GET",
      }),
    }),
    patchOrg: builder.mutation<
      AdminOrgDetail,
      {
        orgId: string
        body: {
          debugAudioUploadEnabled?: boolean
          voiceOnboarding?: VoiceOnboardingConfig
        }
      }
    >({
      query: ({ orgId, body }) => ({
        url: `/orgs/${orgId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_r, _e, { orgId }) => [{ type: "OrgDetail", id: orgId }],
    }),
    getOrgScimStatus: builder.query<ScimAdminStatus, string>({
      query: (orgId) => ({
        url: `/admin/orgs/${orgId}/scim`,
        method: "GET",
      }),
      providesTags: (_result, _err, orgId) => [{ type: "Scim", id: orgId }],
    }),
    issueOrgScimToken: builder.mutation<ScimTokenIssueResponse, string>({
      query: (orgId) => ({
        url: `/admin/orgs/${orgId}/scim/token`,
        method: "POST",
      }),
      invalidatesTags: (_result, _err, orgId) => [{ type: "Scim", id: orgId }],
    }),
    disableOrgScim: builder.mutation<void, string>({
      query: (orgId) => ({
        url: `/admin/orgs/${orgId}/scim`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _err, orgId) => [{ type: "Scim", id: orgId }],
    }),
    impersonateCaregiver: builder.mutation<ImpersonateResponse, { caregiverId: string }>({
      query: (body) => ({
        url: "/admin/impersonate",
        method: "POST",
        body,
      }),
    }),
    updateCaregiverRole: builder.mutation<
      AdminCaregiverSearchRow,
      { caregiverId: string; role: "superAdmin" | "orgAdmin" }
    >({
      query: ({ caregiverId, role }) => ({
        url: `/admin/caregivers/${caregiverId}/role`,
        method: "PATCH",
        body: { role },
      }),
    }),
    sendSuperAdminInvite: builder.mutation<
      AdminCaregiverSearchRow,
      { name: string; email: string; phone: string }
    >({
      query: (body) => ({
        url: "/admin/superadmin-invites",
        method: "POST",
        body,
      }),
    }),
    getEmbeddingAnchorPhrases: builder.query<EmbeddingAnchorPhraseRow[], { detector?: string } | void>({
      query: (params) => ({
        url: "/admin/embedding-anchors",
        method: "GET",
        params: params && params.detector ? { detector: params.detector } : undefined,
      }),
      providesTags: ["EmbeddingAnchors"],
    }),
    createEmbeddingAnchorPhrase: builder.mutation<EmbeddingAnchorPhraseRow, Partial<EmbeddingAnchorPhraseRow>>({
      query: (body) => ({
        url: "/admin/embedding-anchors",
        method: "POST",
        body,
      }),
      invalidatesTags: ["EmbeddingAnchors"],
    }),
    updateEmbeddingAnchorPhrase: builder.mutation<
      EmbeddingAnchorPhraseRow,
      { phraseId: string; body: Partial<EmbeddingAnchorPhraseRow> }
    >({
      query: ({ phraseId, body }) => ({
        url: `/admin/embedding-anchors/${phraseId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["EmbeddingAnchors"],
    }),
    deleteEmbeddingAnchorPhrase: builder.mutation<{ deleted: boolean; id: string }, string>({
      query: (phraseId) => ({
        url: `/admin/embedding-anchors/${phraseId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["EmbeddingAnchors"],
    }),
    mergeEmbeddingAnchorDefaults: builder.mutation<EmbeddingAnchorMergeResponse, void>({
      query: () => ({
        url: "/admin/embedding-anchors/merge-defaults",
        method: "POST",
      }),
      invalidatesTags: ["EmbeddingAnchors"],
    }),
    getCorpEmailForwards: builder.query<CorpEmailForwardsListResponse, void>({
      query: () => ({
        url: "/admin/corp-email-forwards",
        method: "GET",
      }),
      providesTags: ["CorpEmailForwards"],
    }),
    saveCorpEmailForwards: builder.mutation<
      SaveCorpEmailForwardsResponse,
      {
        forwards: Array<{
          caregiverId?: string
          corpEmail: string
          forwardToEmail: string | null
        }>
      }
    >({
      query: (body) => ({
        url: "/admin/corp-email-forwards",
        method: "PUT",
        body,
      }),
      invalidatesTags: ["CorpEmailForwards"],
    }),
    listBreachLogs: builder.query<
      BreachLogListResponse,
      {
        page?: number
        limit?: number
        status?: string
        type?: string
        severity?: string
        jurisdiction?: string
        orgId?: string
        userId?: string
        startDate?: string
        endDate?: string
      }
    >({
      query: (params) => ({
        url: "/admin/breach-logs",
        method: "GET",
        params,
      }),
      providesTags: ["BreachLogs"],
    }),
    getBreachLog: builder.query<BreachLogDetail, string>({
      query: (id) => ({
        url: `/admin/breach-logs/${id}`,
        method: "GET",
      }),
      providesTags: (_r, _e, id) => [{ type: "BreachLogs", id }],
    }),
    updateBreachLogStatus: builder.mutation<
      BreachLogDetail,
      { id: string; body: UpdateBreachLogStatusBody }
    >({
      query: ({ id, body }) => ({
        url: `/admin/breach-logs/${id}/status`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "BreachLogs", id }, "BreachLogs"],
    }),
    listBackups: builder.query<HipaaBackupsListResponse, { prefix?: string; limit?: number } | void>({
      query: (params) => ({
        url: "/admin/backups",
        method: "GET",
        params: params || {},
      }),
      providesTags: ["Backups"],
    }),
    triggerBackup: builder.mutation<HipaaBackupTriggerResponse, { backupType?: "daily" | "weekly" | "monthly" }>({
      query: (body) => ({
        url: "/admin/backups/trigger",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Backups"],
    }),
    restoreBackup: builder.mutation<
      HipaaBackupRestoreResponse,
      { backupKey: string; confirmRestore: "YES_I_WANT_TO_RESTORE" }
    >({
      query: (body) => ({
        url: "/admin/backups/restore",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Backups"],
    }),
  }),
})

export const {
  useGetObservabilityQuery,
  useLazyGetObservabilityQuery,
  useLazySearchCaregiversQuery,
  useLazySearchOrgsQuery,
  useGetOrgScimStatusQuery,
  useIssueOrgScimTokenMutation,
  useDisableOrgScimMutation,
  useImpersonateCaregiverMutation,
  useUpdateCaregiverRoleMutation,
  useSendSuperAdminInviteMutation,
  useGetEmbeddingAnchorPhrasesQuery,
  useCreateEmbeddingAnchorPhraseMutation,
  useUpdateEmbeddingAnchorPhraseMutation,
  useDeleteEmbeddingAnchorPhraseMutation,
  useMergeEmbeddingAnchorDefaultsMutation,
  useGetOrgQuery,
  useGetDefaultVoiceOnboardingPlanQuery,
  usePatchOrgMutation,
  useGetCorpEmailForwardsQuery,
  useSaveCorpEmailForwardsMutation,
  useListBreachLogsQuery,
  useGetBreachLogQuery,
  useUpdateBreachLogStatusMutation,
  useListBackupsQuery,
  useTriggerBackupMutation,
  useRestoreBackupMutation,
} = adminApi
