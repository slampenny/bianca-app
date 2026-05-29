import { createApi } from "@reduxjs/toolkit/query/react"
import baseQueryWithReauth from "./baseQueryWithAuth"
import { clientApi } from "./clientApi"
import { conversationApi } from "./conversationApi"

export interface InitiateCallRequest {
  clientId: string
  callNotes?: string
}

export interface InitiateCallResponse {
  callId: string
  callSid: string
  conversationId: string
  clientId: string
  clientName: string
  clientPhone: string
  caregiverId: string
  caregiverName: string
  status: string
  callStatus?: string
  callType?: string
  onboardingDay?: number | null
  onboardingTotalDays?: number
  onboardingJourneyComplete?: boolean
  onboardingSessionsCompleted?: number
  onboardingCurrentStageDay?: number | null
  nextOutboundWillBeOnboarding?: boolean
  isOnboardingCall?: boolean
}

export interface CallStatusResponse {
  conversationId: string
  callId: string
  status: string
  callStatus?: string
  callOutcome?: string
  startTime?: string
  endTime?: string
  duration?: number
  callType?: string
  client?: { _id?: string; name?: string; phone?: string }
  caregiver?: { _id?: string; name?: string }
  messages?: Array<{ id?: string; _id?: string; role: string; content: string; createdAt?: string }>
  onboarding?: {
    isOnboardingCall: boolean
    onboardingDay: number | null
    totalDays?: number
    journeyComplete: boolean
    sessionsCompleted: number
    currentStageDay: number | null
    nextOutboundWillBeOnboarding: boolean
  }
}

function invalidateClientConversations(dispatch: (action: unknown) => void, clientId: string | undefined) {
  if (!clientId) return
  const tags = [
    { type: "ClientConversations" as const, id: clientId },
    { type: "ClientConversations" as const, id: "LIST" },
  ]
  dispatch(conversationApi.util.invalidateTags(tags))
  dispatch(clientApi.util.invalidateTags(tags))
}

export const callWorkflowApi = createApi({
  reducerPath: "callWorkflowApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["CallWorkflow"],
  endpoints: (builder) => ({
    initiateCall: builder.mutation<InitiateCallResponse, InitiateCallRequest>({
      query: (body) => ({
        url: "/calls/initiate",
        method: "POST",
        body,
      }),
      invalidatesTags: ["CallWorkflow"],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          invalidateClientConversations(dispatch, data?.clientId || arg.clientId)
        } catch {
          // ignore; errors do not need cache invalidation
        }
      },
    }),
    getCallStatus: builder.query<{ data: CallStatusResponse }, { conversationId: string }>({
      query: ({ conversationId }) => ({
        url: `/calls/${conversationId}/status`,
        method: "GET",
      }),
      providesTags: (_r, _e, { conversationId }) => [{ type: "CallWorkflow", id: conversationId }],
    }),
    endCall: builder.mutation<
      { clientId?: string; id?: string },
      { conversationId: string; outcome: string; notes?: string }
    >({
      query: ({ conversationId, outcome, notes }) => ({
        url: `/calls/${conversationId}/end`,
        method: "POST",
        body: { outcome, notes },
      }),
      invalidatesTags: (_r, _e, { conversationId }) => [{ type: "CallWorkflow", id: conversationId }],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          if (data?.clientId) invalidateClientConversations(dispatch, data.clientId)
        } catch {
          // ignore
        }
      },
    }),
  }),
})

export const { useInitiateCallMutation, useGetCallStatusQuery, useEndCallMutation } = callWorkflowApi

