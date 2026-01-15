import { configureStore } from "@reduxjs/toolkit"
import { setupListeners } from "@reduxjs/toolkit/query"
import axios from 'axios';
import { DEFAULT_API_CONFIG } from '../app/services/api/api';

import { store as appStore } from "../app/store/store"
import { alertApi, authApi, patientApi } from "../app/services/api/"
import { Alert, Org, Caregiver, Patient } from "../app/services/api/api.types"

const buildApiUrl = (path: string) => {
  const base = DEFAULT_API_CONFIG.url.replace(/\/$/, "")
  const suffix = path.startsWith("/") ? path.slice(1) : path
  return `${base}/${suffix}`
}

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
    await axios.post(buildApiUrl("/test/clean"));
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
    const response = await axios.post(buildApiUrl("/test/create-caregiver"), { orgId, ...caregiver });
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
  // Login response can be either success with tokens or MFA requirement
  if ('tokens' in result.data) {
    return result.data.tokens;
  } else {
    throw new Error(`Login requires MFA - cannot get tokens`);
  }
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
    // Register endpoint returns: { message, caregiver, requiresEmailVerification }
    // It does NOT return org or tokens - need to get org from caregiver.org and login for tokens
    const caregiver = returnType.data.caregiver as Caregiver
    const org = (caregiver.org as any) as Org
    
    // If email verification is required, verify it first using the test endpoint
    if (returnType.data.requiresEmailVerification) {
      try {
        // Wait a bit for caregiver to be saved to database
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // Retry getting verification token (caregiver might not be immediately available)
        let verificationResponse
        let retries = 3
        while (retries > 0) {
          try {
            // DEFAULT_API_CONFIG.url is "http://localhost:3000/v1", so we need /test/...
            verificationResponse = await axios.post(`${DEFAULT_API_CONFIG.url}/test/send-verification-email`, { email })
            break
          } catch (err: any) {
            retries--
            if (retries === 0) throw err
            await new Promise(resolve => setTimeout(resolve, 200))
          }
        }
        
        const verificationLink = verificationResponse!.data.details.verificationLinks.frontend
        const tokenMatch = verificationLink.match(/token=([^&]+)/)
        
        if (tokenMatch && tokenMatch[1]) {
          const verifyToken = tokenMatch[1]
          // Verify the email (DEFAULT_API_CONFIG.url is "http://localhost:3000/v1")
          await axios.get(`${DEFAULT_API_CONFIG.url}/auth/verify-email?token=${verifyToken}`)
        } else {
          throw new Error('Could not extract verification token from test endpoint response')
        }
      } catch (verifyError: any) {
        throw new Error(`Failed to verify email for test user: ${verifyError.message || JSON.stringify(verifyError.response?.data || verifyError)}`)
      }
    }
    
    // Login to get tokens (register doesn't return tokens)
    const loginResult = await authApi.endpoints.login.initiate({ email, password })(
      appStore.dispatch, 
      appStore.getState, 
      {}
    )
    
    if ("error" in loginResult || !loginResult.data) {
      throw new Error(`Login after registration failed: ${JSON.stringify(loginResult.error || 'Unknown error')}`)
    }
    
    // Wait a bit for Redux store to update with tokens from the login matcher
    // RTK Query matchers update the store asynchronously
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Verify tokens are in the store
    const state = appStore.getState()
    const tokens = (state.auth.tokens || (loginResult.data && 'tokens' in loginResult.data ? loginResult.data.tokens : null))
    
    if (!tokens) {
      throw new Error(`Login succeeded but tokens not found in store: ${JSON.stringify(loginResult.data)}`)
    }
    
    return {
      org,
      caregiver,
      tokens,
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
