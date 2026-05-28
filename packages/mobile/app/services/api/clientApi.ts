import { createApi } from "@reduxjs/toolkit/query/react"
import {
  Client,
  ClientPages,
  Caregiver,
  ClientOnboardingPayload,
  Conversation,
  ConversationPages,
} from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"

// Lazy import to break circular dependency with clientSlice
const getSetClientsForCaregiver = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("../../store/clientSlice").setClientsForCaregiver
}

export const clientApi = createApi({
  reducerPath: "clientApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["Client"],
  endpoints: (builder) => ({
    createClient: builder.mutation<Client, { client: Partial<Client> }>({
      query: ({ client }) => {
        return {
          url: `/clients`,
          method: "POST",
          body: client,
        }
      },
      async onQueryStarted({ client }, { dispatch, getState, queryFulfilled }) {
        try {
          const { data: createdClient } = await queryFulfilled
          const state = getState() as any
          const currentUser = state?.auth?.currentUser || state?.auth?.user
          if (createdClient.caregivers && Array.isArray(createdClient.caregivers) && createdClient.caregivers.length > 0) {
            createdClient.caregivers.forEach((caregiverId: string) => {
              const userClients = state?.client?.clients?.[caregiverId] || []
              const existingIndex = userClients.findIndex((p: Client) => p.id === createdClient.id)
              if (existingIndex === -1) {
                const setClientsForCaregiver = getSetClientsForCaregiver()
                dispatch(setClientsForCaregiver({
                  caregiverId,
                  clients: [...userClients, createdClient],
                }))
              }
            })
          }
          if (currentUser && currentUser.id && createdClient) {
            const userClients = state?.client?.clients?.[currentUser.id] || []
            const existingIndex = userClients.findIndex((p: Client) => p.id === createdClient.id)
            if (existingIndex === -1) {
              const setClientsForCaregiver = getSetClientsForCaregiver()
              dispatch(setClientsForCaregiver({
                caregiverId: currentUser.id,
                clients: [...userClients, createdClient],
              }))
            }
          }
        } catch (error) {
          console.error("[API CALLBACK] Error in createClient onQueryStarted:", error)
        }
      },
    }),
    getAllClients: builder.query<
      ClientPages,
      { name?: string; role?: string; sortBy?: string; limit?: number; page?: number }
    >({
      query: (params) => ({
        url: `/clients`,
        method: "GET",
        params,
      }),
    }),
    getClient: builder.query<Client, { id: string }>({
      query: ({ id }) => `/clients/${id}`,
      providesTags: (result, error, { id }) => [{ type: "Client", id }],
    }),
    updateClient: builder.mutation<Client, { id: string; client: Partial<Client> }>({
      query: ({ id, client }) => {
        const { schedules, ...filteredClient } = client
        return {
          url: `/clients/${id}`,
          method: "PATCH",
          body: filteredClient,
        }
      },
    }),
    uploadClientAvatar: builder.mutation<Caregiver, { id: string; avatar: Blob | File }>({
      query: ({ id, avatar }) => {
        const formData = new FormData()
        formData.append("avatar", avatar, "avatar.jpg")
        return {
          url: `/clients/${id}/avatar`,
          method: "POST",
          body: formData,
          formData: true,
        }
      },
    }),
    deleteClient: builder.mutation<void, { id: string }>({
      query: ({ id }) => ({
        url: `/clients/${id}`,
        method: "DELETE",
      }),
    }),
    assignCaregiver: builder.mutation<Client, { clientId: string; caregiverId: string }>({
      query: ({ clientId, caregiverId }) => ({
        url: `/clients/${clientId}/caregivers/${caregiverId}`,
        method: "POST",
      }),
    }),
    unassignCaregiver: builder.mutation<Client, { clientId: string; caregiverId: string }>({
      query: ({ clientId, caregiverId }) => ({
        url: `/clients/${clientId}/caregivers/${caregiverId}`,
        method: "DELETE",
      }),
    }),
    getConversationsByClient: builder.query<
      ConversationPages,
      { clientId: string; page?: number; limit?: number; sortBy?: string }
    >({
      query: ({ clientId, page, limit, sortBy }) => {
        const params = new URLSearchParams()
        if (page) params.append("page", page.toString())
        if (limit) params.append("limit", limit.toString())
        if (sortBy) params.append("sortBy", sortBy)
        const queryString = params.toString()
        return {
          url: `/clients/${clientId}/conversations${queryString ? `?${queryString}` : ""}`,
          method: "GET",
        }
      },
    }),
    getClientOnboarding: builder.query<ClientOnboardingPayload, { clientId: string; day?: number }>({
      query: ({ clientId, day }) => {
        const qs = day != null && day >= 1 && day <= 4 ? `?day=${day}` : ""
        return {
          url: `/clients/${clientId}/onboarding${qs}`,
          method: "GET",
        }
      },
      providesTags: (result, error, { clientId }) => [{ type: "Client", id: `${clientId}-onboarding` }],
    }),
    getCaregivers: builder.query<Caregiver[], { clientId: string }>({
      query: ({ clientId }) => ({
        url: `/clients/${clientId}/caregivers`,
        method: "GET",
      }),
    }),
    getUnassignedClients: builder.query<Client[], void>({
      query: () => ({
        url: "/clients/unassigned",
        method: "GET",
      }),
    }),
    assignUnassignedClients: builder.mutation<
      Client[],
      { caregiverId: string; clientIds: string[] }
    >({
      query: ({ caregiverId, clientIds }) => ({
        url: "/clients/assign-unassigned",
        method: "POST",
        body: { caregiverId, clientIds },
      }),
    }),
    validateConsentToken: builder.query<
      {
        success: boolean
        valid: boolean
        clientName?: string
        orgName?: string
        consentedPurposes?: Record<string, boolean>
        purposes?: string[]
      },
      { token: string }
    >({
      query: ({ token }) => ({
        url: `/clients/consent/verify?token=${encodeURIComponent(token)}`,
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }),
    }),
    submitClientConsent: builder.mutation<
      {
        success: boolean
        message: string
        alreadyConsented?: boolean
        fullyConsented?: boolean
        grantedPurposes?: string[]
      },
      { token: string; purposes: string[] }
    >({
      query: ({ token, purposes }) => ({
        url: `/clients/consent/verify?token=${encodeURIComponent(token)}`,
        method: "POST",
        body: { purposes },
        headers: {
          Accept: "application/json",
        },
      }),
    }),
  }),
})

export const {
  useCreateClientMutation,
  useGetAllClientsQuery,
  useGetClientQuery,
  useGetClientOnboardingQuery,
  useUploadClientAvatarMutation,
  useUpdateClientMutation,
  useDeleteClientMutation,
  useAssignCaregiverMutation,
  useUnassignCaregiverMutation,
  useGetCaregiversQuery,
  useGetUnassignedClientsQuery,
  useAssignUnassignedClientsMutation,
  useLazyValidateConsentTokenQuery,
  useSubmitClientConsentMutation,
} = clientApi
