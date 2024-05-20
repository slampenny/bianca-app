import { configureStore } from "@reduxjs/toolkit"
import { setupListeners } from "@reduxjs/toolkit/query"
import axios from 'axios';
import { DEFAULT_API_CONFIG } from '../app/services/api/api';

import { store as appStore } from "../app/store/store"
import { authApi, patientApi } from "../app/services/api/"
import { Org, Caregiver, Patient } from "../app/services/api/api.types"

export function setupApiStore(api: any) {
  const store = configureStore({
    reducer: {
      [api.reducerPath]: api.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(api.middleware),
  })

  setupListeners(store.dispatch)

  return { store }
}

export function generateUniqueEmail() {
  return `test+${Date.now()}@example.com`;
};

export async function cleanTestDatabase() {
  try {
    await axios.post(`${DEFAULT_API_CONFIG.url}test/clean`);
    console.log('Test database cleaned');
  } catch (error) {
    console.error('Failed to clean test database', error);
  }
};


export async function loginAndGetTokens(email: string, password: string) {
  const credentials = { email, password };
  const result = await authApi.endpoints.login.initiate(credentials)(appStore.dispatch, appStore.getState, {});
  if ('data' in result) {
    return result.data.tokens;
  } else {
    throw new Error('Login failed');
  }
};

export function expectError(result: any, status: number, message: string) {
  expect(result.error).toBeTruthy();
  expect(result.error.status).toBe(status);
  expect((result.error.data as { message: string }).message).toBe(message);
}

export async function registerNewOrgAndCaregiver(name: string, email: string, password: string, phone: string) {
  const register = authApi.endpoints.register.initiate
  const returnType = await register({name, email, password, phone})(appStore.dispatch, appStore.getState, {})

  if ("error" in returnType) {
    throw new Error(`Registration failed with error: ${JSON.stringify(returnType.error)}`)
  } else {
    return {
      org: returnType.data.org as Org,
      caregiver: returnType.data.caregiver as Caregiver,
      tokens: returnType.data.tokens,
    }
  }
}

export async function createPatientInOrg(org: Org, email: string, password: string) {
  const newPatient: Partial<Patient> = {
    org: org.id,
    name: "Test Patient",
    email: `test${Math.floor(Math.random() * 10000)}@example.com`,
    phone: "1234567890",
  }
  const result = await patientApi.endpoints.createPatient.initiate(newPatient)(
    appStore.dispatch,
    appStore.getState,
    {},
  )
  if ("error" in result) {
    throw new Error(`Create patient failed with error: ${JSON.stringify(result.error)}`)
  } else {
    return result.data as Patient
  }
}
