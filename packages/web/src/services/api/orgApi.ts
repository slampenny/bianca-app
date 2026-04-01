import { createApi } from "@reduxjs/toolkit/query/react"
import type { Caregiver, Org } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"

export type OrgUpdatePayload = {
  name?: string
  email?: string
  phone?: string
  logo?: string | null
  timezone?: string
  country?: string
  requireClientConsent?: boolean
  callRetrySettings?: {
    retryCount: number
    retryIntervalMinutes: number
    alertOnAllMissedCalls: boolean
  }
}

export const orgApi = createApi({
  reducerPath: "orgApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["Org"],
  endpoints: (builder) => ({
    getOrg: builder.query<Org, { orgId: string }>({
      query: ({ orgId }) => `/orgs/${orgId}`,
      providesTags: (_r, _e, { orgId }) => [{ type: "Org", id: orgId }],
    }),
    updateOrg: builder.mutation<Org, { orgId: string; org: OrgUpdatePayload }>({
      query: ({ orgId, org }) => ({
        url: `/orgs/${orgId}`,
        method: "PATCH",
        body: org,
      }),
      invalidatesTags: (_r, _e, { orgId }) => [{ type: "Org", id: orgId }],
    }),
    sendOrgInvite: builder.mutation<
      Caregiver,
      { orgId: string; body: { name: string; email: string; phone: string } }
    >({
      query: ({ orgId, body }) => ({
        url: `/orgs/${orgId}/invite`,
        method: "PATCH",
        body,
      }),
    }),
  }),
})

export const { useGetOrgQuery, useUpdateOrgMutation, useSendOrgInviteMutation } = orgApi
