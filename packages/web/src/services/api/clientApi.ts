import { createApi } from "@reduxjs/toolkit/query/react"
import type { Client, ClientOnboardingDashboard, ClientPages, ClientOnboardingRollup } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"

export const clientApi = createApi({
  reducerPath: "clientApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["Client", "OnboardingRollup"],
  endpoints: (builder) => ({
    getAllClients: builder.query<
      ClientPages,
      { name?: string; role?: string; sortBy?: string; limit?: number; page?: number }
    >({
      query: (params) => ({
        url: "/clients",
        method: "GET",
        params,
      }),
      providesTags: ["Client"],
    }),
    getClient: builder.query<Client, { id: string }>({
      query: ({ id }) => `/clients/${id}`,
      providesTags: (_r, _e, { id }) => [{ type: "Client", id }],
    }),
    getClientOnboarding: builder.query<ClientOnboardingDashboard, { clientId: string; day?: number }>({
      query: ({ clientId, day }) => ({
        url: `/clients/${clientId}/onboarding`,
        params: day != null && day >= 1 && day <= 4 ? { day } : undefined,
      }),
      providesTags: (_r, _e, { clientId }) => [{ type: "Client", id: clientId }, "OnboardingRollup"],
    }),
    getClientsOnboardingRollups: builder.query<{ rollups: Record<string, ClientOnboardingRollup> }, void>({
      query: () => "/clients/onboarding-rollups",
      providesTags: ["OnboardingRollup"],
    }),
    /** Public — used from /client-consent (email link). GET does not require auth. */
    verifyConsent: builder.mutation<
      { success: boolean; message: string; alreadyConsented?: boolean },
      { token: string }
    >({
      query: ({ token }) => ({
        url: `/clients/consent/verify`,
        method: "GET",
        params: { token },
        headers: { Accept: "application/json" },
      }),
    }),
    createClient: builder.mutation<
      Client,
      {
        firstName: string
        lastName?: string
        preferredName?: string
        email: string
        phone: string
        preferredLanguage?: string
        room?: string
      }
    >({
      query: (body) => ({ url: "/clients", method: "POST", body }),
      invalidatesTags: ["Client"],
    }),
    patchClient: builder.mutation<
      Client,
      {
        clientId: string
        body: Partial<
          Pick<
            Client,
            | "name"
            | "firstName"
            | "lastName"
            | "preferredName"
            | "age"
            | "notes"
            | "email"
            | "phone"
            | "preferredLanguage"
            | "room"
            | "moveInDate"
            | "emergencyContact"
          >
        >
      }
    >({
      query: ({ clientId, body }) => ({
        url: `/clients/${clientId}`,
        method: "PATCH",
        body,
      }),
      async onQueryStarted({ clientId, body }, { dispatch, getState, queryFulfilled }) {
        const detailPatch = dispatch(
          clientApi.util.updateQueryData("getClient", { id: clientId }, (draft) => {
            Object.assign(draft, body)
          }),
        )
        const allClientsArgs = clientApi.util.selectCachedArgsForQuery(
          getState() as unknown as Parameters<typeof clientApi.util.selectCachedArgsForQuery>[0],
          "getAllClients",
        )
        const listPatches = allClientsArgs.map((args) =>
          dispatch(
            clientApi.util.updateQueryData("getAllClients", args, (draft) => {
              const row = draft.results.find((c) => String(c.id ?? "") === clientId)
              if (row) Object.assign(row, body)
            }),
          ),
        )
        try {
          await queryFulfilled
        } catch {
          detailPatch.undo()
          listPatches.forEach((p) => p.undo())
        }
      },
      invalidatesTags: (_r, _e, { clientId }) => [{ type: "Client", id: clientId }, "Client"],
    }),
    uploadClientAvatar: builder.mutation<Client, { clientId: string; file: File }>({
      query: ({ clientId, file }) => {
        const body = new FormData()
        body.append("avatar", file)
        return {
          url: `/clients/${clientId}/avatar`,
          method: "POST",
          body,
        }
      },
      invalidatesTags: (_r, _e, { clientId }) => [{ type: "Client", id: clientId }, "Client"],
    }),
    deleteClient: builder.mutation<void, { clientId: string }>({
      query: ({ clientId }) => ({
        url: `/clients/${clientId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Client"],
    }),
    assignCaregiverToClient: builder.mutation<Client, { clientId: string; caregiverId: string }>({
      query: ({ clientId, caregiverId }) => ({
        url: `/clients/${clientId}/caregivers/${caregiverId}`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, { clientId }) => [{ type: "Client", id: clientId }, "Client"],
    }),
    removeCaregiverFromClient: builder.mutation<Client, { clientId: string; caregiverId: string }>({
      query: ({ clientId, caregiverId }) => ({
        url: `/clients/${clientId}/caregivers/${caregiverId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { clientId }) => [{ type: "Client", id: clientId }, "Client"],
    }),
  }),
})

export const {
  useGetAllClientsQuery,
  useGetClientQuery,
  useGetClientOnboardingQuery,
  useGetClientsOnboardingRollupsQuery,
  useVerifyConsentMutation,
  useCreateClientMutation,
  usePatchClientMutation,
  useUploadClientAvatarMutation,
  useDeleteClientMutation,
  useAssignCaregiverToClientMutation,
  useRemoveCaregiverFromClientMutation,
} = clientApi
