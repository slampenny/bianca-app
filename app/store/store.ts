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
import callWorkflowReducer from "./callWorkflowSlice"
import {
  alertApi,
  authApi,
  orgApi,
  caregiverApi,
  scheduleApi,
  patientApi,
  paymentApi,
  paymentMethodApi,
  conversationApi,
  callWorkflowApi,
} from "../services/api/"
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

const rootReducer = combineReducers({
  org: orgReducer,
  caregiver: caregiverReducer,
  patient: patientReducer,
  schedule: scheduleReducer,
  auth: authReducer,
  alert: alertReducer,
  conversation: conversationReducer,
  callWorkflow: callWorkflowReducer,
  payment: paymentReducer,
  paymentMethod: paymentMethodReducer,
  [alertApi.reducerPath]: alertApi.reducer,
  [authApi.reducerPath]: authApi.reducer,
  [orgApi.reducerPath]: orgApi.reducer,
  [conversationApi.reducerPath]: conversationApi.reducer,
  [caregiverApi.reducerPath]: caregiverApi.reducer,
  [patientApi.reducerPath]: patientApi.reducer,
  [paymentApi.reducerPath]: paymentApi.reducer,
  [paymentMethodApi.reducerPath]: paymentMethodApi.reducer,
  [scheduleApi.reducerPath]: scheduleApi.reducer,
  [callWorkflowApi.reducerPath]: callWorkflowApi.reducer,
})

const persistedReducer = persistReducer(persistConfig, rootReducer)

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(
      alertApi.middleware,
      authApi.middleware,
      orgApi.middleware,
      caregiverApi.middleware,
      patientApi.middleware,
      paymentApi.middleware,
      paymentMethodApi.middleware,
      scheduleApi.middleware,
      conversationApi.middleware,
      callWorkflowApi.middleware,
    ),
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
