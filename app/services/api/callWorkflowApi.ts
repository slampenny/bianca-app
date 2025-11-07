import { createApi } from "@reduxjs/toolkit/query/react"
import baseQueryWithReauth from "./baseQueryWithAuth"

export interface InitiateCallRequest {
  patientId: string
  callNotes?: string
}

export interface InitiateCallResponse {
  conversationId: string
  callSid: string
  patientId: string
  patientName: string
  patientPhone: string
  agentId: string
  agentName: string
  status: string
}

export interface CallStatusResponse {
  conversationId: string
  status: string
  startTime: string
  endTime?: string
  duration: number
  patient: {
    _id: string
    name: string
    phone: string
  }
  agent: {
    _id: string
    name: string
  }
  callOutcome?: string
  callNotes?: string
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
  patientId: {
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
        body: data,
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
  }),
})

export const {
  useInitiateCallMutation,
  useGetCallStatusQuery,
  useUpdateCallStatusMutation,
  useEndCallMutation,
  useGetActiveCallsQuery,
  useGetConversationWithCallDetailsQuery,
} = callWorkflowApi
