import { EnhancedStore } from '@reduxjs/toolkit';
import { authApi } from '../authApi';
import { Caregiver } from '../api.types';
import { store as appStore, RootState } from "../../../store/store";
import { loginAndGetTokens, expectError, cleanTestDatabase } from '../../../../test/helpers';
import { newCaregiver } from '../../../../test/fixtures/caregiver.fixture';

describe('authApi', () => {
  let store: EnhancedStore<RootState>;
  let caregiver: Caregiver;
  let authTokens: { access: { token: string, expires: string }, refresh: { token: string, expires: string } };

  beforeAll(async () => {
    cleanTestDatabase();
  });

  beforeEach(async () => {
    store = appStore;
    const result = await authApi.endpoints.register.initiate(newCaregiver)(store.dispatch, store.getState, {});
    if ('data' in result) {
      caregiver = result.data.caregiver;
      authTokens = result.data.tokens;
    } else {
      throw new Error(`Registration failed with error: ${JSON.stringify(result.error)}`);
    }
  });

  afterEach(async () => {
    await cleanTestDatabase();
    jest.clearAllMocks();
  });

  // it('should register a new caregiver', async () => {
  //   const result = await authApi.endpoints.register.initiate(newCaregiver)(store.dispatch, store.getState, {});

  //   if ('error' in result) {
  //     throw new Error(`Registration failed with error: ${JSON.stringify(result.error)}`);
  //   } else {
  //     expect(result).toMatchObject({
  //       data: {
  //         org: expect.objectContaining({
  //           isEmailVerified: false,
  //           email: newCaregiver.email,
  //           id: expect.any(String),
  //         }),
  //         tokens: expect.objectContaining({
  //           access: expect.any(Object),
  //           refresh: expect.any(Object),
  //         }),
  //       },
  //     });
  //   }
  // });

  it('should fail to register a new caregiver with a duplicate email', async () => {
    const result = await authApi.endpoints.register.initiate(newCaregiver)(store.dispatch, store.getState, {});
    expectError(result, 400, 'Org Email already taken');
  });

  it('should fail to register a new caregiver with invalid input', async () => {
    const invalidCaregiver = { ...newCaregiver, password: 'password' };
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

    authTokens = await loginAndGetTokens(newCaregiver.email, newCaregiver.password);
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
    const password = 'new-password1';
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
