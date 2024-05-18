import { EnhancedStore } from '@reduxjs/toolkit';
import { authApi } from '../authApi';
import { orgApi } from '../orgApi';
import { Caregiver, Org } from '../api.types';
import { store as appStore, RootState } from "../../../store/store";

describe('authApi', () => {
  let store: EnhancedStore<RootState>;
  let caregiver: Caregiver;
  let org: Org;
  let authTokens: { access: { token: string, expires: string }, refresh: { token: string, expires: string } };

  const generateUniqueEmail = () => `test+${Date.now()}@example.com`;

  const testCaregiver = () => ({
    name: 'Test Caregiver',
    email: generateUniqueEmail(),
    password: 'password1',
    phone: '1234567890',
  });

  beforeEach(async () => {
    store = appStore;
    const caregiverData = testCaregiver();
    const result = await authApi.endpoints.register.initiate(caregiverData)(store.dispatch, store.getState, {});
    if ('data' in result) {
      org = result.data.org;
      caregiver = org.caregivers[0];
      authTokens = await loginAndGetTokens(caregiverData.email, caregiverData.password);
    } else {
      throw new Error(`Registration failed with error: ${JSON.stringify(result.error)}`);
    }
  });

  afterEach(async () => {
    // Clean up the caregiver after each test
    if (org.id) {
      await orgApi.endpoints.deleteOrg.initiate({ orgId: org.id })(store.dispatch, store.getState, {});
    } else {
      throw new Error('org.id is undefined');
    }
    jest.clearAllMocks();
  });

  const loginAndGetTokens = async (email: string, password: string) => {
    const credentials = { email, password };
    const result = await authApi.endpoints.login.initiate(credentials)(store.dispatch, store.getState, {});
    if ('data' in result) {
      return result.data.tokens;
    } else {
      throw new Error('Login failed');
    }
  };

  function expectError(result: any, status: number, message: string) {
    expect(result.error).toBeTruthy();
    expect(result.error.status).toBe(status);
    expect((result.error.data as { message: string }).message).toBe(message);
  }

  it('should register a new caregiver', async () => {
    const newCaregiver = testCaregiver();
    const result = await authApi.endpoints.register.initiate(newCaregiver)(store.dispatch, store.getState, {});

    if ('error' in result) {
      throw new Error(`Registration failed with error: ${JSON.stringify(result.error)}`);
    } else {
      expect(result).toMatchObject({
        data: {
          org: expect.objectContaining({
            isEmailVerified: false,
            email: newCaregiver.email,
            id: expect.any(String),
          }),
          tokens: expect.objectContaining({
            access: expect.any(Object),
            refresh: expect.any(Object),
          }),
        },
      });

      const orgId = result.data.org.id as string;
      await authApi.endpoints.login.initiate({ email: newCaregiver.email, password: newCaregiver.password })(store.dispatch, store.getState, {});
      await orgApi.endpoints.deleteOrg.initiate({ orgId })(store.dispatch, store.getState, {});
    }
  });

  it('should fail to register a new caregiver with a duplicate email', async () => {
    const caregiverData = testCaregiver();
    await authApi.endpoints.register.initiate(caregiverData)(store.dispatch, store.getState, {});

    const result = await authApi.endpoints.register.initiate(caregiverData)(store.dispatch, store.getState, {});
    expectError(result, 400, 'Org Email already taken');
  });

  it('should fail to register a new caregiver with invalid input', async () => {
    const invalidCaregiver = { ...testCaregiver(), password: 'password' };
    const result = await authApi.endpoints.register.initiate(invalidCaregiver)(store.dispatch, store.getState, {});
    expectError(result, 400, 'password must contain at least 1 letter and 1 number');
  });

  it('should login a caregiver', async () => {
    const loginState = store.getState().auth;
    expect(loginState).toEqual(expect.anything());
  });

  it('should logout a caregiver', async () => {
    await authApi.endpoints.logout.initiate(authTokens)(store.dispatch, store.getState, {});
    const authState = store.getState().auth;
    expect(authState).toEqual(expect.anything());
  });

  it('should refresh tokens', async () => {
    await authApi.endpoints.refreshTokens.initiate({ refreshToken: authTokens.refresh.token })(store.dispatch, store.getState, {});
    const authState = store.getState().auth;
    expect(authState).toEqual(expect.anything());
  });

  it('should send forgot password email', async () => {
    const email = 'test@example.com';
    await authApi.endpoints.forgotPassword.initiate({ email })(store.dispatch, store.getState, {});
    const authState = store.getState().auth;
    expect(authState).toEqual(expect.anything());
  });

  it('should reset password', async () => {
    const password = 'new-password';
    await authApi.endpoints.resetPassword.initiate({ password })(store.dispatch, store.getState, {});
    const authState = store.getState().auth;
    expect(authState).toEqual(expect.anything());
  });

  it('should send verification email', async () => {
    await authApi.endpoints.sendVerificationEmail.initiate(caregiver)(store.dispatch, store.getState, {});
    const authState = store.getState().auth;
    expect(authState).toEqual(expect.anything());
  });

  it('should verify email', async () => {
    const token = 'verification-token';
    await authApi.endpoints.verifyEmail.initiate({ token })(store.dispatch, store.getState, {});
    const authState = store.getState().auth;
    expect(authState).toEqual(expect.anything());
  });
});
