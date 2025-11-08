import { createApi } from "@reduxjs/toolkit/query/react"
import { Org, OrgPages, Caregiver } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"
import { logger } from "../../utils/logger"

export const orgApi = createApi({
  reducerPath: "orgApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["Org", "Caregiver"],
  endpoints: (builder) => ({
    getAllOrgs: builder.query<
      OrgPages,
      { name?: string; role?: string; sortBy?: string; limit?: number; page?: number }
    >({
      query: (params) => {
        logger.debug("[orgApi] getAllOrgs query called with params:", params)
        return {
          url: `/orgs`,
          method: "GET",
          params,
        }
      },
    }),
    getOrg: builder.query<Org, { orgId: string }>({
      query: ({ orgId }) => {
        logger.debug("[orgApi] getOrg query called for orgId:", orgId)
        return `/orgs/${orgId}`
      },
    }),
    updateOrg: builder.mutation<{ org: Org }, { orgId: string; org: any }>({
      query: ({ orgId, org }) => {
        logger.debug("[orgApi] updateOrg mutation called for orgId:", orgId, "with org:", org)
        return {
          url: `/orgs/${orgId}`,
          method: "PATCH",
          body: org,
        }
      },
    }),
    deleteOrg: builder.mutation<void, { orgId: string }>({
      query: ({ orgId }) => {
        logger.debug("[orgApi] deleteOrg mutation called for orgId:", orgId)
        return {
          url: `/orgs/${orgId}`,
          method: "DELETE",
        }
      },
    }),
    addCaregiver: builder.mutation<void, { orgId: string; caregiverId: string }>({
      query: ({ orgId, caregiverId }) => {
        logger.debug(
          "[orgApi] addCaregiver mutation called for orgId:",
          orgId,
          "caregiverId:",
          caregiverId,
        )
        return {
          url: `/orgs/${orgId}/caregiver/${caregiverId}`,
          method: "POST",
        }
      },
      invalidatesTags: ["Caregiver"],
    }),
    removeCaregiver: builder.mutation<Caregiver, { orgId: string; caregiverId: string }>({
      query: ({ orgId, caregiverId }) => {
        logger.debug(
          "[orgApi] removeCaregiver mutation called for orgId:",
          orgId,
          "caregiverId:",
          caregiverId,
        )
        return {
          url: `/orgs/${orgId}/caregiver/${caregiverId}`,
          method: "DELETE",
        }
      },
      invalidatesTags: ["Caregiver"],
    }),
    setRole: builder.mutation<void, { orgId: string; caregiverId: string; role: string }>({
      query: ({ orgId, caregiverId, role }) => {
        logger.debug(
          "[orgApi] setRole mutation called for orgId:",
          orgId,
          "caregiverId:",
          caregiverId,
          "role:",
          role,
        )
        return {
          url: `/orgs/${orgId}/caregiver/${caregiverId}/role`,
          method: "PATCH",
          body: { role },
        }
      },
    }),
    sendInvite: builder.mutation<
      { caregiver: Caregiver; token: string },
      { orgId: string; name: string; email: string; phone: string }
    >({
      query: ({ orgId, name, email, phone }) => {
        logger.debug(
          "[orgApi] sendInvite mutation called for orgId:",
          orgId,
          "with name:",
          name,
          "email:",
          email,
          "phone:",
          phone,
        )
        return {
          url: `/orgs/${orgId}/invite`,
          method: "PATCH",
          body: { name, email, phone },
        }
      },
      invalidatesTags: ["Caregiver"],
    }),
    verifyInvite: builder.mutation<void, { orgId: string; token: string }>({
      query: ({ orgId, token }) => {
        logger.debug("[orgApi] verifyInvite mutation called for orgId:", orgId, "token:", token)
        return {
          url: `/orgs/${orgId}/verify-invite/${token}`,
          method: "PATCH",
        }
      },
    }),
  }),
})

export const {
  useGetAllOrgsQuery,
  useGetOrgQuery,
  useUpdateOrgMutation,
  useDeleteOrgMutation,
  useAddCaregiverMutation,
  useRemoveCaregiverMutation,
  useSetRoleMutation,
  useSendInviteMutation,
  useVerifyInviteMutation,
} = orgApi
