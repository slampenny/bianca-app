const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const httpMocks = require('node-mocks-http');
const httpStatus = require('http-status');
const privacyController = require('../../../src/controllers/privacy.controller');
const privacyService = require('../../../src/services/privacy.service');
const { PrivacyRequest, ConsentRecord, Caregiver } = require('../../../src/models');
const ApiError = require('../../../src/utils/ApiError');

// Mock privacy service
jest.mock('../../../src/services/privacy.service');

describe('Privacy Controller', () => {
  let mongoServer;
  let req;
  let res;
  let next;
  let caregiverId;

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

  beforeEach(() => {
    jest.clearAllMocks();
    
    req = httpMocks.createRequest();
    res = httpMocks.createResponse();
    next = jest.fn();

    caregiverId = new mongoose.Types.ObjectId();
    req.user = { id: caregiverId };
  });

  describe('createAccessRequest', () => {
    it('should create an access request', async () => {
      const requestBody = {
        informationRequested: 'All my data',
        accessMethod: 'email',
      };
      req.body = requestBody;

      const mockRequest = {
        _id: new mongoose.Types.ObjectId(),
        requestType: 'access',
        requestorId: caregiverId,
        status: 'pending',
      };

      privacyService.createAccessRequest.mockResolvedValue(mockRequest);
      privacyService.processAccessRequest.mockResolvedValue({
        ...mockRequest,
        status: 'completed',
      });

      await privacyController.createAccessRequest(req, res, next);

      expect(res.statusCode).toBe(httpStatus.CREATED);
      expect(privacyService.createAccessRequest).toHaveBeenCalledWith(
        requestBody,
        caregiverId,
        'Caregiver'
      );
    });
  });

  describe('createCorrectionRequest', () => {
    it('should create a correction request', async () => {
      const requestBody = {
        informationRequested: 'Correction to email',
        correctionDetails: {
          field: 'email',
          currentValue: 'old@example.com',
          requestedValue: 'new@example.com',
          reason: 'Email changed',
        },
      };
      req.body = requestBody;

      const mockRequest = {
        _id: new mongoose.Types.ObjectId(),
        requestType: 'correction',
        requestorId: caregiverId,
        status: 'pending',
      };

      privacyService.createCorrectionRequest.mockResolvedValue(mockRequest);

      await privacyController.createCorrectionRequest(req, res, next);

      expect(res.statusCode).toBe(httpStatus.CREATED);
      expect(privacyService.createCorrectionRequest).toHaveBeenCalledWith(
        requestBody,
        caregiverId,
        'Caregiver'
      );
    });
  });

  describe('getPrivacyRequest', () => {
    it('should return a privacy request', async () => {
      const requestId = new mongoose.Types.ObjectId();
      req.params = { requestId: requestId.toString() };

      const mockRequest = {
        _id: requestId,
        requestType: 'access',
        requestorId: caregiverId,
        status: 'completed',
      };

      privacyService.getPrivacyRequestById.mockResolvedValue(mockRequest);

      await privacyController.getPrivacyRequest(req, res, next);

      expect(res.statusCode).toBe(httpStatus.OK);
      expect(privacyService.getPrivacyRequestById).toHaveBeenCalledWith(
        requestId.toString(),
        caregiverId
      );
    });
  });

  describe('getPrivacyRequests', () => {
    it('should return paginated privacy requests', async () => {
      req.query = { page: 1, limit: 10 };
      req.queryOptions = { page: 1, limit: 10 };

      const mockResult = {
        results: [],
        page: 1,
        limit: 10,
        totalPages: 0,
        totalResults: 0,
      };

      privacyService.queryPrivacyRequests.mockResolvedValue(mockResult);

      await privacyController.getPrivacyRequests(req, res, next);

      expect(res.statusCode).toBe(httpStatus.OK);
      expect(privacyService.queryPrivacyRequests).toHaveBeenCalled();
    });
  });

  describe('createConsent', () => {
    it('should create a consent record', async () => {
      req.body = {
        consentType: 'collection',
        purpose: 'Account creation',
        method: 'explicit',
      };

      const mockConsent = {
        _id: new mongoose.Types.ObjectId(),
        consentType: 'collection',
        granted: true,
      };

      privacyService.createConsentRecord.mockResolvedValue(mockConsent);

      await privacyController.createConsent(req, res, next);

      expect(res.statusCode).toBe(httpStatus.CREATED);
      expect(privacyService.createConsentRecord).toHaveBeenCalled();
    });
  });

  describe('getActiveConsent', () => {
    it('should return active consent records', async () => {
      req.query = { consentType: 'collection' };

      const mockConsents = [
        {
          _id: new mongoose.Types.ObjectId(),
          consentType: 'collection',
          granted: true,
        },
      ];

      privacyService.getActiveConsent.mockResolvedValue(mockConsents);

      await privacyController.getActiveConsent(req, res, next);

      expect(res.statusCode).toBe(httpStatus.OK);
      expect(privacyService.getActiveConsent).toHaveBeenCalledWith(
        caregiverId,
        'Caregiver',
        'collection'
      );
    });
  });

  describe('checkConsent', () => {
    it('should return true if consent exists', async () => {
      req.query = {
        consentType: 'recording',
        purpose: 'wellness_calls',
      };

      privacyService.hasConsent.mockResolvedValue(true);

      await privacyController.checkConsent(req, res, next);

      expect(res.statusCode).toBe(httpStatus.OK);
      const data = res._getData();
      const result = typeof data === 'string' ? JSON.parse(data) : data;
      expect(result).toEqual({ hasConsent: true });
    });

    it('should return false if consent does not exist', async () => {
      req.query = {
        consentType: 'recording',
        purpose: 'wellness_calls',
      };

      privacyService.hasConsent.mockResolvedValue(false);

      await privacyController.checkConsent(req, res, next);

      expect(res.statusCode).toBe(httpStatus.OK);
      const data = res._getData();
      const result = typeof data === 'string' ? JSON.parse(data) : data;
      expect(result).toEqual({ hasConsent: false });
    });
  });

  describe('withdrawConsent', () => {
    it('should withdraw consent', async () => {
      const consentId = new mongoose.Types.ObjectId();
      req.params = { consentId: consentId.toString() };
      req.body = {
        withdrawalMethod: 'app',
        withdrawalReason: 'No longer want service',
      };

      const mockConsent = {
        _id: consentId,
        withdrawn: true,
        granted: false,
      };

      privacyService.withdrawConsent.mockResolvedValue(mockConsent);

      await privacyController.withdrawConsent(req, res, next);

      expect(res.statusCode).toBe(httpStatus.OK);
      expect(privacyService.withdrawConsent).toHaveBeenCalledWith(
        consentId.toString(),
        req.body,
        caregiverId
      );
    });
  });

  describe('getConsentHistory', () => {
    it('should return consent history', async () => {
      const mockHistory = [
        {
          _id: new mongoose.Types.ObjectId(),
          consentType: 'collection',
          granted: true,
          createdAt: new Date(),
        },
      ];

      privacyService.getConsentHistory.mockResolvedValue(mockHistory);

      await privacyController.getConsentHistory(req, res, next);

      expect(res.statusCode).toBe(httpStatus.OK);
      expect(privacyService.getConsentHistory).toHaveBeenCalledWith(
        caregiverId,
        'Caregiver'
      );
    });
  });

  describe('getApproachingDeadline', () => {
    it('should return requests approaching deadline', async () => {
      req.user.role = 'superAdmin'; // Admin only endpoint

      const mockRequests = [
        {
          _id: new mongoose.Types.ObjectId(),
          requestType: 'access',
          responseDeadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        },
      ];

      privacyService.getApproachingDeadline.mockResolvedValue(mockRequests);

      await privacyController.getApproachingDeadline(req, res, next);

      expect(res.statusCode).toBe(httpStatus.OK);
      expect(privacyService.getApproachingDeadline).toHaveBeenCalled();
    });
  });

  describe('getOverdueRequests', () => {
    it('should return overdue requests', async () => {
      req.user.role = 'superAdmin'; // Admin only endpoint

      const mockRequests = [
        {
          _id: new mongoose.Types.ObjectId(),
          requestType: 'access',
          responseDeadline: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      ];

      privacyService.getOverdueRequests.mockResolvedValue(mockRequests);

      await privacyController.getOverdueRequests(req, res, next);

      expect(res.statusCode).toBe(httpStatus.OK);
      expect(privacyService.getOverdueRequests).toHaveBeenCalled();
    });
  });

  describe('getPrivacyStatistics', () => {
    it('should return privacy statistics', async () => {
      req.user.role = 'superAdmin'; // Admin only endpoint
      req.query = { startDate: '2025-01-01', endDate: '2025-12-31' };

      const mockStats = {
        requests: {
          total: 10,
          completed: 8,
          pending: 2,
        },
        consent: {
          total: 100,
          granted: 95,
          withdrawn: 5,
        },
      };

      privacyService.getPrivacyStatistics.mockResolvedValue(mockStats);

      await privacyController.getPrivacyStatistics(req, res, next);

      expect(res.statusCode).toBe(httpStatus.OK);
      expect(privacyService.getPrivacyStatistics).toHaveBeenCalledWith(
        '2025-01-01',
        '2025-12-31'
      );
    });
  });
});

