import { createApi } from "@reduxjs/toolkit/query/react"
import type { ConversationDetail, ConversationPages } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"

export const conversationApi = createApi({
  reducerPath: "conversationApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["ClientConversations"],
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
      providesTags: (_result, _err, { clientId }) => [
        { type: "ClientConversations" as const, id: clientId },
        { type: "ClientConversations" as const, id: "LIST" },
      ],
    }),
    getConversationById: builder.query<ConversationDetail, string>({
      query: (conversationId) => ({
        url: `/conversations/${encodeURIComponent(conversationId)}`,
        method: "GET",
      }),
    }),
  }),
})

export const { useGetConversationsByClientQuery, useGetConversationByIdQuery } = conversationApi
