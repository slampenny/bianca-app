import { createApi } from "@reduxjs/toolkit/query/react"
import baseQueryWithReauth from "./baseQueryWithAuth"

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
    journeyComplete: boolean
    sessionsCompleted: number
    currentStageDay: number | null
    nextOutboundWillBeOnboarding: boolean
  }
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
    }),
    getCallStatus: builder.query<{ data: CallStatusResponse }, { conversationId: string }>({
      query: ({ conversationId }) => ({
        url: `/calls/${conversationId}/status`,
        method: "GET",
      }),
      providesTags: (_r, _e, { conversationId }) => [{ type: "CallWorkflow", id: conversationId }],
    }),
    endCall: builder.mutation<{ data?: unknown }, { conversationId: string; outcome: string; notes?: string }>({
      query: ({ conversationId, outcome, notes }) => ({
        url: `/calls/${conversationId}/end`,
        method: "POST",
        body: { outcome, notes },
      }),
      invalidatesTags: (_r, _e, { conversationId }) => [{ type: "CallWorkflow", id: conversationId }],
    }),
  }),
})

export const { useInitiateCallMutation, useGetCallStatusQuery, useEndCallMutation } = callWorkflowApi

