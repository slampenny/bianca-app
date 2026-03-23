import { combineReducers, configureStore } from "@reduxjs/toolkit"
import alertReducer from "./alertSlice"
import authReducer from "./authSlice"
import orgReducer from "./orgSlice"
import caregiverReducer from "./caregiverSlice"
import clientReducer from "./clientSlice"
import paymentReducer from "./paymentSlice"
import paymentMethodReducer from "./paymentMethodSlice"
import scheduleReducer from "./scheduleSlice"
import conversationReducer from "./conversationSlice"
import callReducer from "./callSlice"
import callWorkflowReducer from "./callWorkflowSlice"
import {
  alertApi,
  authApi,
  mfaApi,
  ssoApi,
  orgApi,
  caregiverApi,
  scheduleApi,
  clientApi,
  paymentApi,
  paymentMethodApi,
  conversationApi,
  callWorkflowApi,
  sentimentApi,
  medicalAnalysisApi,
  fraudAbuseAnalysisApi,
  stripeApi,
  privacyApi,
} from "../services/api/"

// Auto-register all APIs for easier maintenance
const apiServices = {
  alertApi,
  authApi,
  mfaApi,
  ssoApi,
  orgApi,
  caregiverApi,
  scheduleApi,
  clientApi,
  paymentApi,
  paymentMethodApi,
  conversationApi,
  callWorkflowApi,
  sentimentApi,
  medicalAnalysisApi,
  fraudAbuseAnalysisApi,
  stripeApi,
  privacyApi,
} as const
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux"
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist"
import AsyncStorage from "@react-native-async-storage/async-storage"

const persistConfig = {
  key: "root",
  version: 1,
  storage: AsyncStorage,
}

// Custom persist configuration for auth slice to exclude authEmail
const authPersistConfig = {
  key: "auth",
  storage: AsyncStorage,
  blacklist: ["authEmail"], // Exclude authEmail from persistence to prevent fake@example.org from appearing in production
}

const apiEntries = Object.entries(apiServices).filter(([key, api]) => {
  if (!api && !process.env.JEST_WORKER_ID) {
    console.warn(`[store] Missing API service: ${key}`)
  }
  return Boolean(api)
})

// Build API reducers dynamically
const apiReducers = Object.fromEntries(
  apiEntries.map(([, api]) => [api.reducerPath, api.reducer])
)

const rootReducer = combineReducers({
  org: orgReducer,
  caregiver: caregiverReducer,
  client: clientReducer,
  schedule: scheduleReducer,
  auth: persistReducer(authPersistConfig, authReducer),
  alert: alertReducer,
  conversation: conversationReducer,
  call: callReducer,
  callWorkflow: callWorkflowReducer,
  payment: paymentReducer,
  paymentMethod: paymentMethodReducer,
  ...apiReducers,
})

const persistedReducer = persistReducer(persistConfig, rootReducer)

// Build API middleware dynamically
const apiMiddleware = apiEntries.map(([, api]) => api.middleware)

const isJest = Boolean(process.env.JEST_WORKER_ID)

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // RTK Query cache + full tree checks can exceed 32ms in Jest; these run only in dev anyway.
      ...(isJest
        ? { serializableCheck: false, immutableCheck: false }
        : {
            serializableCheck: {
              ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
            },
          }),
    }).concat(...apiMiddleware) as any,
})

export const persistor = persistStore(store)

// Expose store on window for testing and debugging (web only)
// Check for web environment without using Platform to avoid module load issues
try {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    (window as any).__REDUX_STORE__ = store
    // Only expose as __REDUX_STORE__ to avoid conflicts with window.store
  }
} catch (e) {
  // Ignore errors when exposing store on window
}

// Clear store in development mode - do this asynchronously to avoid initialization issues
if (process.env.NODE_ENV === "development") {
  // Use setTimeout to defer purge until after module initialization
  setTimeout(() => {
    persistor.purge().catch(() => {
      // Ignore errors during purge
    })
  }, 0)
}

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

type DispatchFunc = () => AppDispatch
export const useAppDispatch: DispatchFunc = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
