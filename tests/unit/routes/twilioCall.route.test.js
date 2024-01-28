// FILEPATH: /home/jordanlapp/code/bianca-app/bianca-app-backend/tests/integration/twilioCall.route.test.js

const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../../src/app');
const twilioCallController = require('../../../src/controllers/twilioCall.controller');

jest.mock('../../../src/controllers/twilioCall.controller');

describe('Twilio Calls Routes', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('POST /twilio/call-handler', () => {
    test('should forward the request to the controller', async () => {
      twilioCallController.handleIncomingCall.mockReturnValueOnce({});
      await request(app)
        .post('/twilio/call-handler')
        .send()
        .expect(httpStatus.OK);
      expect(twilioCallController.handleIncomingCall).toBeCalled();
    });
  });

  describe('POST /twilio/process-recording', () => {
    test('should forward the request to the controller', async () => {
      twilioCallController.processCallRecording.mockReturnValueOnce({});
      await request(app)
        .post('/twilio/process-recording')
        .send()
        .expect(httpStatus.OK);
      expect(twilioCallController.processCallRecording).toBeCalled();
    });
  });

  describe('POST /twilio/real-time-interaction', () => {
    test('should forward the request to the controller', async () => {
      twilioCallController.handleRealTimeInteraction.mockReturnValueOnce({});
      await request(app)
        .post('/twilio/real-time-interaction')
        .send()
        .expect(httpStatus.OK);
      expect(twilioCallController.handleRealTimeInteraction).toBeCalled();
    });
  });

  describe('POST /calls/initiate', () => {
    test('should forward the request to the controller', async () => {
      twilioCallController.processCallRecording.mockReturnValueOnce({});
      await request(app)
        .post('/calls/initiate')
        .send({ userId: 'testUserId' })
        .expect(httpStatus.OK);
      expect(twilioCallController.processCallRecording).toBeCalled();
    });
  });
});