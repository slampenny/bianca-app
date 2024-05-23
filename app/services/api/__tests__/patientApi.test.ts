import { EnhancedStore } from '@reduxjs/toolkit';
import { orgApi, patientApi } from '../';
import { store as appStore, RootState } from "../../../store/store";
import { registerNewOrgAndCaregiver, createPatientInOrg } from "../../../../test/helpers";
import { newCaregiver } from '../../../../test/fixtures/caregiver.fixture';
import { Org, Patient } from '../api.types';

describe('patientApi', () => {
  let store: EnhancedStore<RootState>;
  let org: Org;
  let orgId: string;
  let caregiverId: string;
  let patient: Patient;
  let patientId: string;

  beforeEach(async () => {
    store = appStore;
    const testCaregiver = newCaregiver();
    const response = await registerNewOrgAndCaregiver(testCaregiver.name, testCaregiver.email, testCaregiver.password, testCaregiver.phone);
    caregiverId = response.caregiver.id as string;
    org = response.org;
    orgId = response.org.id as string;
    // authTokens = response.tokens;

    const result = await createPatientInOrg(org, testCaregiver.email, testCaregiver.password) as Patient;
    if ('error' in result) {
      throw new Error(`Create patient failed with error: ${JSON.stringify(result.error)}`);
    } else {
      patient = result;
      patientId = patient.id as string;
    }
  });
  
  afterEach(async () => {
    await orgApi.endpoints.deleteOrg.initiate({ orgId: orgId })(store.dispatch, store.getState, {});
    jest.clearAllMocks();
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
      expect(result.data).toBeNull();
    }
  });

  it('should assign a caregiver to a patient', async () => {
    const result = await patientApi.endpoints.assignCaregiver.initiate({ patientId, caregiverId })(store.dispatch, store.getState, {});

    if ('error' in result) {
      throw new Error(`Assign caregiver failed with error: ${JSON.stringify(result.error)}`);
    } else {
      expect(result.data).toBeDefined();
      expect(result.data.caregivers).toContain(caregiverId);
    }
  });

  it('should remove a caregiver from a patient', async () => {
    const result = await patientApi.endpoints.unassignCaregiver.initiate({ patientId, caregiverId })(store.dispatch, store.getState, {});

    if ('error' in result) {
      throw new Error(`Remove caregiver failed with error: ${JSON.stringify(result.error)}`);
    } else {
      expect(result.data).toBeDefined();
      expect(result.data.caregivers).toEqual([]);
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
