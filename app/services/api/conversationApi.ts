import { createApi } from "@reduxjs/toolkit/query/react"
import { Conversation, ConversationPages } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"

export const conversationApi = createApi({
  reducerPath: "conversationApi",
  baseQuery: baseQueryWithReauth(),
  endpoints: (builder) => ({
    createConversation: builder.mutation<
      Conversation,
      { patientId: string; data: Partial<Conversation> }
    >({
      query: ({ patientId, data }) => ({
        url: `/conversations/patient/${patientId}`,
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
    getConversationsByPatient: builder.query<
      ConversationPages,
      { patientId: string; page?: number; limit?: number; sortBy?: string }
    >({
      query: ({ patientId, page, limit, sortBy }) => ({
        url: `/patients/${patientId}/conversations`,
        params: {
          ...(page && { page }),
          ...(limit && { limit }),
          ...(sortBy && { sortBy }),
        },
      }),
      transformResponse: (response: ConversationPages) => {
        console.log('[ConversationApi] Raw API response:', {
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
  useGetConversationsByPatientQuery,
} = conversationApi
