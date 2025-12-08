// Import integration setup FIRST to ensure proper mocking
require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
// Import integration test app AFTER all mocks are set up
const app = require('../utils/integration-app');
const { Alert, Org, Caregiver, Patient } = require('../../src/models');
const { caregiverOne, insertCaregiversAndAddToOrg, admin } = require('../fixtures/caregiver.fixture');
const { alertOne, alertTwo, insertAlerts } = require('../fixtures/alert.fixture');
const { tokenService } = require('../../src/services');
const { org } = require('../../src/utils/ownershipChecks');
const { orgOne, insertOrgs } = require('../fixtures/org.fixture');
const { login } = require('../../src/validations/auth.validation');
const { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } = require('../utils/mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('Alert routes', () => {
  let alertId;
  let org;
  let caregiver;
  let caregiverToken;

  beforeEach(async () => {
    [org] = await insertOrgs([orgOne]);
    [caregiver] = await insertCaregiversAndAddToOrg(org, [caregiverOne]);
    const alerts = await insertAlerts(caregiver, 'Caregiver', [alertOne]);
    alertId = alerts[0].id;
    const tokens = await tokenService.generateAuthTokens(caregiver);
    caregiverToken = tokens.access.token;
  });

  afterEach(async () => {
    await Alert.deleteMany();
    await Caregiver.deleteMany();
    await Patient.deleteMany();
    await Org.deleteMany();
  });

  it('should create a new alert', async () => {
    const res = await request(app)
      .post('/v1/alerts')
      .set('Authorization', `Bearer ${caregiverToken}`)
      .send({
        ...alertTwo,
        createdBy: caregiver.id,
        createdModel: 'Caregiver',
      });

    expect(res.statusCode).toEqual(httpStatus.CREATED);
    expect(res.body).toHaveProperty('message', alertTwo.message);

    const alert = await Alert.findById(res.body.id);
    expect(alert).not.toBeNull();
    expect(alert.message).toEqual(alertTwo.message);
  });

  it('should get all alerts', async () => {
    const res = await request(app).get('/v1/alerts').set('Authorization', `Bearer ${caregiverToken}`);

    expect(res.statusCode).toEqual(httpStatus.OK);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should get a specific alert', async () => {
    const res = await request(app).get(`/v1/alerts/${alertId}`).set('Authorization', `Bearer ${caregiverToken}`);

    expect(res.statusCode).toEqual(httpStatus.OK);
    expect(res.body.id).toEqual(alertId.toString());
  });

  it('should update a specific alert', async () => {
    const res = await request(app).patch(`/v1/alerts/${alertId}`).set('Authorization', `Bearer ${caregiverToken}`).send({
      message: 'Updated Alert Message',
    });

    expect(res.statusCode).toEqual(httpStatus.OK);
    expect(res.body.message).toEqual('Updated Alert Message');

    const updatedAlert = await Alert.findById(alertId);
    expect(updatedAlert.message).toEqual('Updated Alert Message');
  });

  it('should delete a specific alert', async () => {
    const res = await request(app).delete(`/v1/alerts/${alertId}`).set('Authorization', `Bearer ${caregiverToken}`);

    expect(res.statusCode).toEqual(httpStatus.NO_CONTENT);

    const alert = await Alert.findById(alertId);
    expect(alert).toBeNull();
  });

  // it('should filter alerts by read status when showRead=true', async () => {
  //   // Create a read alert (non-empty readBy) and an unread alert (empty readBy)
  //   const readAlert = {
  //     ...alertTwo,
  //     message: 'Read Alert',
  //     createdBy: caregiver.id,
  //     createdModel: 'Caregiver',
  //     readBy: [caregiver.id] // Mark as read
  //   };

  //   const unreadAlert = {
  //     ...alertTwo,
  //     message: 'Unread Alert',
  //     createdBy: caregiver.id,
  //     createdModel: 'Caregiver',
  //     readBy: [] // Unread
  //   };

  //   // Insert both alerts
  //   await request(app)
  //     .post('/v1/alerts')
  //     .set('Authorization', `Bearer ${caregiverToken}`)
  //     .send(readAlert);

  //   await request(app)
  //     .post('/v1/alerts')
  //     .set('Authorization', `Bearer ${caregiverToken}`)
  //     .send(unreadAlert);

  //   // Now request alerts with the showRead filter enabled
  //   const res = await request(app)
  //     .get('/v1/alerts?showRead=true')
  //     .set('Authorization', `Bearer ${caregiverToken}`);

  //   expect(res.statusCode).toEqual(httpStatus.OK);
  //   // Verify that every alert in the response has a non-empty readBy array
  //   res.body.forEach(alert => {
  //     expect(Array.isArray(alert.readBy)).toBe(true);
  //     expect(alert.readBy.length).toBeGreaterThan(0);
  //   });
  // });

  // it('should filter alerts by read status when showRead=true', async () => {
  //   // Create a read alert (non-empty readBy) and an unread alert (empty readBy)
  //   const readAlert = {
  //     ...alertTwo,
  //     message: 'Read Alert',
  //     createdBy: caregiver.id,
  //     createdModel: 'Caregiver',
  //     readBy: [caregiver.id] // Mark as read
  //   };

  //   const unreadAlert = {
  //     ...alertTwo,
  //     message: 'Unread Alert',
  //     createdBy: caregiver.id,
  //     createdModel: 'Caregiver',
  //     readBy: [] // Unread
  //   };

  //   // Insert both alerts
  //   await request(app)
  //     .post('/v1/alerts')
  //     .set('Authorization', `Bearer ${caregiverToken}`)
  //     .send(readAlert);

  //   await request(app)
  //     .post('/v1/alerts')
  //     .set('Authorization', `Bearer ${caregiverToken}`)
  //     .send(unreadAlert);

  //   // Now request alerts with the showRead filter enabled
  //   const res = await request(app)
  //     .get('/v1/alerts?showRead=true')
  //     .set('Authorization', `Bearer ${caregiverToken}`);

  //   expect(res.statusCode).toEqual(httpStatus.OK);
  //   // Verify that every alert in the response has a non-empty readBy array
  //   res.body.forEach(alert => {
  //     expect(Array.isArray(alert.readBy)).toBe(true);
  //     expect(alert.readBy.length).toBeGreaterThan(0);
  //   });
  // });
  it('should filter alerts by unread status when showRead=false', async () => {
    // Create a read alert (non-empty readBy) and an unread alert (empty readBy)
    const readAlert = {
      ...alertTwo,
      message: 'Read Alert',
      createdBy: caregiver.id,
      createdModel: 'Caregiver',
      readBy: [caregiver.id], // Mark as read
    };

    const unreadAlert = {
      ...alertTwo,
      message: 'Unread Alert',
      createdBy: caregiver.id,
      createdModel: 'Caregiver',
      readBy: [], // Unread
    };

    // Insert both alerts
    await request(app).post('/v1/alerts').set('Authorization', `Bearer ${caregiverToken}`).send(readAlert);

    await request(app).post('/v1/alerts').set('Authorization', `Bearer ${caregiverToken}`).send(unreadAlert);

    // Request alerts with the showRead filter set to false
    const res = await request(app).get('/v1/alerts?showRead=false').set('Authorization', `Bearer ${caregiverToken}`);

    expect(res.statusCode).toEqual(httpStatus.OK);
    // Verify that every alert in the response has an empty readBy array (i.e. unread)
    res.body.forEach((alert) => {
      expect(Array.isArray(alert.readBy)).toBe(true);
      expect(alert.readBy.length).toEqual(0);
    });
  });
});
