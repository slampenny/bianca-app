// FILEPATH: /home/jordanlapp/code/bianca-app/bianca-app-backend/tests/integration/twilioCall.route.test.js
require('openai/shims/node');
const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../../src/app');
const twilioCallController = require('../../../src/controllers/twilioCall.controller');

jest.mock('../../../src/controllers/twilioCall.controller');

describe('Twilio Calls Routes', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('POST /v1/twilio/prepare-call', () => {
    test('should forward the request to the controller', async () => {
      twilioCallController.prepareCall.mockReturnValueOnce({});
      const response = await request(app)
        .post('/v1/twilio/prepare-call')
        .send();

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toEqual(expect.stringContaining('text/xml'));
      expect(twilioCallController.prepareCall).toBeCalled();
    });
  });

  describe('POST /v1/twilio/real-time-interaction', () => {
    test('should forward the request to the controller', async () => {
      twilioCallController.handleRealTimeInteraction.mockReturnValueOnce({});
      await request(app)
        .post('/v1/twilio/real-time-interaction')
        .send()
        .expect(httpStatus.OK);
      expect(twilioCallController.handleRealTimeInteraction).toBeCalled();
    });
  });

  describe('POST /v1/twilio/initiate', () => {
    test('should forward the request to the controller', async () => {
      twilioCallController.initiateCall.mockReturnValueOnce({});
      await request(app)
        .post('/v1/twilio/initiate')
        .send({ userId: 'testUserId' })
        .expect(httpStatus.OK);
      expect(twilioCallController.initiateCall).toBeCalled();
    });
  });
});