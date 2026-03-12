import { createApi } from "@reduxjs/toolkit/query/react"
import { Conversation, ConversationPages } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"
import { logger } from "../../utils/logger"

export const conversationApi = createApi({
  reducerPath: "conversationApi",
  baseQuery: baseQueryWithReauth(),
  endpoints: (builder) => ({
    createConversation: builder.mutation<
      Conversation,
      { clientId: string; data: Partial<Conversation> }
    >({
      query: ({ clientId, data }) => ({
        url: `/conversations/client/${clientId}`,
        method: "POST",
        body: data,
      }),
    }),
    addMessageToConversation: builder.mutation<
      Conversation,
      { conversationId: string; role: string; content: string }
    >({
      query: ({ conversationId, role, content }) => ({
        url: `/conversations/${conversationId}`,
        method: "POST",
        body: { role, content },
      }),
    }),
    getConversation: builder.query<Conversation, { conversationId: string }>({
      query: ({ conversationId }) => ({
        url: `/conversations/${conversationId}`,
      }),
    }),
    getConversationsByClient: builder.query<
      ConversationPages,
      { clientId: string; page?: number; limit?: number; sortBy?: string }
    >({
      query: ({ clientId, page, limit, sortBy }) => ({
        url: `/clients/${clientId}/conversations`,
        params: {
          ...(page && { page }),
          ...(limit && { limit }),
          ...(sortBy && { sortBy }),
        },
      }),
      transformResponse: (response: ConversationPages) => {
        logger.debug('[ConversationApi] Raw API response:', {
          page: response.page,
          totalPages: response.totalPages,
          totalResults: response.totalResults,
          resultsCount: response.results?.length || 0,
          conversationIds: response.results?.map(c => ({ id: c.id, status: c.status, startTime: c.startTime })) || []
        });
        return response;
      },
    }),
  }),
})

export const {
  useCreateConversationMutation,
  useAddMessageToConversationMutation,
  useGetConversationQuery,
  useGetConversationsByClientQuery,
} = conversationApi
