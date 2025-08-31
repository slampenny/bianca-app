import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { RootState } from "./store"
import { Conversation } from "../services/api/api.types"
import { patientApi, conversationApi } from "../services/api"

interface ConversationState {
  conversation: Conversation
  conversations: Conversation[]
}

const defaultConversation: Conversation = {
  id: "",
  callSid: "",
  patientId: "",
  lineItemId: null,
  messages: [],
  history: "",
  analyzedData: {},
  metadata: {},
  startTime: new Date().toISOString(),
  endTime: new Date().toISOString(),
  duration: 0,
}

const initialState: ConversationState = {
  conversation: defaultConversation,
  conversations: [],
}

export const conversationSlice = createSlice({
  name: "conversation",
  initialState,
  reducers: {
    setConversation: (state, action: PayloadAction<Conversation | null>) => {
      if (!action.payload) {
        state.conversation = defaultConversation
      } else {
        state.conversation = action.payload
        const index = state.conversations.findIndex(
          (conversation) => conversation.id === state.conversation.id,
        )
        if (index !== -1) {
          state.conversations[index] = state.conversation
        }
      }
    },
    setConversations: (state, action: PayloadAction<Conversation[]>) => {
      if (action.payload.length > 0) {
        state.conversation = action.payload[0]
      }
      state.conversations = action.payload
    },
    clearConversation: (state) => {
      if (state.conversations.length > 0) {
        state.conversation = state.conversations[0]
      } else {
        state.conversation = defaultConversation
      }
    },
    clearConversations: (state) => {
      state.conversation = defaultConversation
      state.conversations = []
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(patientApi.endpoints.createPatient.matchFulfilled, (state) => {
      state.conversation = defaultConversation
      state.conversations = []
    })
    builder.addMatcher(
      conversationApi.endpoints.createConversation.matchFulfilled,
      (state, { payload }) => {
        state.conversation = payload
        state.conversations.push(payload)
      },
    )
    builder.addMatcher(
      conversationApi.endpoints.getConversationsByPatient.matchFulfilled,
      (state, { payload }) => {
        console.log('[ConversationSlice] getConversationsByPatient fulfilled:', {
          page: payload.page,
          totalResults: payload.totalResults,
          resultsCount: payload.results?.length || 0
        });
        
        // For the first page, replace all conversations
        if (payload.page === 1) {
          state.conversations = payload.results || [];
          console.log('[ConversationSlice] Set first page conversations:', payload.results?.map(c => ({ id: c.id, startTime: c.startTime })));
        } else {
          // For subsequent pages, append to existing conversations
          state.conversations = [...state.conversations, ...(payload.results || [])];
          console.log('[ConversationSlice] Appended page conversations, total:', state.conversations.length);
        }
        
        // Set the first conversation as the current one if we have conversations
        if (state.conversations.length > 0) {
          state.conversation = state.conversations[0];
        }
      },
    )
    // builder.addMatcher(conversationApi.endpoints.updateConversation.matchFulfilled, (state, { payload }) => {
    //   state.conversation = payload;

    //   const index = state.conversations.findIndex(conversation => conversation.id === payload.id);
    //   if (index !== -1) {
    //     state.conversations[index] = payload;
    //   }
    // });
    builder.addMatcher(conversationApi.endpoints.deleteConversation.matchFulfilled, (state) => {
      if (state.conversation) {
        state.conversations = state.conversations.filter(
          (conversation) => conversation.id !== state.conversation!.id,
        )
      }

      if (state.conversations.length > 0) {
        state.conversation = state.conversations[0]
      } else {
        state.conversation = defaultConversation
      }
    })
  },
})

export const { 
  setConversation, 
  setConversations, 
  clearConversation, 
  clearConversations
} = conversationSlice.actions

export const getConversation = (state: RootState) => state.conversation.conversation
export const getConversations = (state: RootState) => state.conversation.conversations

export default conversationSlice.reducer
