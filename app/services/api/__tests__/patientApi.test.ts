import { EnhancedStore } from '@reduxjs/toolkit';
import { patientApi } from '../patientApi';
import { store as appStore, RootState } from "../../../store/store";
import { registerNewOrgAndPatient } from "../../../../test/helpers";
import { Patient } from '../api.types';

describe('patientApi', () => {
  let store: EnhancedStore<RootState>;
  let patientId: string;
  let token: string;

  beforeAll(async () => {
    const { patientId: patientIdResult, token: tokenResult } = await registerNewOrgAndPatient();
    patientId = patientIdResult as string;
    token = tokenResult as string;
  });

  beforeEach(() => {
    store = appStore;
    // Ensure token is set in headers before each test
    store.dispatch({
      type: 'auth/setTokens',
      payload: { access: { token, expires: Date.now() + 3600 * 1000 } },
    });
  });

  it('should create a patient', async () => {
    const newPatient: Partial<Patient> = {
      name: 'Test Patient',
      email: `test${Math.floor(Math.random() * 10000)}@example.com`,
      phone: '1234567890',
    };
    const result = await patientApi.endpoints.createPatient.initiate(newPatient)(store.dispatch, store.getState, {});

    if ('error' in result) {
        throw new Error(`Create patient failed with error: ${JSON.stringify(result.error)}`);
    } else {
        expect(result.data).toMatchObject({
            id: expect.any(String),
            name: newPatient.name,
            email: newPatient.email,
            phone: newPatient.phone,
        });
    }
  });

  it('should get all patients', async () => {
    const queryParams = { name: 'Test', role: 'patient', sortBy: 'name:asc', limit: 10, page: 1 };
    const result = await patientApi.endpoints.getAllPatients.initiate(queryParams)(store.dispatch, store.getState, {});

    if ('error' in result) {
      throw new Error(`Get all patients failed with error: ${JSON.stringify(result.error)}`);
    } else {
      expect(result.data?.results).toBeInstanceOf(Array);
    }
  });

  it('should get a patient', async () => {
    const result = await patientApi.endpoints.getPatient.initiate({ id: patientId })(store.dispatch, store.getState, {});

    if ('error' in result) {
      throw new Error(`Get patient failed with error: ${JSON.stringify(result.error)}`);
    } else {
      expect(result.data).toMatchObject({
        id: patientId,
        name: expect.any(String),
        email: expect.any(String),
        phone: expect.any(String),
      });
    }
  });

  it('should update a patient', async () => {
    const updatedPatient: Partial<Patient> = {
      name: 'Updated Patient',
      email: `updated${Math.floor(Math.random() * 10000)}@example.com`,
      phone: '0987654321',
    };
    const result = await patientApi.endpoints.updatePatient.initiate({ id: patientId, patient: updatedPatient })(store.dispatch, store.getState, {});

    if ('error' in result) {
      throw new Error(`Update patient failed with error: ${JSON.stringify(result.error)}`);
    } else {
      expect(result.data).toMatchObject({
        id: patientId,
        name: updatedPatient.name,
        email: updatedPatient.email,
        phone: updatedPatient.phone,
      });
    }
  });

  it('should delete a patient', async () => {
    const result = await patientApi.endpoints.deletePatient.initiate({ id: patientId })(store.dispatch, store.getState, {});

    if ('error' in result) {
      throw new Error(`Delete patient failed with error: ${JSON.stringify(result.error)}`);
    } else {
      expect(result.data).toBeUndefined();
    }
  });

  it('should assign a caregiver to a patient', async () => {
    const caregiverId = 'testCaregiverId'; // Replace with actual caregiverId
    const result = await patientApi.endpoints.assignCaregiver.initiate({ patientId, caregiverId })(store.dispatch, store.getState, {});

    if ('error' in result) {
      throw new Error(`Assign caregiver failed with error: ${JSON.stringify(result.error)}`);
    } else {
      expect(result.data).toBeUndefined();
    }
  });

  it('should remove a caregiver from a patient', async () => {
    const caregiverId = 'testCaregiverId'; // Replace with actual caregiverId
    const result = await patientApi.endpoints.removeCaregiver.initiate({ patientId, caregiverId })(store.dispatch, store.getState, {});

    if ('error' in result) {
      throw new Error(`Remove caregiver failed with error: ${JSON.stringify(result.error)}`);
    } else {
      expect(result.data).toBeUndefined();
    }
  });

  it('should get conversations by patient', async () => {
    const result = await patientApi.endpoints.getConversationsByPatient.initiate({ patientId })(store.dispatch, store.getState, {});

    if ('error' in result) {
      throw new Error(`Get conversations by patient failed with error: ${JSON.stringify(result.error)}`);
    } else {
      expect(result.data).toBeInstanceOf(Array);
    }
  });

  it('should get caregivers of a patient', async () => {
    const result = await patientApi.endpoints.getCaregivers.initiate({ patientId })(store.dispatch, store.getState, {});

    if ('error' in result) {
      throw new Error(`Get caregivers of a patient failed with error: ${JSON.stringify(result.error)}`);
    } else {
      expect(result.data).toBeInstanceOf(Array);
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
