import { combineReducers, configureStore } from '@reduxjs/toolkit';
import alertReducer from './alertSlice';
import authReducer from './authSlice';
import orgReducer from './orgSlice';
import caregiverReducer from './caregiverSlice';
import patientReducer from './patientSlice';
import scheduleReducer from './scheduleSlice';
import { alertApi, authApi, orgApi, caregiverApi, scheduleApi, patientApi } from '../services/api/';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

const persistConfig = {
  key: 'root',
  version: 1,
  storage: AsyncStorage,
};

const rootReducer = combineReducers({
  org: orgReducer,
  caregiver: caregiverReducer,
  patient: patientReducer,
  schedule: scheduleReducer,
  auth: authReducer,
  alert: alertReducer,
  [alertApi.reducerPath]: alertApi.reducer,
  [authApi.reducerPath]: authApi.reducer,
  [orgApi.reducerPath]: orgApi.reducer,
  [caregiverApi.reducerPath]: caregiverApi.reducer,
  [patientApi.reducerPath]: patientApi.reducer,
  [scheduleApi.reducerPath]: scheduleApi.reducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    })
    .concat(
      alertApi.middleware, 
      authApi.middleware, 
      orgApi.middleware, 
      caregiverApi.middleware, 
      patientApi.middleware, 
      scheduleApi.middleware
    ),
});

export const persistor = persistStore(store);

// Clear store in development mode
if (process.env.NODE_ENV === 'development') {
  persistor.purge();
}

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

type DispatchFunc = () => AppDispatch;
export const useAppDispatch: DispatchFunc = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
