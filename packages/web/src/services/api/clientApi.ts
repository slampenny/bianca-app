import { createApi } from "@reduxjs/toolkit/query/react"
import type { Client, ClientPages } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"

export const clientApi = createApi({
  reducerPath: "clientApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["Client"],
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
      { name: string; email: string; phone: string; preferredLanguage?: string }
    >({
      query: (body) => ({ url: "/clients", method: "POST", body }),
      invalidatesTags: ["Client"],
    }),
    assignCaregiverToClient: builder.mutation<Client, { clientId: string; caregiverId: string }>({
      query: ({ clientId, caregiverId }) => ({
        url: `/clients/${clientId}/caregivers/${caregiverId}`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, { clientId }) => [{ type: "Client", id: clientId }, "Client"],
    }),
  }),
})

export const {
  useGetAllClientsQuery,
  useGetClientQuery,
  useVerifyConsentMutation,
  useCreateClientMutation,
  useAssignCaregiverToClientMutation,
} = clientApi
