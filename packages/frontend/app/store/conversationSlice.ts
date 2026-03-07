import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { RootState } from "./store"
import { Conversation } from "../services/api/api.types"
// Import APIs directly to break circular dependency with app/services/api/index.ts
import { clientApi } from "../services/api/clientApi"
import { conversationApi } from "../services/api/conversationApi"
import { setActiveCall } from "./callSlice"
import { logger } from "../utils/logger"

interface ConversationState {
  conversation: Conversation
  conversations: Conversation[]
}

const defaultConversation: Conversation = {
  id: "",
  callSid: "",
  clientId: "",
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
        logger.debug('[ConversationSlice] Setting conversation to default (null)');
        state.conversation = defaultConversation
      } else {
        logger.debug('[ConversationSlice] Setting conversation:', action.payload.id);
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
        logger.debug('[ConversationSlice] Setting conversations, current conversation set to:', action.payload[0].id);
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
    builder.addMatcher(clientApi.endpoints.createClient.matchFulfilled, (state) => {
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
      conversationApi.endpoints.getConversationsByClient.matchFulfilled,
      (state, { payload }) => {
        logger.debug('[ConversationSlice] getConversationsByClient fulfilled:', {
          page: payload.page,
          totalResults: payload.totalResults,
          resultsCount: payload.results?.length || 0
        });
        
        // Only update if we have a valid payload with results array
        // For the first page, replace all conversations
        if (payload.page === 1) {
          // Only update if we have results - don't clear conversations if API returns empty array
          // This prevents clearing conversations when API returns empty due to cache/304 issues
          if (payload.results !== undefined && payload.results.length > 0) {
            state.conversations = payload.results;
            logger.debug('[ConversationSlice] Set first page conversations:', payload.results?.map(c => ({ id: c.id, startTime: c.startTime })));
          } else if (payload.results !== undefined && payload.results.length === 0 && state.conversations.length === 0) {
            // Only clear if we explicitly got empty AND we don't have any conversations already
            // This allows API to clear conversations when patient has none, but preserves them during loading
            state.conversations = [];
            logger.debug('[ConversationSlice] Cleared conversations (client has none)');
          }
        } else {
          // For subsequent pages, append to existing conversations
          if (payload.results && payload.results.length > 0) {
            state.conversations = [...state.conversations, ...payload.results];
            logger.debug('[ConversationSlice] Appended page conversations, total:', state.conversations.length);
          }
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
    // Listen for active call changes and sync conversation ID
    builder.addMatcher(setActiveCall.match, (state, { payload }) => {
      if (payload?.conversationId) {
        logger.debug('[ConversationSlice] Active call set, syncing conversation ID:', payload.conversationId);
        
        // Find the conversation that matches the active call's conversation ID
        const matchingConversation = state.conversations.find(
          (conversation) => conversation.id === payload.conversationId
        );
        
        if (matchingConversation) {
          logger.debug('[ConversationSlice] Found matching conversation, setting as current:', matchingConversation.id);
          state.conversation = matchingConversation;
        } else {
          logger.debug('[ConversationSlice] No matching conversation found for active call ID:', payload.conversationId);
          // The conversation might not be loaded yet, but we should still set a placeholder
          // This will be updated when the conversation is fetched
        }
      }
    })
    // Listen for when a specific conversation is fetched and sync with active call
    builder.addMatcher(conversationApi.endpoints.getConversation.matchFulfilled, (state, { payload, meta }) => {
      // We'll handle this in the component level since we can't easily access other slice state here
      // The CallScreen will handle setting the conversation when it gets the data
      logger.debug('[ConversationSlice] Conversation fetched:', payload.id);
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
