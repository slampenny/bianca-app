const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../src/app');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Alert, Org, Caregiver, Patient } = require('../../src/models');
const { caregiverOne, insertCaregiversAndAddToOrg, admin } = require('../fixtures/caregiver.fixture');
const { alertOne, alertTwo, insertAlerts } = require('../fixtures/alert.fixture');
const { tokenService } = require('../../src/services');
const { org } = require('../../src/utils/ownershipChecks');
const { orgOne, insertOrgs } = require('../fixtures/org.fixture');
const { login } = require('../../src/validations/auth.validation');

let mongoServer;

beforeAll(async () => {
    mongoServer = new MongoMemoryServer();
  await mongoServer.start();
  const mongoUri = await mongoServer.getUri();
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Alert routes', () => {
  let alertId;
  let org;
  let caregiver;
  let caregiverToken;

  beforeEach(async () => {
    [org] = await insertOrgs([orgOne]);
    [caregiver] = await insertCaregiversAndAddToOrg(org, [caregiverOne]);
    const alerts = await insertAlerts(caregiver, "Caregiver", [alertOne]);
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
    const res = await 
    request(app)
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
    const res = await request(app)
      .get('/v1/alerts')
      .set('Authorization', `Bearer ${caregiverToken}`);
  
    expect(res.statusCode).toEqual(httpStatus.OK);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should get a specific alert', async () => {
    const res = await request(app)
      .get(`/v1/alerts/${alertId}`)
      .set('Authorization', `Bearer ${caregiverToken}`);
  
    expect(res.statusCode).toEqual(httpStatus.OK);
    expect(res.body.id).toEqual(alertId.toString());
  });

  it('should update a specific alert', async () => {
    const res = await request(app)
      .patch(`/v1/alerts/${alertId}`)
      .set('Authorization', `Bearer ${caregiverToken}`)
      .send({
        message: 'Updated Alert Message'
      });
  
    expect(res.statusCode).toEqual(httpStatus.OK);
    expect(res.body.message).toEqual('Updated Alert Message');
  
    const updatedAlert = await Alert.findById(alertId);
    expect(updatedAlert.message).toEqual('Updated Alert Message');
  });

  it('should delete a specific alert', async () => {
    const res = await request(app)
      .delete(`/v1/alerts/${alertId}`)
      .set('Authorization', `Bearer ${caregiverToken}`);
  
    expect(res.statusCode).toEqual(httpStatus.NO_CONTENT);
  
    const alert = await Alert.findById(alertId);
    expect(alert).toBeNull();
  });
});
