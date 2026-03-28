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
  }),
})

export const { useGetAllClientsQuery, useGetClientQuery } = clientApi
