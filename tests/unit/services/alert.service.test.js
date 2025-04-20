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
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
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
});
