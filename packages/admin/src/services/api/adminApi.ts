import { createApi } from "@reduxjs/toolkit/query/react"
import type {
  AdminCaregiverSearchResponse,
  AdminCaregiverSearchRow,
  AdminOrgSearchResponse,
  ImpersonateResponse,
  ObservabilityPayload,
  ScimAdminStatus,
  ScimTokenIssueResponse,
} from "./api.types"
import baseQueryWithAuth from "./baseQueryWithAuth"

export const adminApi = createApi({
  reducerPath: "adminApi",
  baseQuery: baseQueryWithAuth(),
  tagTypes: ["Observability", "Scim"],
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
} = adminApi
