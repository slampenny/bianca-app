import { EnhancedStore } from '@reduxjs/toolkit';
import { scheduleApi } from '../'; // Adjust the import path to your scheduleApi
import { store as appStore, RootState } from "../../../store/store";
import { setupSchedule, setupPatient } from "../../../../test/helpers"; // Create these helpers if not already existing
import { Schedule, Patient } from '../api.types';

describe('scheduleApi', () => {
  let store: EnhancedStore<RootState>;
  let patient: Patient;
  let schedule: Schedule;
  let patientId: string;
  let scheduleId: string;

  beforeEach(async () => {
    store = appStore;
    patient = await setupPatient();
    patientId = patient.id;
    schedule = await setupSchedule(patientId);
    scheduleId = schedule.id;
  });

  afterEach(async () => {
    // Clean up actions if required
    await scheduleApi.endpoints.deleteSchedule.initiate({ scheduleId })(store.dispatch, store.getState, {});
    jest.clearAllMocks();
  });

  it('should create a schedule', async () => {
    const newSchedule: Partial<Schedule> = {
      frequency: 'weekly',
      intervals: [{ day: 3, weeks: 1 }],
      time: '10:00'
    };

    const result = await store.dispatch(scheduleApi.endpoints.createSchedule.initiate({ patientId, data: newSchedule }));
    
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
  });

  it('should get a schedule', async () => {
    const result = await store.dispatch(scheduleApi.endpoints.getSchedule.initiate({ scheduleId }));
    
    expect(result.data).toMatchObject({
      id: scheduleId,
      frequency: schedule.frequency,
      intervals: schedule.intervals,
      time: schedule.time
    });
  });
  it('should update a schedule', async () => {
    const updatedSchedule: Partial<Schedule> = {
      frequency: 'monthly',
      intervals: [{ day: 15 }],
      time: '14:00'
    };

    const result = await store.dispatch(scheduleApi.endpoints.updateSchedule.initiate({ scheduleId, data: updatedSchedule }));
    
    expect(result.data).toMatchObject({
      id: scheduleId,
      frequency: 'monthly',
      intervals: expect.arrayContaining([
        expect.objectContains({
          day: 15
        })
      ]),
      time: '14:00'
    });
  });
  it('should delete a schedule', async () => {
    const result = await store.dispatch(scheduleApi.endpoints.deleteSchedule.initiate({ scheduleId }));
    
    expect(result.data).toEqual({ success: true });
  });
});

