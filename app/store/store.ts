import { combineReducers, configureStore } from "@reduxjs/toolkit"
import alertReducer from "./alertSlice"
import authReducer from "./authSlice"
import orgReducer from "./orgSlice"
import caregiverReducer from "./caregiverSlice"
import patientReducer from "./patientSlice"
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
  patientApi,
  paymentApi,
  paymentMethodApi,
  conversationApi,
  callWorkflowApi,
  sentimentApi,
  medicalAnalysisApi,
  stripeApi,
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
  patientApi,
  paymentApi,
  paymentMethodApi,
  conversationApi,
  callWorkflowApi,
  sentimentApi,
  medicalAnalysisApi,
  stripeApi,
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

// Build API reducers dynamically
const apiReducers = Object.fromEntries(
  Object.values(apiServices).map((api) => [api.reducerPath, api.reducer])
)

const rootReducer = combineReducers({
  org: orgReducer,
  caregiver: caregiverReducer,
  patient: patientReducer,
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
const apiMiddleware = Object.values(apiServices).map((api) => api.middleware)

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(...apiMiddleware),
})

export const persistor = persistStore(store)

// Clear store in development mode
if (process.env.NODE_ENV === "development") {
  persistor.purge()
}

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

type DispatchFunc = () => AppDispatch
export const useAppDispatch: DispatchFunc = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
