import { configureStore } from "@reduxjs/toolkit"
import { setupListeners } from "@reduxjs/toolkit/query"
import axios from 'axios';
import { DEFAULT_API_CONFIG } from '../app/services/api/api';

import { store as appStore } from "../app/store/store"
import { alertApi, authApi, patientApi } from "../app/services/api/"
import { Alert, Org, Caregiver, Patient } from "../app/services/api/api.types"

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
  } catch (error) {
    console.error('Failed to clean test database', error);
  }
};

export async function registerNewAlert(alert: Partial<Alert>): Promise<Alert> {
  const result = await alertApi.endpoints.createAlert.initiate(alert)(appStore.dispatch, appStore.getState, {});
  if ('error' in result) {
    throw new Error(`Register new alert failed with error: ${JSON.stringify(result.error)}`);
  }
  return result.data;
}

export async function createCaregiver(orgId: string, caregiver: Partial<Caregiver>) {
  try {
    const response = await axios.post(`${DEFAULT_API_CONFIG.url}test/create-caregiver`, { orgId, ...caregiver });
    return response.data as Caregiver;
  } catch (error) {
    if (error instanceof Error) {
      console.error('Failed to create a caregiver', {
        message: error.message,
        name: error.name,
      });
    } else if (axios.isAxiosError(error)) {
      console.error('Failed to create a caregiver', {
        message: error.message,
        name: error.name,
        config: error.config,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
      });
    } else {
      console.error('Failed to create a caregiver', error);
    }
    throw new Error('Failed to create a caregiver');
  }
}

export async function loginAndGetTokens(email: string, password: string) {
  const credentials = { email, password };
  const result = await authApi.endpoints.login.initiate(credentials)(appStore.dispatch, appStore.getState, {});
  if (!result.data) {
    throw new Error(`Login failed ${JSON.stringify(result.error)}`);
  }
  return result.data.tokens;
}

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
  const result = await patientApi.endpoints.createPatient.initiate({patient: newPatient})(
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
