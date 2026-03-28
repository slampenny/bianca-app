import { createApi } from "@reduxjs/toolkit/query/react"
import type { ConversationPages } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"

export const conversationApi = createApi({
  reducerPath: "conversationApi",
  baseQuery: baseQueryWithReauth(),
  endpoints: (builder) => ({
    getConversationsByClient: builder.query<
      ConversationPages,
      { clientId: string; page?: number; limit?: number; sortBy?: string }
    >({
      query: ({ clientId, page, limit, sortBy }) => ({
        url: `/clients/${clientId}/conversations`,
        params: {
          ...(page != null && { page }),
          ...(limit != null && { limit }),
          ...(sortBy && { sortBy }),
        },
      }),
    }),
  }),
})

export const { useGetConversationsByClientQuery } = conversationApi
