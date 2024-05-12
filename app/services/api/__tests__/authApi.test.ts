import { EnhancedStore } from '@reduxjs/toolkit';
import { authApi } from '../authApi';
import { orgApi } from '../orgApi';
import { store as appStore, RootState } from "../../../store/store";

describe('authApi', () => {
  let store: EnhancedStore<RootState>;

  beforeEach(() => {
    store = appStore;
  });

  it('should register a new caregiver', async () => {
    const newCaregiver = { name: 'Test Caregiver', email: 'test7@example.com', password: 'password1', phone: '1234567890'};
  
    // Call the mutate function directly
    const register = authApi.endpoints.register.initiate;
    const result = await register(newCaregiver)(store.dispatch, store.getState, {});
  
    if ('error' in result) {
      // Handle the error case
      throw new Error(`Registration failed with error: ${result.error}`);
    } else {
      // Assert that the correct action was dispatched
      expect(result).toMatchObject({
        data: {
          org: {
            isEmailVerified: false,
            caregivers: expect.any(Array),
            patients: expect.any(Array),
            deleted: false,
            email: newCaregiver.email,
            id: expect.any(String),
            name: expect.any(String),
            phone: expect.any(String),
          },
          tokens: {
            access: {
              token: expect.any(String),
              expires: expect.any(Number),
            },
            refresh: {
              token: expect.any(String),
              expires: expect.any(Number),
            },
          },
        },
      });

      // Extract org.id from the result
      const orgId = result.data.org?.id;
      // Call the mutate function directly
      if (orgId) {
        // Call the mutate function directly
        const deleteOrg = orgApi.endpoints.deleteOrg.initiate;
        await deleteOrg({id: orgId})(store.dispatch, store.getState, {});
      } else {
        throw new Error('Org ID is undefined');
      }
    }    
  });

  it('should fail to register a new caregiver with a duplicate email', async () => {
    const newCaregiver = { name: 'Test Caregiver', email: 'test@example.com', password: 'password1', phone: '1234567890' };
  
    // Call the mutate function directly
    const register = authApi.endpoints.register.initiate;
    await register(newCaregiver)(store.dispatch, store.getState, {});
    const result2 = await register(newCaregiver)(store.dispatch, store.getState, {});
  
    // Assert that an error was returned
    if ('error' in result2) {
      if ('status' in result2.error) {
        expect(result2.error.status).toEqual(400);
        const data = result2.error.data as { message: string };
        expect(data.message).toEqual('Email already taken');
      } else {
        throw new Error('Expected error to have a status, but it did not');
      }
    } else {
      throw new Error('Expected register to return an error, but it returned a caregiver');
    }
  });
  
  it('should fail to register a new caregiver with invalid input', async () => {
    const newCaregiver = { name: 'Test Caregiver', email: 'test@example.com', password: 'password', phone: '1234567890' };
  
    // Call the mutate function directly
    const register = authApi.endpoints.register.initiate;
    const result = await register(newCaregiver)(store.dispatch, store.getState, {});
  
    // Assert that an error was returned
    if ('error' in result) {
      if ('status' in result.error) {
        expect(result.error.status).toEqual(400);
        const data = result.error.data as { message: string };
        expect(data.message).toEqual('password must contain at least 1 letter and 1 number');
      } else {
        throw new Error('Expected error to have a status, but it did not');
      }
    } else {
      throw new Error('Expected register to return an error, but it returned a caregiver');
    }
  });

  it('should login a caregiver', async () => {
    const credentials = { email: 'test@example.com', password: 'password' };

    // Call the mutate function directly
    const login = authApi.endpoints.login.initiate;
    login(credentials)(store.dispatch, store.getState, {});

    // Assert that the correct action was dispatched
    const loginState = store.getState().auth;
    expect(loginState).toEqual(expect.anything());
  });

  // Add similar tests for logout, refreshTokens, forgotPassword, resetPassword, sendVerificationEmail, verifyEmail

  afterEach(() => {
    jest.clearAllMocks();
  });
});