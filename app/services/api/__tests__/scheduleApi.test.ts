import { EnhancedStore } from '@reduxjs/toolkit';
import { orgApi, patientApi, scheduleApi } from '../'; // Adjust the import path to your scheduleApi
import { store as appStore, RootState } from "../../../store/store";
import { newSchedule } from "../../../../test/fixtures/schedule.fixture";
import { newCaregiver } from "../../../../test/fixtures/caregiver.fixture";
import { registerNewOrgAndCaregiver, createPatientInOrg } from '../../../../test/helpers';
import { Org, Schedule, Patient } from '../api.types';

describe('scheduleApi', () => {
  let store: EnhancedStore<RootState>;
  let patient: Patient;
  let schedule: Schedule;
  let org: Org;
  let orgId: string;
  let patientId: string;
  let scheduleId: string;

  beforeEach(async () => {
    store = appStore;
    const testCaregiver = newCaregiver();
    const response = await registerNewOrgAndCaregiver(testCaregiver.name, testCaregiver.email, testCaregiver.password, testCaregiver.phone);
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

    const resultSchedule = await scheduleApi.endpoints.createSchedule.initiate({ patientId, data: newSchedule() })(store.dispatch, store.getState, {});
    if ('data' in resultSchedule) {
      schedule = resultSchedule.data;
    } else {
      throw new Error(`Create schedule failed with error: ${JSON.stringify(result)}`);
    }
    scheduleId = schedule.id as string;
  });

  afterEach(async () => {
    // Clean up actions if required
    await orgApi.endpoints.deleteOrg.initiate({ orgId: orgId })(store.dispatch, store.getState, {});
    jest.clearAllMocks();
  });

  it('should create a schedule', async () => {
    const newSchedule: Partial<Schedule> = {
      frequency: 'weekly',
      intervals: [{ day: 3, weeks: 1 }],
      time: '10:00'
    };

    const result = await scheduleApi.endpoints.createSchedule.initiate({ patientId, data: newSchedule })(store.dispatch, store.getState, {});
    
    if ('data' in result) {
      expect(result.data).toMatchObject({
        id: expect.any(String),
        frequency: newSchedule.frequency,
        intervals: expect.arrayContaining([
          expect.objectContaining({
            day: 3,
            weeks: 1
          })
        ]),
        time: newSchedule.time
      });

      const resultPatient = await patientApi.endpoints.getPatient.initiate({ id: patientId })(store.dispatch, store.getState, {});
      if ('data' in resultPatient) {
        expect(resultPatient.data).toMatchObject({
          schedules: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              frequency: newSchedule.frequency,
              intervals: expect.arrayContaining([
                expect.objectContaining({
                  day: 3,
                  weeks: 1
                })
              ]),
              time: newSchedule.time
            })
          ])
        });
      }
    } else {
      throw new Error(`Create schedule failed with error: ${JSON.stringify(result)}`);
    }
  });

  it('should get a schedule', async () => {
    const result = await scheduleApi.endpoints.getSchedule.initiate({ scheduleId })(store.dispatch, store.getState, {});
    
    if ('data' in result) {
      expect(result.data).toMatchObject({
        id: scheduleId,
        frequency: schedule.frequency,
        intervals: schedule.intervals,
        time: schedule.time
      });
    } else {
      throw new Error(`Get schedule failed with error: ${JSON.stringify(result)}`);
    }
  });
  it('should update a schedule', async () => {
    const updatedSchedule: Partial<Schedule> = {
      frequency: 'monthly',
      intervals: [{ day: 15 }],
      time: '14:00'
    };

    const result = await scheduleApi.endpoints.updateSchedule.initiate({ scheduleId, data: updatedSchedule })(store.dispatch, store.getState, {});
    
    if ('data' in result) {
      expect(result.data).toMatchObject({
        id: scheduleId,
        frequency: 'monthly',
        intervals: expect.arrayContaining([
          expect.objectContaining({
            day: 15
          })
        ]),
        time: '14:00'
      });
    } else {
      throw new Error(`Create schedule failed with error: ${JSON.stringify(result)}`);
    }
  });
  it('should delete a schedule', async () => {
    const result = await scheduleApi.endpoints.deleteSchedule.initiate({ scheduleId })(store.dispatch, store.getState, {});
    console.log (`result: ${JSON.stringify(result)}`);
    if ('data' in result) {
      expect(result.data).toBeNull();
    } else {
      throw new Error(`Create schedule failed with error: ${JSON.stringify(result)}`);
    }
  });
});

