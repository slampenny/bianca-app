const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { PrivacyRequest } = require('../../../src/models');

describe('PrivacyRequest Model', () => {
  let mongoServer;
  let caregiverId;
  let patientId;

  beforeAll(async () => {
    mongoServer = new MongoMemoryServer();
    await mongoServer.start();
    const mongoUri = await mongoServer.getUri();
    await mongoose.connect(mongoUri, {});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await PrivacyRequest.deleteMany({});
    caregiverId = new mongoose.Types.ObjectId();
    patientId = new mongoose.Types.ObjectId();
  });

  describe('Schema Validation', () => {
    it('should create a valid access request', async () => {
      const request = await PrivacyRequest.create({
        requestType: 'access',
        requestorType: 'caregiver',
        requestorId: caregiverId,
        requestorModel: 'Caregiver',
        informationRequested: 'All my personal information',
        accessMethod: 'email',
      });

      expect(request).toBeDefined();
      expect(request.requestType).toBe('access');
      expect(request.status).toBe('pending');
      expect(request.responseDeadline).toBeDefined();
    });

    it('should create a valid correction request', async () => {
      const request = await PrivacyRequest.create({
        requestType: 'correction',
        requestorType: 'caregiver',
        requestorId: caregiverId,
        requestorModel: 'Caregiver',
        informationRequested: 'Correction to email',
        correctionDetails: {
          field: 'email',
          currentValue: 'old@example.com',
          requestedValue: 'new@example.com',
          reason: 'Email changed',
        },
      });

      expect(request).toBeDefined();
      expect(request.requestType).toBe('correction');
      expect(request.correctionDetails).toBeDefined();
    });

    it('should set default responseDeadline to 30 days from requestDate', async () => {
      const requestDate = new Date('2025-01-01');
      const request = await PrivacyRequest.create({
        requestType: 'access',
        requestorType: 'caregiver',
        requestorId: caregiverId,
        requestorModel: 'Caregiver',
        informationRequested: 'Test',
        requestDate: requestDate,
      });

      const deadline = new Date(request.responseDeadline);
      const expectedDeadline = new Date(requestDate);
      expectedDeadline.setDate(expectedDeadline.getDate() + 30);

      expect(deadline.getTime()).toBeCloseTo(expectedDeadline.getTime(), -3); // Within 1 second
    });

    it('should reject invalid requestType', async () => {
      await expect(
        PrivacyRequest.create({
          requestType: 'invalid',
          requestorType: 'caregiver',
          requestorId: caregiverId,
          requestorModel: 'Caregiver',
          informationRequested: 'Test',
        })
      ).rejects.toThrow();
    });

    it('should reject invalid status', async () => {
      await expect(
        PrivacyRequest.create({
          requestType: 'access',
          requestorType: 'caregiver',
          requestorId: caregiverId,
          requestorModel: 'Caregiver',
          informationRequested: 'Test',
          status: 'invalid_status',
        })
      ).rejects.toThrow();
    });
  });

  describe('Static Methods', () => {
    it('should find requests approaching deadline', async () => {
      const fourDaysFromNow = new Date();
      fourDaysFromNow.setDate(fourDaysFromNow.getDate() + 4);

      await PrivacyRequest.create({
        requestType: 'access',
        requestorType: 'caregiver',
        requestorId: caregiverId,
        requestorModel: 'Caregiver',
        informationRequested: 'Test',
        status: 'pending',
        responseDeadline: fourDaysFromNow,
      });

      const requests = await PrivacyRequest.getApproachingDeadline();
      expect(requests.length).toBeGreaterThan(0);
    });

    it('should find overdue requests', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await PrivacyRequest.create({
        requestType: 'access',
        requestorType: 'caregiver',
        requestorId: caregiverId,
        requestorModel: 'Caregiver',
        informationRequested: 'Test',
        status: 'pending',
        responseDeadline: yesterday,
      });

      const requests = await PrivacyRequest.getOverdue();
      expect(requests.length).toBeGreaterThan(0);
    });

    it('should get requests by requestor', async () => {
      await PrivacyRequest.create({
        requestType: 'access',
        requestorType: 'caregiver',
        requestorId: caregiverId,
        requestorModel: 'Caregiver',
        informationRequested: 'Test 1',
      });

      await PrivacyRequest.create({
        requestType: 'access',
        requestorType: 'caregiver',
        requestorId: caregiverId,
        requestorModel: 'Caregiver',
        informationRequested: 'Test 2',
      });

      const requests = await PrivacyRequest.getByRequestor(caregiverId, 'Caregiver');
      expect(requests.length).toBe(2);
    });

    it('should calculate statistics', async () => {
      await PrivacyRequest.create({
        requestType: 'access',
        requestorType: 'caregiver',
        requestorId: caregiverId,
        requestorModel: 'Caregiver',
        informationRequested: 'Test',
        status: 'completed',
        responseDate: new Date(),
      });

      await PrivacyRequest.create({
        requestType: 'correction',
        requestorType: 'caregiver',
        requestorId: caregiverId,
        requestorModel: 'Caregiver',
        informationRequested: 'Test',
        status: 'pending',
      });

      const stats = await PrivacyRequest.getStatistics();
      expect(stats.total).toBe(2);
      expect(stats.access).toBe(1);
      expect(stats.correction).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.pending).toBe(1);
    });
  });

  describe('Extension Support', () => {
    it('should support extending deadline', async () => {
      const request = await PrivacyRequest.create({
        requestType: 'access',
        requestorType: 'caregiver',
        requestorId: caregiverId,
        requestorModel: 'Caregiver',
        informationRequested: 'Test',
      });

      request.extensionRequested = true;
      request.extensionReason = 'Need more time to gather data';
      const extendedDeadline = new Date(request.responseDeadline);
      extendedDeadline.setDate(extendedDeadline.getDate() + 30);
      request.extendedDeadline = extendedDeadline;
      await request.save();

      expect(request.extensionRequested).toBe(true);
      expect(request.extendedDeadline).toBeDefined();
    });
  });

  describe('Fees', () => {
    it('should support fee tracking', async () => {
      const request = await PrivacyRequest.create({
        requestType: 'access',
        requestorType: 'caregiver',
        requestorId: caregiverId,
        requestorModel: 'Caregiver',
        informationRequested: 'Test',
        fees: {
          amount: 25.00,
          currency: 'CAD',
          reason: 'Printing and postage costs',
        },
      });

      expect(request.fees.amount).toBe(25.00);
      expect(request.fees.currency).toBe('CAD');
    });
  });

  describe('Appeal Process', () => {
    it('should support appeal tracking', async () => {
      const request = await PrivacyRequest.create({
        requestType: 'access',
        requestorType: 'caregiver',
        requestorId: caregiverId,
        requestorModel: 'Caregiver',
        informationRequested: 'Test',
        status: 'denied',
        denialReason: 'Request denied',
      });

      request.appealRequested = true;
      request.appealDate = new Date();
      request.appealStatus = 'pending';
      await request.save();

      expect(request.appealRequested).toBe(true);
      expect(request.appealStatus).toBe('pending');
    });
  });
});



