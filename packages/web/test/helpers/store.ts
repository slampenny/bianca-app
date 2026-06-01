import { combineReducers, configureStore } from "@reduxjs/toolkit"
import { authApi } from "../../src/services/api/authApi"
import { alertApi } from "../../src/services/api/alertApi"
import { clientApi } from "../../src/services/api/clientApi"
import { conversationApi } from "../../src/services/api/conversationApi"
import { orgApi } from "../../src/services/api/orgApi"
import { familyWeeklyDigestApi } from "../../src/services/api/familyWeeklyDigestApi"
import authReducer from "../../src/store/authSlice"
import orgReducer from "../../src/store/orgSlice"
import type { RootState } from "../../src/store/store"

const rootReducer = combineReducers({
  auth: authReducer,
  org: orgReducer,
  [authApi.reducerPath]: authApi.reducer,
  [alertApi.reducerPath]: alertApi.reducer,
  [clientApi.reducerPath]: clientApi.reducer,
  [conversationApi.reducerPath]: conversationApi.reducer,
  [orgApi.reducerPath]: orgApi.reducer,
  [familyWeeklyDigestApi.reducerPath]: familyWeeklyDigestApi.reducer,
})

export type WebTestStore = ReturnType<typeof createWebTestStore>

/**
 * Redux store for tests — same slice shape as production but without redux-persist.
 */
export function createWebTestStore(preloaded?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
        immutableCheck: false,
      }).concat(
        authApi.middleware,
        alertApi.middleware,
        clientApi.middleware,
        conversationApi.middleware,
        orgApi.middleware,
        familyWeeklyDigestApi.middleware,
      ),
    preloadedState: preloaded as Partial<RootState> | undefined,
  })
}
