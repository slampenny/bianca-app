import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import { DEFAULT_API_CONFIG } from "./api"
import { RootState } from "../../store/store"
import { Conversation, ConversationPages } from "./api.types"

export const conversationApi = createApi({
  reducerPath: "conversationApi",
  baseQuery: fetchBaseQuery({
    baseUrl: DEFAULT_API_CONFIG.url,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.tokens?.access.token
      if (token) {
        headers.set("authorization", `Bearer ${token}`)
      }
      return headers
    },
  }),
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
      { conversationId: string; message: string }
    >({
      query: ({ conversationId, message }) => ({
        url: `/conversations/${conversationId}`,
        method: "POST",
        body: { message },
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
    }),
    deleteConversation: builder.mutation<{ success: boolean }, { conversationId: string }>({
      query: ({ conversationId }) => ({
        url: `/conversations/${conversationId}`,
        method: "DELETE",
      }),
    }),
  }),
})

export const {
  useCreateConversationMutation,
  useAddMessageToConversationMutation,
  useGetConversationQuery,
  useGetConversationsByPatientQuery,
  useDeleteConversationMutation,
} = conversationApi
