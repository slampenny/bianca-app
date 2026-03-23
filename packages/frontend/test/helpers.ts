import { configureStore } from "@reduxjs/toolkit"
import { setupListeners } from "@reduxjs/toolkit/query"
import axios from 'axios';
import { DEFAULT_API_CONFIG } from '../app/services/api/api';

import { store as appStore } from "../app/store/store"
import { setAuthTokens, setCurrentUser } from "../app/store/authSlice"
import { alertApi, authApi, clientApi, orgApi } from "../app/services/api/"
import { Alert, Org, Caregiver, Client, AuthTokens } from "../app/services/api/api.types"

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
    if (!process.env.JEST_WORKER_ID) {
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

/**
 * Login without RTK baseQuery (no Authorization header). Integration tests share a persisted store;
 * a stale Bearer token can make /auth/login fail with 401 even when email/password are correct.
 */
async function loginViaHttpAndHydrateAuth(email: string, password: string): Promise<AuthTokens> {
  const { status, data } = await axios.post(
    buildApiUrl("auth/login"),
    { email, password },
    {
      validateStatus: () => true,
      timeout: 30000,
      headers: { "Content-Type": "application/json" },
    },
  )
  if (status !== 200 || !data?.tokens) {
    throw new Error(
      `loginViaHttp failed: status=${status} body=${JSON.stringify(data)}`,
    )
  }
  if (data.requireMFA) {
    throw new Error("Login requires MFA — use a test user without MFA for integration helpers")
  }
  appStore.dispatch(setAuthTokens(data.tokens))
  appStore.dispatch(setCurrentUser(data.caregiver))
  return data.tokens as AuthTokens
}

export async function registerNewOrgAndCaregiver(name: string, email: string, password: string, phone: string) {
  // Caregiver model lowercases email; login must use the same string the DB stores.
  const emailNorm = email.trim().toLowerCase()

  const register = authApi.endpoints.register.initiate
  let returnType = await register({
    name,
    email: emailNorm,
    password,
    phone: phone.trim(),
  })(appStore.dispatch, appStore.getState, {})

  // Transient Node/fetch failures under parallel Jest workers — one backoff retry
  if ("error" in returnType) {
    const errJson = JSON.stringify(returnType.error)
    if (errJson.includes("FETCH_ERROR") || errJson.includes("fetch failed") || errJson.includes("Network")) {
      await new Promise((r) => setTimeout(r, 800))
      returnType = await register({
        name,
        email: emailNorm,
        password,
        phone: phone.trim(),
      })(appStore.dispatch, appStore.getState, {})
    }
  }

  if ("error" in returnType) {
    throw new Error(`Registration failed with error: ${JSON.stringify(returnType.error)}`)
  }

  // Register endpoint returns: { message, caregiver, requiresEmailVerification }
  const caregiver = returnType.data.caregiver as Caregiver
  const rawOrg = caregiver.org as any
  const orgId = typeof rawOrg === "string" ? rawOrg : rawOrg?.id || rawOrg?._id

  // If email verification is required, verify it first using the test endpoint
  if (returnType.data.requiresEmailVerification) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 200))

      let verificationResponse
      let retries = 3
      while (retries > 0) {
        try {
          verificationResponse = await axios.post(`${DEFAULT_API_CONFIG.url}/test/send-verification-email`, {
            email: emailNorm,
          })
          break
        } catch (err: any) {
          retries--
          if (retries === 0) {
            if (err.response?.status === 404) {
              if (!process.env.JEST_WORKER_ID) {
                console.log(
                  "Email verification test endpoint not available (404) - continuing without verification",
                )
              }
              break
            }
            throw err
          }
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
      }

      if (verificationResponse) {
        const verificationLink = verificationResponse.data.details.verificationLinks.frontend
        const tokenMatch = verificationLink.match(/token=([^&]+)/)

        if (tokenMatch && tokenMatch[1]) {
          const verifyToken = tokenMatch[1]
          await axios.get(`${DEFAULT_API_CONFIG.url}/auth/verify-email?token=${verifyToken}`)
        } else if (!process.env.JEST_WORKER_ID) {
          console.log("Could not extract verification token - continuing without verification")
        }
      }
    } catch (verifyError: any) {
      if (!process.env.JEST_WORKER_ID) {
        console.log(
          `Email verification failed (may be acceptable): ${verifyError.message || JSON.stringify(verifyError.response?.data || verifyError)}`,
        )
      }
    }
  }

  // Backoff: DB commit / replication lag when many workers hit the API
  const delaysMs = [200, 500, 1000, 2000, 3500]
  let tokens: AuthTokens | null = null
  let lastRtkError: unknown

  for (let i = 0; i < delaysMs.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, delaysMs[i]))

    const loginResult = await authApi.endpoints.login.initiate({ email: emailNorm, password })(
      appStore.dispatch,
      appStore.getState,
      {},
    )

    if (!("error" in loginResult) && loginResult.data) {
      if ("requireMFA" in loginResult.data && (loginResult.data as { requireMFA?: boolean }).requireMFA) {
        throw new Error("Login requires MFA — use a test user without MFA for integration helpers")
      }
    }

    if (!("error" in loginResult) && loginResult.data && "tokens" in loginResult.data && loginResult.data.tokens) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      tokens =
        appStore.getState().auth.tokens ?? (loginResult.data as { tokens: AuthTokens }).tokens
      lastRtkError = undefined
      break
    }
    lastRtkError = "error" in loginResult ? loginResult.error : undefined
  }

  if (!tokens) {
    try {
      tokens = await loginViaHttpAndHydrateAuth(emailNorm, password)
    } catch (httpErr) {
      throw new Error(
        `Login after registration failed. RTK last error: ${JSON.stringify(lastRtkError)}. HTTP fallback: ${httpErr instanceof Error ? httpErr.message : String(httpErr)}`,
      )
    }
  }

  if (!tokens) {
    throw new Error("Login after registration failed: no tokens after RTK retries and HTTP fallback")
  }

  let org: Org
  if (orgId) {
    const orgResult = await orgApi.endpoints.getOrg.initiate({ orgId })(
      appStore.dispatch,
      appStore.getState,
      {},
    )
    if ("data" in orgResult && orgResult.data) {
      org = orgResult.data as Org
    } else {
      org = { id: orgId } as Org
    }
  } else {
    org = rawOrg as Org
  }

  return {
    org,
    caregiver,
    tokens,
  }
}

export async function createClientInOrg(org: Org, _email: string, _password: string) {
  const newClient: Partial<Client> = {
    org: org.id ?? undefined,
    name: "Test Client",
    email: `test${Math.floor(Math.random() * 10000)}@example.com`,
    phone: "1234567890",
  }
  const result = await clientApi.endpoints.createClient.initiate({ client: newClient })(
    appStore.dispatch,
    appStore.getState,
    {},
  )
  if ("error" in result) {
    throw new Error(`Create client failed with error: ${JSON.stringify(result.error)}`)
  }
  return result.data as Client
}
