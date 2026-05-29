import { createApi } from "@reduxjs/toolkit/query/react"
import baseQueryWithReauth from "./baseQueryWithAuth"

export interface InitiateCallRequest {
  clientId: string
  callNotes?: string
}

export interface InitiateCallResponse {
  conversationId: string
  callId: string
  callSid: string
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

export interface ConversationIdResponse {
  callId: string
  callSid: string
  conversationId: string | null
  hasConversation: boolean
}

export interface CallOnboardingStatus {
  isOnboardingCall: boolean
  onboardingDay: number | null
  totalDays?: number
  journeyComplete: boolean
  sessionsCompleted: number
  currentStageDay: number | null
  nextOutboundWillBeOnboarding: boolean
}

export interface CallStatusResponse {
  conversationId: string
  status: string
  startTime: string
  endTime?: string
  duration: number
  client: {
    _id: string
    name: string
    phone: string
  }
  caregiver: {
    _id: string
    name: string
  }
  callOutcome?: string
  callNotes?: string
  callType?: string
  onboarding?: CallOnboardingStatus
  aiSpeaking?: boolean | { isSpeaking?: boolean; userIsSpeaking?: boolean; conversationState?: string }
  messages?: Array<{ id?: string; role: string; content: string; createdAt?: string }>
}

export interface UpdateCallStatusRequest {
  status: string
  outcome?: string
  notes?: string
}

export interface EndCallRequest {
  outcome: string
  notes?: string
}

export interface ActiveCall {
  _id: string
  clientId: {
    _id: string
    name: string
    phone: string
  }
  status: string
  startTime: string
  callNotes?: string
}

export interface ActiveCallsResponse {
  data: ActiveCall[]
  count: number
}

export const callWorkflowApi = createApi({
  reducerPath: "callWorkflowApi",
  baseQuery: baseQueryWithReauth(),
  endpoints: (builder) => ({
    initiateCall: builder.mutation<InitiateCallResponse, InitiateCallRequest>({
      query: (data) => ({
        url: "/calls/initiate",
        method: "POST",
        body: { clientId: data.clientId, callNotes: data.callNotes },
      }),
    }),
    getCallStatus: builder.query<{ data: CallStatusResponse }, string>({
      query: (conversationId) => `/calls/${conversationId}/status`,
    }),
    updateCallStatus: builder.mutation<any, { conversationId: string; data: UpdateCallStatusRequest }>({
      query: ({ conversationId, data }) => ({
        url: `/calls/${conversationId}/status`,
        method: "POST",
        body: data,
      }),
    }),
    endCall: builder.mutation<any, { conversationId: string; data: EndCallRequest }>({
      query: ({ conversationId, data }) => ({
        url: `/calls/${conversationId}/end`,
        method: "POST",
        body: data,
      }),
    }),
    getActiveCalls: builder.query<ActiveCallsResponse, void>({
      query: () => "/calls/active",
    }),
    getConversationWithCallDetails: builder.query<{ data: CallStatusResponse }, string>({
      query: (conversationId) => `/calls/${conversationId}/conversation`,
    }),
    getConversationIdByCall: builder.query<ConversationIdResponse, string>({
      query: (callIdOrSid) => `/calls/by-call/${callIdOrSid}/conversation-id`,
    }),
  }),
})

export const {
  useInitiateCallMutation,
  useGetCallStatusQuery,
  useUpdateCallStatusMutation,
  useEndCallMutation,
  useGetActiveCallsQuery,
  useGetConversationWithCallDetailsQuery,
  useGetConversationIdByCallQuery,
} = callWorkflowApi
