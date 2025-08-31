import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { RootState } from "./store"
import { InitiateCallResponse, CallStatusResponse } from "../services/api/callWorkflowApi"

interface CallState {
  activeCall: InitiateCallResponse | null
  callStatus: CallStatusResponse | null
  pendingCallData: InitiateCallResponse | null
}

const initialState: CallState = {
  activeCall: null,
  callStatus: null,
  pendingCallData: null,
}

export const callSlice = createSlice({
  name: "call",
  initialState,
  reducers: {
    setActiveCall: (state, action: PayloadAction<InitiateCallResponse | null>) => {
      state.activeCall = action.payload
    },
    setCallStatus: (state, action: PayloadAction<CallStatusResponse | null>) => {
      state.callStatus = action.payload
    },
    updateCallStatus: (state, action: PayloadAction<{ conversationId: string; status: string }>) => {
      const { conversationId, status } = action.payload
      
      // Update active call if it matches
      if (state.activeCall?.conversationId === conversationId) {
        state.activeCall.callStatus = status
      }
      
      // Update call status if it matches
      if (state.callStatus?.conversationId === conversationId) {
        state.callStatus.status = status
      }
    },
    clearCallData: (state) => {
      state.activeCall = null
      state.callStatus = null
    },
    setPendingCallData: (state, action: PayloadAction<InitiateCallResponse | null>) => {
      state.pendingCallData = action.payload
    },
    consumePendingCallData: (state) => {
      if (state.pendingCallData) {
        state.activeCall = state.pendingCallData
        state.pendingCallData = null
      }
    },
  },
})

export const { 
  setActiveCall,
  setCallStatus,
  updateCallStatus,
  clearCallData,
  setPendingCallData,
  consumePendingCallData
} = callSlice.actions

export const getActiveCall = (state: RootState) => state.call.activeCall
export const getCallStatus = (state: RootState) => state.call.callStatus

export default callSlice.reducer
