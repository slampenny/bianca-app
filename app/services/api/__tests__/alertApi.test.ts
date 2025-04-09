import { EnhancedStore } from '@reduxjs/toolkit';
import { alertApi, orgApi } from '../';
import { store as appStore, RootState } from '../../../store/store';
import { registerNewAlert, registerNewOrgAndCaregiver } from '../../../../test/helpers';
import { newAlert } from '../../../../test/fixtures/alert.fixture';
import { newCaregiver } from '../../../../test/fixtures/caregiver.fixture';
import { Alert, Caregiver } from '../api.types';

describe('alertApi', () => {
  let store: EnhancedStore<RootState>;
  let caregiver: Caregiver;
  let orgId: string;
  let alertId: string;

  beforeEach(async () => {
    store = appStore;
    const testCaregiver = newCaregiver();
    const response = await registerNewOrgAndCaregiver(testCaregiver.name, testCaregiver.email, testCaregiver.password, testCaregiver.phone);
    orgId = response.org.id as string;
    caregiver = response.caregiver as Caregiver;

    const testAlert = newAlert(caregiver, "Caregiver");
    const responseAlert = await registerNewAlert(testAlert);
    alertId = responseAlert.id as string;
  });
  
  afterEach(async () => {
    await orgApi.endpoints.deleteOrg.initiate({ orgId: orgId })(store.dispatch, store.getState, {});
    jest.clearAllMocks();
  });

  it('should get all alerts', async () => {
    const result = await alertApi.endpoints.getAllAlerts.initiate()(store.dispatch, store.getState, {});
    if ('error' in result) {
      throw new Error(`Get all alerts failed with error: ${JSON.stringify(result.error)}`);
    } else {
      expect(result.data).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          message: expect.any(String),
        }),
      ]));
    }
  });

  it('should get an alert', async () => {
    const result = await alertApi.endpoints.getAlert.initiate({ alertId: alertId })(store.dispatch, store.getState, {});
    if ('error' in result) {
      throw new Error(`Get alert failed with error: ${JSON.stringify(result.error)}`);
    } else {
      expect(result.data).toEqual(expect.objectContaining({
        id: alertId,
        message: expect.any(String),
      }));
    }
  });

  it('should update an alert', async () => {
    const updatedAlert = { message: 'This is an updated alert.' } as Partial<Alert>;
    const result = await alertApi.endpoints.updateAlert.initiate({ alertId: alertId, alert: updatedAlert })(store.dispatch, store.getState, {});

    if ('error' in result) {
      throw new Error(`Update alert failed with error: ${JSON.stringify(result.error)}`);
    } else {
      expect(result.data).toMatchObject({
        id: alertId,
        message: updatedAlert.message,
      });
    }
  });

  it('should delete an alert', async () => {
    const testAlert = newAlert(caregiver, "Caregiver");
    const responseAlert = await registerNewAlert(testAlert);

    const result = await alertApi.endpoints.deleteAlert.initiate({ alertId: responseAlert.id as string })(store.dispatch, store.getState, {});
    if ('error' in result) {
      throw new Error(`Remove alert failed with error: ${JSON.stringify(result.error)}`);
    } else {
      expect(result.data).toBeNull();
    }
  });

  it('should mark an alert as read', async () => {
    const result = await alertApi.endpoints.markAlertAsRead.initiate({ alertId })(store.dispatch, store.getState, {});
    if ('error' in result) {
      throw new Error(`Mark alert as read failed with error: ${JSON.stringify(result.error)}`);
    } else {
      expect(result.data).toMatchObject({
        id: alertId,
        readBy: expect.arrayContaining([expect.any(String)]),
      });
    }
  });  
});