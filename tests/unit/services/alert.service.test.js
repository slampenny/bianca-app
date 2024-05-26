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
  let alert, alert2;

  afterEach(async () => {
    await Alert.deleteMany();
    await Caregiver.deleteMany();
    await Patient.deleteMany();
    await Org.deleteMany();
  });

  beforeEach(async () => {
    [org] = await insertOrgs([orgOne]);
    [caregiver] = await insertCaregiversAndAddToOrg(org, [admin]);
    [patient] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);
    [alert] = await insertAlerts(caregiver, 'Caregiver', [alertOne, expiredAlert]);
    [alert2] = await insertAlerts(caregiver, 'Caregiver', [alertTwo]);
    await insertAlerts(caregiver, 'Caregiver', [alertThree]);
  });

  it('should create a new alert', async () => {
    const alert = await alertService.createAlert({
      ...alertOne,
      createdBy: caregiver.id,
      createdModel: 'Caregiver',
    });
    expect(alert).toHaveProperty('id');
    expect(alert).toHaveProperty('message', alertOne.message);
    expect(alert).toHaveProperty('importance', alertOne.importance);
  });

  it('should get an alert by id', async () => {
    const fetchedAlert = await alertService.getAlertById(alert.id);
    expect(fetchedAlert._id.toString()).toBe(alert._id.toString());
  });

  it('should update an alert by id', async () => {
    const updateBody = { message: 'Updated Message' };
    const updatedAlert = await alertService.updateAlertById(alert.id, updateBody);
    expect(updatedAlert).toHaveProperty('message', updateBody.message);
  });

  it('should mark an alert as read', async () => {
    const updatedAlert = await alertService.markAlertAsRead(alert.id);
    expect(updatedAlert.readBy).toEqual(expect.any(Array));
    expect(updatedAlert.readBy).not.toContain(expect.arrayContaining([undefined]));
  });

  it('should delete an alert by id', async () => {
    await alertService.deleteAlertById(alert.id);
    await expect(alertService.getAlertById(alert.id)).rejects.toThrow('Alert not found');
  });

  it('should only return relevant and unread alerts to a caregiver', async () => {
    const alerts = await alertService.getAlerts(caregiver.id, false);
    expect(alerts).not.toContainEqual(expect.objectContaining({ _id: expiredAlert._id }));
    expect(alerts).not.toContainEqual(expect.objectContaining({ _id: alertOne._id })); // Assuming alertOne is read
  });

  it('should filter alerts based on caregiver role', async () => {
    const [notAdmin] = await insertCaregiversAndAddToOrg(org, [caregiverOne]);
    const adminAlerts = await alertService.getAlerts(caregiver.id, true);
    const regularAlerts = await alertService.getAlerts(notAdmin.id, true);

    // Debugging
    console.log('adminAlerts:', adminAlerts);
    console.log('alert.id:', alert.id);

    expect(adminAlerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: alert2.id }), // Visible to orgAdmin only
      ])
    );
    expect(regularAlerts).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: alert2.id }), // Visible to orgAdmin only
        ])
      );
  });
});
