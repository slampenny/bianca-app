import { combineReducers, configureStore } from "@reduxjs/toolkit"
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
import storage from "redux-persist/lib/storage"
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux"
import authReducer from "./authSlice"
import orgReducer from "./orgSlice"
import { authApi } from "../services/api/authApi"
import { alertApi } from "../services/api/alertApi"
import { clientApi } from "../services/api/clientApi"
import { conversationApi } from "../services/api/conversationApi"
import { sentimentApi } from "../services/api/sentimentApi"
import { caregiverApi } from "../services/api/caregiverApi"
import { mfaApi } from "../services/api/mfaApi"
import { phoneVerificationApi } from "../services/api/phoneVerificationApi"
import { privacyApi } from "../services/api/privacyApi"
import { activityApi } from "../services/api/activityApi"
import { medicalAnalysisApi } from "../services/api/medicalAnalysisApi"
import { callWorkflowApi } from "../services/api/callWorkflowApi"
import { scheduleApi } from "../services/api/scheduleApi"
import { paymentMethodApi } from "../services/api/paymentMethodApi"
import { dailyDigestApi } from "../services/api/dailyDigestApi"
import { familyWeeklyDigestApi } from "../services/api/familyWeeklyDigestApi"
import { facilityReportsApi } from "../services/api/facilityReportsApi"
import { fraudAbuseAnalysisApi } from "../services/api/fraudAbuseAnalysisApi"

const authPersistConfig = {
  key: "auth",
  storage,
  blacklist: ["tokens", "currentUser", "inviteToken", "pendingOnboarding"],
}

const orgPersistConfig = {
  key: "org",
  storage,
}

const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  org: persistReducer(orgPersistConfig, orgReducer),
  [authApi.reducerPath]: authApi.reducer,
  [alertApi.reducerPath]: alertApi.reducer,
  [clientApi.reducerPath]: clientApi.reducer,
  [conversationApi.reducerPath]: conversationApi.reducer,
  [sentimentApi.reducerPath]: sentimentApi.reducer,
  [caregiverApi.reducerPath]: caregiverApi.reducer,
  [mfaApi.reducerPath]: mfaApi.reducer,
  [phoneVerificationApi.reducerPath]: phoneVerificationApi.reducer,
  [privacyApi.reducerPath]: privacyApi.reducer,
  [activityApi.reducerPath]: activityApi.reducer,
  [medicalAnalysisApi.reducerPath]: medicalAnalysisApi.reducer,
  [callWorkflowApi.reducerPath]: callWorkflowApi.reducer,
  [scheduleApi.reducerPath]: scheduleApi.reducer,
  [paymentMethodApi.reducerPath]: paymentMethodApi.reducer,
  [dailyDigestApi.reducerPath]: dailyDigestApi.reducer,
  [familyWeeklyDigestApi.reducerPath]: familyWeeklyDigestApi.reducer,
  [facilityReportsApi.reducerPath]: facilityReportsApi.reducer,
  [fraudAbuseAnalysisApi.reducerPath]: fraudAbuseAnalysisApi.reducer,
})

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(
      authApi.middleware,
      alertApi.middleware,
      clientApi.middleware,
      conversationApi.middleware,
      sentimentApi.middleware,
      caregiverApi.middleware,
      mfaApi.middleware,
      phoneVerificationApi.middleware,
      privacyApi.middleware,
      activityApi.middleware,
      medicalAnalysisApi.middleware,
      callWorkflowApi.middleware,
      scheduleApi.middleware,
      paymentMethodApi.middleware,
      dailyDigestApi.middleware,
      familyWeeklyDigestApi.middleware,
      facilityReportsApi.middleware,
      fraudAbuseAnalysisApi.middleware,
    ),
})

export const persistor = persistStore(store)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch: () => AppDispatch = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
