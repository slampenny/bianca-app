import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { RootState } from "./store"
import { ActiveCall, CallStatusResponse } from "../services/api/callWorkflowApi"

interface CallWorkflowState {
  activeCalls: ActiveCall[]
  currentCall: CallStatusResponse | null
  isLoading: boolean
  error: string | null
}

const initialState: CallWorkflowState = {
  activeCalls: [],
  currentCall: null,
  isLoading: false,
  error: null,
}

export const callWorkflowSlice = createSlice({
  name: "callWorkflow",
  initialState,
  reducers: {
    setActiveCalls: (state, action: PayloadAction<ActiveCall[]>) => {
      state.activeCalls = action.payload
      state.error = null
    },
    setCurrentCall: (state, action: PayloadAction<CallStatusResponse | null>) => {
      state.currentCall = action.payload
      state.error = null
    },
    updateCallStatus: (state, action: PayloadAction<{ conversationId: string; status: string; outcome?: string; notes?: string }>) => {
      const { conversationId, status, outcome, notes } = action.payload
      
      // Update active calls
      const callIndex = state.activeCalls.findIndex(call => call._id === conversationId)
      if (callIndex !== -1) {
        state.activeCalls[callIndex].callStatus = status
        if (notes) {
          state.activeCalls[callIndex].callNotes = notes
        }
        
        // Remove from active calls if call is ended
        if (['ended', 'failed', 'busy', 'no_answer'].includes(status)) {
          state.activeCalls.splice(callIndex, 1)
        }
      }
      
      // Update current call if it matches
      if (state.currentCall?.conversationId === conversationId) {
        state.currentCall.callStatus = status
        if (outcome) state.currentCall.callOutcome = outcome
        if (notes) state.currentCall.callNotes = notes
      }
      
      state.error = null
    },
    addActiveCall: (state, action: PayloadAction<ActiveCall>) => {
      // Check if call already exists
      const existingIndex = state.activeCalls.findIndex(call => call._id === action.payload._id)
      if (existingIndex !== -1) {
        state.activeCalls[existingIndex] = action.payload
      } else {
        state.activeCalls.push(action.payload)
      }
      state.error = null
    },
    removeActiveCall: (state, action: PayloadAction<string>) => {
      state.activeCalls = state.activeCalls.filter(call => call._id !== action.payload)
      if (state.currentCall?.conversationId === action.payload) {
        state.currentCall = null
      }
      state.error = null
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    clearError: (state) => {
      state.error = null
    },
    clearCallWorkflow: (state) => {
      state.activeCalls = []
      state.currentCall = null
      state.error = null
    },
  },
})

export const {
  setActiveCalls,
  setCurrentCall,
  updateCallStatus,
  addActiveCall,
  removeActiveCall,
  setLoading,
  setError,
  clearError,
  clearCallWorkflow,
} = callWorkflowSlice.actions

// Selectors
export const getActiveCalls = (state: RootState) => state.callWorkflow.activeCalls
export const getCurrentCall = (state: RootState) => state.callWorkflow.currentCall
export const getCallWorkflowLoading = (state: RootState) => state.callWorkflow.isLoading
export const getCallWorkflowError = (state: RootState) => state.callWorkflow.error
export const getActiveCallsCount = (state: RootState) => state.callWorkflow.activeCalls.length

export default callWorkflowSlice.reducer
