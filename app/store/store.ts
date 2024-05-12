import { combineReducers, configureStore } from "@reduxjs/toolkit";
import counterReducer from "./counterSlice";
import authReducer from "./authSlice";
import orgReducer from "./orgSlice";
import caregiverReducer from "./caregiverSlice";
import scheduleReducer from "./scheduleSlice";
import { authApi } from '../services/api/authApi'; // import your authApi
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from "redux-persist";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { orgApi } from "app/services/api/orgApi";
import { caregiverApi } from "app/services/api/caregiverApi";
import { scheduleApi } from "app/services/api/scheduleApi";

const persistConfig = {
  key: "root",
  version: 1,
  storage: AsyncStorage,
};

const rootReducer = combineReducers({
  counter: counterReducer,
  org: orgReducer,
  caregiver: caregiverReducer,
  schedule: scheduleReducer,
  auth: authReducer,
  [authApi.reducerPath]: authApi.reducer, // add authApi.reducer
  [orgApi.reducerPath]: orgApi.reducer, // add authApi.reducer
  [caregiverApi.reducerPath]: caregiverApi.reducer, // add caregiverApi.reducer
  [scheduleApi.reducerPath]: scheduleApi.reducer, // add scheduleApi.reducer
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(authApi.middleware, orgApi.middleware, caregiverApi.middleware, scheduleApi.middleware),
});

export const persistor = persistStore(store);

// Clear persisted state
persistor.purge().then(() => {
  console.log('Purge completed');
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Use throughout app instead of plain `useDispatch` and `useSelector` for type safety
type DispatchFunc = () => AppDispatch;
export const useAppDispatch: DispatchFunc = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;