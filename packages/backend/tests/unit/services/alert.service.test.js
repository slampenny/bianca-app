const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Alert, Caregiver, Org, Patient } = require('../../../src/models');
const alertService = require('../../../src/services/alert.service');
const { orgOne, insertOrgs } = require('../../fixtures/org.fixture');
const { caregiverOne, admin, insertCaregivers, insertCaregiversAndAddToOrg } = require('../../fixtures/caregiver.fixture');
const { alertOne, alertTwo, alertThree, expiredAlert, insertAlerts } = require('../../fixtures/alert.fixture');
const { patientOne, insertPatientsAndAddToCaregiver } = require('../../fixtures/patient.fixture');

let mongoServer;

beforeAll(async () => {
  mongoServer = new MongoMemoryServer();
  await mongoServer.start();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, {});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('alertService', () => {
  let org;
  let caregiver;
  let patient;
  let alert1;
  let alert2;

  afterEach(async () => {
    await Alert.deleteMany();
    await Caregiver.deleteMany();
    await Patient.deleteMany();
    await Org.deleteMany();
  });

  beforeEach(async () => {
    [org] = await insertOrgs([orgOne]);
    [adminCargiver] = await insertCaregiversAndAddToOrg(org, [admin]);
    [patient] = await insertPatientsAndAddToCaregiver(adminCargiver, [patientOne]);
    [alert1] = await insertAlerts(adminCargiver, 'Caregiver', [alertOne]);
    [alert2] = await insertAlerts(adminCargiver, 'Caregiver', [alertTwo]);
    [alert3] = await insertAlerts(adminCargiver, 'Caregiver', [alertThree]);
    await insertAlerts(adminCargiver, 'Caregiver', [expiredAlert]);
  });

  it('should create a new alert', async () => {
    const alertNew = await alertService.createAlert({
      ...alertOne,
      createdBy: adminCargiver.id,
      createdModel: 'Caregiver',
    });
    expect(alertNew).toHaveProperty('id');
    expect(alertNew).toHaveProperty('message', alertOne.message);
    expect(alertNew).toHaveProperty('importance', alertOne.importance);
  });

  it('should get an alert by id', async () => {
    const fetchedAlert = await alertService.getAlertById(alert1.id);
    expect(fetchedAlert._id.toString()).toBe(alert1._id.toString());
  });

  it('should update an alert by id', async () => {
    const updateBody = { message: 'Updated Message' };
    const updatedAlert = await alertService.updateAlertById(alert1.id, updateBody);
    expect(updatedAlert).toHaveProperty('message', updateBody.message);
  });

  it('should mark an alert as read', async () => {
    const updatedAlert = await alertService.markAlertAsRead(alert1.id);
    expect(updatedAlert.readBy).toEqual(expect.any(Array));
    expect(updatedAlert.readBy).not.toContain(expect.arrayContaining([undefined]));
  });

  it('should delete an alert by id', async () => {
    await alertService.deleteAlertById(alert1.id);
    await expect(alertService.getAlertById(alert1.id)).rejects.toThrow('Alert not found');
  });

  it('should only return relevant and unread alerts to a caregiver', async () => {
    console.log('alert1.id constructor:', alert1.id.constructor.name);
    console.log('caregiver.id constructor:', adminCargiver.id.constructor.name);

    await alertService.markAlertAsRead(alert1.id, adminCargiver.id);
    const alerts = await alertService.getAlerts(adminCargiver.id, false);

    expect(alerts).not.toContainEqual(expect.objectContaining({ _id: expiredAlert._id }));
    expect(alerts).not.toContainEqual(expect.objectContaining({ _id: alertOne._id }));
    expect(alerts).toEqual(
      expect.arrayContaining([expect.objectContaining({ _id: alert2._id }), expect.objectContaining({ _id: alert3._id })])
    );
    expect(alerts).toHaveLength(2);
  });

  it('should filter alerts based on caregiver role', async () => {
    const [notAdmin] = await insertCaregiversAndAddToOrg(org, [caregiverOne]);
    const adminAlerts = await alertService.getAlerts(adminCargiver.id, true);
    const regularAlerts = await alertService.getAlerts(notAdmin.id, true);

    expect(adminAlerts).toEqual(expect.arrayContaining([expect.objectContaining({ _id: alert2._id })]));
    expect(regularAlerts).not.toEqual(expect.arrayContaining([expect.objectContaining({ _id: alert2._id })]));
  });

  it('should prevent duplicate patient alerts with same message, relatedPatient, and visibility', async () => {
    const alertData = {
      message: 'Patient Test Patient has no schedule configured',
      importance: 'medium',
      alertType: 'patient',
      relatedPatient: patient._id,
      createdBy: patient._id,
      createdModel: 'Patient',
      visibility: 'assignedCaregivers',
      relevanceUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    };

    // Create first alert
    const firstAlert = await alertService.createAlert(alertData);
    expect(firstAlert).toHaveProperty('id');
    expect(firstAlert.message).toBe(alertData.message);

    // Try to create duplicate alert - should return the existing one
    const duplicateAlert = await alertService.createAlert(alertData);
    expect(duplicateAlert._id.toString()).toBe(firstAlert._id.toString());
    expect(duplicateAlert.message).toBe(alertData.message);

    // Verify only one alert exists in database
    const allAlerts = await Alert.find({ relatedPatient: patient._id, message: alertData.message });
    expect(allAlerts).toHaveLength(1);
  });

  it('should allow different alerts with different messages for same patient', async () => {
    const alertData1 = {
      message: 'Patient Test Patient has no schedule configured',
      importance: 'medium',
      alertType: 'patient',
      relatedPatient: patient._id,
      createdBy: patient._id,
      createdModel: 'Patient',
      visibility: 'assignedCaregivers',
      relevanceUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };

    const alertData2 = {
      message: 'Patient Test Patient needs attention',
      importance: 'high',
      alertType: 'patient',
      relatedPatient: patient._id,
      createdBy: patient._id,
      createdModel: 'Patient',
      visibility: 'assignedCaregivers',
      relevanceUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };

    const alert1 = await alertService.createAlert(alertData1);
    const alert2 = await alertService.createAlert(alertData2);

    expect(alert1._id.toString()).not.toBe(alert2._id.toString());
    expect(alert1.message).not.toBe(alert2.message);
  });

  it('should allow duplicate alert if previous one is expired', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    const expiredAlertData = {
      message: 'Patient Test Patient has no schedule configured',
      importance: 'medium',
      alertType: 'patient',
      relatedPatient: patient._id,
      createdBy: patient._id,
      createdModel: 'Patient',
      visibility: 'assignedCaregivers',
      relevanceUntil: pastDate, // Expired
    };

    const newAlertData = {
      message: 'Patient Test Patient has no schedule configured',
      importance: 'medium',
      alertType: 'patient',
      relatedPatient: patient._id,
      createdBy: patient._id,
      createdModel: 'Patient',
      visibility: 'assignedCaregivers',
      relevanceUntil: futureDate, // Still relevant
    };

    // Create expired alert
    const expiredAlert = await alertService.createAlert(expiredAlertData);
    expect(expiredAlert).toHaveProperty('id');

    // Create new alert with same message - should create new one since old is expired
    const newAlert = await alertService.createAlert(newAlertData);
    expect(newAlert._id.toString()).not.toBe(expiredAlert._id.toString());
  });
});
