// Import integration setup FIRST to ensure proper mocking
require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
// Import integration test app AFTER all mocks are set up
const app = require('../utils/integration-app');
const logger = require('../../src/config/logger');
const { Alert, Org, Caregiver, Patient, Schedule } = require('../../src/models');
const { caregiverOne, insertCaregiversAndAddToOrg } = require('../fixtures/caregiver.fixture');
const { alertOne, insertAlerts } = require('../fixtures/alert.fixture');
const { tokenService, twilioCallService } = require('../../src/services');
const { orgOne, insertOrgs } = require('../fixtures/org.fixture');
const { patientOne, insertPatientsAndAddToCaregiver } = require('../fixtures/patient.fixture');
const { scheduleOne, insertScheduleAndAddToPatient } = require('../fixtures/schedule.fixture');
const { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } = require('../utils/mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('Call routes', () => {
  let alertId;
  let org;
  let caregiver;
  let patient;
  let caregiverToken;

  beforeEach(async () => {
    [org] = await insertOrgs([orgOne]);
    [caregiver] = await insertCaregiversAndAddToOrg(org, [caregiverOne]);
    [patient] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);
    const schedules = await insertScheduleAndAddToPatient(patient, scheduleOne);
    const alerts = await insertAlerts(caregiver, 'Caregiver', [alertOne]);
  });

  afterEach(async () => {
    await Alert.deleteMany();
    await Caregiver.deleteMany();
    await Patient.deleteMany();
    await Org.deleteMany();
    await Schedule.deleteMany();
  });

  it('should test that the correct user gets a call', async () => {
    logger.info('calling twilio');
    // await twilioCallService.initiateCall(patient.id);
  });

  // it('should all users who are scheduled to get a call, get a call', async () => {
  //   await runSchedules();
  // });
});
