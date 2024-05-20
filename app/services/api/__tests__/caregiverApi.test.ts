import { EnhancedStore } from '@reduxjs/toolkit';
import { caregiverApi } from '../';
import { store as appStore, RootState } from '../../../store/store';
import { cleanTestDatabase, registerNewOrgAndCaregiver } from '../../../../test/helpers';
import { newCaregiver } from '../../../../test/fixtures/caregiver.fixture';
import { Caregiver } from '../api.types';

describe('caregiverApi', () => {
  let store: EnhancedStore<RootState>;
  let caregiverId: string;
  // let authTokens: { access: { token: string, expires: string }, refresh: { token: string, expires: string } };

  beforeEach(async () => {
    store = appStore;
    const response = await registerNewOrgAndCaregiver(newCaregiver.name, newCaregiver.email, newCaregiver.password, newCaregiver.phone);
    caregiverId = response.caregiver.id as string;
    // authTokens = response.tokens;
  });
  
  afterEach(async () => {
    await cleanTestDatabase();
    jest.clearAllMocks();
  });

  it('should get all caregivers', async () => {
    const result = await caregiverApi.endpoints.getAllCaregivers.initiate({})(store.dispatch, store.getState, {});
    if ('error' in result) {
      throw new Error(`Get all caregivers failed with error: ${JSON.stringify(result.error)}`);
    } else {
      expect(result.data).toBeInstanceOf(Object);
      expect(result.data?.results).toBeInstanceOf(Array);
    }
  });

  it('should get a caregiver', async () => {
    const result = await caregiverApi.endpoints.getCaregiver.initiate({ id: caregiverId })(store.dispatch, store.getState, {});
    if ('error' in result) {
      throw new Error(`Get caregiver failed with error: ${JSON.stringify(result.error)}`);
    } else {
      expect(result.data).toMatchObject({
        id: caregiverId,
        name: expect.any(String),
        email: expect.any(String),
        phone: expect.any(String),
      });
    }
  });

  it('should update a caregiver', async () => {
    const updatedCaregiver = { name: 'Updated Caregiver', email: `updated${Date.now()}@example.com`, phone: '0987654321' } as Partial<Caregiver>;
    const result = await caregiverApi.endpoints.updateCaregiver.initiate({ id: caregiverId, caregiver: updatedCaregiver })(store.dispatch, store.getState, {});

    if ('error' in result) {
      throw new Error(`Update caregiver failed with error: ${JSON.stringify(result.error)}`);
    } else {
      expect(result.data).toMatchObject({
        id: caregiverId,
        name: updatedCaregiver.name,
        email: updatedCaregiver.email,
        phone: updatedCaregiver.phone,
      });
    }
  });

  it('should delete a caregiver', async () => {
    const result = await caregiverApi.endpoints.deleteCaregiver.initiate({ id: caregiverId })(store.dispatch, store.getState, {});
    if ('error' in result) {
      throw new Error(`Remove caregiver failed with error: ${JSON.stringify(result.error)}`);
    } else {
      expect(result.data).toBeNull();
    }
  });
});

describe('caregiverApi - patients', () => {
  let store: EnhancedStore<RootState>;
  let caregiverId: string;
  // let authTokens: { access: { token: string, expires: string }, refresh: { token: string, expires: string } };

  beforeEach(async () => {
    store = appStore;
    const response = await registerNewOrgAndCaregiver(newCaregiver.name, newCaregiver.email, newCaregiver.password, newCaregiver.phone);
    caregiverId = response.caregiver.id as string;
  });
  
  afterEach(async () => {
    await cleanTestDatabase();
    jest.clearAllMocks();
  });

  // it('should assign a caregiver to a patient', async () => {
  //   const patientId = 'testPatientId';
  //   const result = await caregiverApi.endpoints.assignCaregiver.initiate({ patientId, caregiverId })(store.dispatch, store.getState, {});
  //   if ('error' in result) {
  //     throw new Error(`Assign caregiver failed with error: ${JSON.stringify(result.error)}`);
  //   } else {
  //     expect(result.data).toBeUndefined();
  //   }
  // });

  // it('should remove a caregiver from a patient', async () => {
  //   const patientId = 'testPatientId';
  //   const result = await caregiverApi.endpoints.removeCaregiver.initiate({ patientId, caregiverId })(store.dispatch, store.getState, {});
  //   if ('error' in result) {
  //     throw new Error(`Remove caregiver failed with error: ${JSON.stringify(result.error)}`);
  //   } else {
  //     expect(result.data).toBeUndefined();
  //   }
  // });

  // it('should get patient for a caregiver', async () => {
  //   const patientId = 'testPatientId';
  //   const result = await caregiverApi.endpoints.getPatientForCaregiver.initiate({ patientId, caregiverId })(store.dispatch, store.getState, {});
  //   if ('error' in result) {
  //     throw new Error(`Get patient for caregiver failed with error: ${JSON.stringify(result.error)}`);
  //   } else {
  //     expect(result.data).toMatchObject({
  //       id: expect.any(String),
  //       name: expect.any(String),
  //       email: expect.any(String),
  //       phone: expect.any(String),
  //     });
  //   }
  // });

  it('should get patients for a caregiver', async () => {
    const result = await caregiverApi.endpoints.getPatientsForCaregiver.initiate(caregiverId)(store.dispatch, store.getState, {});
    if ('error' in result) {
      throw new Error(`Get patients for caregiver failed with error: ${JSON.stringify(result.error)}`);
    } else {
      expect(result.data).toBeInstanceOf(Array);
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});