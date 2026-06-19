/**
 * Unit Tests for Minimum Necessary Middleware
 * Tests role-based data filtering for HIPAA compliance
 */

const httpMocks = require('node-mocks-http');
const {
  minimumNecessaryMiddleware,
  filterDataForRole,
  canAccessField,
  getFieldAccessRules
} = require('../../../src/middlewares/minimumNecessary');

describe('Minimum Necessary Middleware', () => {
  describe('minimumNecessaryMiddleware', () => {
    it('should not filter data for superAdmin', async () => {
      const req = httpMocks.createRequest({
        caregiver: {
          _id: '123',
          role: 'superAdmin'
        }
      });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      const middleware = minimumNecessaryMiddleware('client');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();

      // Verify json method is not wrapped
      const originalJson = res.json;
      res.json({
        email: 'client@example.com',
        phone: '1234567890',
        medicalRecordNumber: '12345'
      });

      const data = res._getJSONData();
      expect(data).toHaveProperty('email');
      expect(data).toHaveProperty('phone');
      expect(data).toHaveProperty('medicalRecordNumber');
    });

    it('should filter client data for staff role', async () => {
      const req = httpMocks.createRequest({
        caregiver: {
          _id: '123',
          role: 'staff'
        }
      });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      const middleware = minimumNecessaryMiddleware('client');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();

      // Call the wrapped json method
      res.json({
        _id: 'client-123',
        name: 'John Doe',
        preferredName: 'John',
        email: 'client@example.com',
        phone: '1234567890',
        avatar: 'avatar.jpg',
        language: 'en',
        lastContact: new Date(),
        medicalRecordNumber: '12345', // Should be filtered out
        dateOfBirth: '1990-01-01' // Should be filtered out
      });

      const data = res._getJSONData();
      expect(data).toHaveProperty('_id');
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('preferredName');
      expect(data).not.toHaveProperty('email'); // Filtered for staff
      expect(data).not.toHaveProperty('phone'); // Filtered for staff
      expect(data).not.toHaveProperty('medicalRecordNumber');
    });

    it('should filter client data for orgAdmin role', async () => {
      const req = httpMocks.createRequest({
        caregiver: {
          _id: '123',
          role: 'orgAdmin'
        }
      });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      const middleware = minimumNecessaryMiddleware('client');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();

      res.json({
        _id: 'client-123',
        name: 'John Doe',
        email: 'client@example.com',
        phone: '1234567890',
        medicalRecordNumber: '12345', // Should be filtered out for orgAdmin
        address: '123 Main St'
      });

      const data = res._getJSONData();
      expect(data).toHaveProperty('_id');
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('email'); // OrgAdmin can see email
      expect(data).toHaveProperty('phone'); // OrgAdmin can see phone
      expect(data).toHaveProperty('address'); // OrgAdmin can see address
      expect(data).not.toHaveProperty('medicalRecordNumber'); // Filtered
    });

    it('should retain emergencyContacts and familyDigestRecipients for orgAdmin', async () => {
      const req = httpMocks.createRequest({
        caregiver: { _id: '123', role: 'orgAdmin' },
      });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      minimumNecessaryMiddleware('client')(req, res, next);

      res.json({
        id: 'client-123',
        name: 'John Doe',
        emergencyContacts: [{ id: 'ec1', name: 'Bob', phone: '+16045550101' }],
        familyDigestRecipients: [
          { id: 'fd1', name: 'Sarah', email: 'family@test.com', familyDigestEmail: { enabled: true } },
        ],
        medicalRecordNumber: 'secret',
      });

      const data = res._getJSONData();
      expect(data.emergencyContacts).toHaveLength(1);
      expect(data.familyDigestRecipients).toHaveLength(1);
      expect(data).not.toHaveProperty('medicalRecordNumber');
    });

    it('should filter array of clients', async () => {
      const req = httpMocks.createRequest({
        caregiver: {
          _id: '123',
          role: 'staff'
        }
      });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      const middleware = minimumNecessaryMiddleware('client');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();

      res.json([
        {
          _id: 'client-1',
          name: 'Client One',
          email: 'client1@example.com',
          phone: '1111111111'
        },
        {
          _id: 'client-2',
          name: 'Client Two',
          email: 'client2@example.com',
          phone: '2222222222'
        }
      ]);

      const data = res._getJSONData();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
      expect(data[0]).toHaveProperty('_id');
      expect(data[0]).toHaveProperty('name');
      expect(data[0]).not.toHaveProperty('email');
      expect(data[0]).not.toHaveProperty('phone');
    });

    it('should filter paginated response', async () => {
      const req = httpMocks.createRequest({
        caregiver: {
          _id: '123',
          role: 'staff'
        }
      });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      const middleware = minimumNecessaryMiddleware('client');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();

      res.json({
        results: [
          {
            _id: 'client-1',
            name: 'Client One',
            email: 'client1@example.com'
          }
        ],
        page: 1,
        limit: 10,
        totalPages: 1,
        totalResults: 1
      });

      const data = res._getJSONData();
      expect(data).toHaveProperty('results');
      expect(data.results[0]).toHaveProperty('_id');
      expect(data.results[0]).toHaveProperty('name');
      expect(data.results[0]).not.toHaveProperty('email');
    });

    it('should skip filtering if no caregiver', async () => {
      const req = httpMocks.createRequest();
      const res = httpMocks.createResponse();
      const next = jest.fn();

      const middleware = minimumNecessaryMiddleware('client');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle conversation data for staff', async () => {
      const req = httpMocks.createRequest({
        caregiver: {
          _id: '123',
          role: 'staff'
        }
      });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      const middleware = minimumNecessaryMiddleware('conversation');
      await middleware(req, res, next);

      res.json({
        _id: 'conv-123',
        client: 'client-123',
        status: 'completed',
        duration: 300,
        transcript: 'Full conversation transcript',
        summary: 'Conversation summary',
        recordings: ['recording1.mp3']
      });

      const data = res._getJSONData();
      expect(data).toHaveProperty('_id');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('summary');
      expect(data).not.toHaveProperty('transcript'); // Filtered for staff
      expect(data).not.toHaveProperty('recordings'); // Filtered for staff
    });

    it('should give orgAdmin access to conversation transcripts', async () => {
      const req = httpMocks.createRequest({
        caregiver: {
          _id: '123',
          role: 'orgAdmin'
        }
      });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      const middleware = minimumNecessaryMiddleware('conversation');
      await middleware(req, res, next);

      res.json({
        _id: 'conv-123',
        client: 'client-123',
        transcript: 'Full conversation transcript',
        summary: 'Conversation summary',
        cost: 1.50
      });

      const data = res._getJSONData();
      expect(data).toHaveProperty('transcript'); // OrgAdmin can see
      expect(data).toHaveProperty('cost'); // OrgAdmin can see
    });
  });

  describe('filterDataForRole', () => {
    it('should filter data for staff role', () => {
      const clientDoc = {
        _id: 'client-123',
        name: 'John Doe',
        email: 'client@example.com',
        phone: '1234567890',
        dateOfBirth: '1990-01-01'
      };

      const filtered = filterDataForRole(clientDoc, 'client', 'staff');

      expect(filtered).toHaveProperty('_id');
      expect(filtered).toHaveProperty('name');
      expect(filtered).not.toHaveProperty('email');
      expect(filtered).not.toHaveProperty('phone');
      expect(filtered).not.toHaveProperty('dateOfBirth');
    });

    it('should not filter data for superAdmin', () => {
      const clientDoc = {
        _id: 'client-123',
        name: 'John Doe',
        email: 'client@example.com',
        phone: '1234567890',
        dateOfBirth: '1990-01-01',
        medicalRecordNumber: '12345'
      };

      const filtered = filterDataForRole(clientDoc, 'client', 'superAdmin');

      expect(filtered).toEqual(clientDoc);
    });

    it('should filter array of data', () => {
      const clients = [
        {
          _id: 'client-1',
          name: 'Client One',
          email: 'p1@example.com'
        },
        {
          _id: 'client-2',
          name: 'Client Two',
          email: 'p2@example.com'
        }
      ];

      const filtered = filterDataForRole(clients, 'client', 'staff');

      expect(Array.isArray(filtered)).toBe(true);
      expect(filtered).toHaveLength(2);
      expect(filtered[0]).toHaveProperty('_id');
      expect(filtered[0]).not.toHaveProperty('email');
    });

    it('should handle null or undefined data', () => {
      expect(filterDataForRole(null, 'client', 'staff')).toBeNull();
      expect(filterDataForRole(undefined, 'client', 'staff')).toBeUndefined();
    });
  });

  describe('canAccessField', () => {
    it('should return true if field is allowed for role', () => {
      expect(canAccessField('staff', 'client', '_id')).toBe(true);
      expect(canAccessField('staff', 'client', 'name')).toBe(true);
      expect(canAccessField('staff', 'client', 'preferredName')).toBe(true);
    });

    it('should return false if field is not allowed for role', () => {
      expect(canAccessField('staff', 'client', 'email')).toBe(false);
      expect(canAccessField('staff', 'client', 'phone')).toBe(false);
      expect(canAccessField('staff', 'client', 'dateOfBirth')).toBe(false);
    });

    it('should return true for all fields for superAdmin', () => {
      expect(canAccessField('superAdmin', 'client', 'email')).toBe(true);
      expect(canAccessField('superAdmin', 'client', 'phone')).toBe(true);
      expect(canAccessField('superAdmin', 'client', 'medicalRecordNumber')).toBe(true);
    });

    it('should allow orgAdmin to access more fields than staff', () => {
      // OrgAdmin can access email
      expect(canAccessField('orgAdmin', 'client', 'email')).toBe(true);
      
      // Staff cannot access email
      expect(canAccessField('staff', 'client', 'email')).toBe(false);
    });

    it('should handle alert resource type', () => {
      expect(canAccessField('staff', 'alert', '_id')).toBe(true);
      expect(canAccessField('staff', 'alert', 'type')).toBe(true);
      expect(canAccessField('staff', 'alert', 'message')).toBe(true);
    });
  });

  describe('getFieldAccessRules', () => {
    it('should return field access rules', () => {
      const rules = getFieldAccessRules();

      expect(rules).toHaveProperty('staff');
      expect(rules).toHaveProperty('orgAdmin');
      expect(rules).toHaveProperty('superAdmin');

      expect(rules.staff).toHaveProperty('client');
      expect(rules.staff).toHaveProperty('conversation');
      expect(rules.staff).toHaveProperty('medicalAnalysis');

      expect(Array.isArray(rules.staff.client)).toBe(true);
    });

    it('should have different access levels for each role', () => {
      const rules = getFieldAccessRules();

      const staffPatientFields = rules.staff.client.length;
      const orgAdminPatientFields = rules.orgAdmin.client.length;
      const superAdminPatientAccess = rules.superAdmin.client;

      expect(orgAdminPatientFields).toBeGreaterThan(staffPatientFields);
      expect(superAdminPatientAccess).toBe('*');
    });
  });

  describe('Medical Analysis Filtering', () => {
    it('should filter medical analysis for staff', async () => {
      const req = httpMocks.createRequest({
        caregiver: {
          _id: '123',
          role: 'staff'
        }
      });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      const middleware = minimumNecessaryMiddleware('medicalAnalysis');
      await middleware(req, res, next);

      res.json({
        _id: 'analysis-123',
        client: 'client-123',
        summary: 'High-level summary',
        recommendations: ['Take medication'],
        detailedMetrics: {
          cognitive: 85,
          mood: 'stable'
        },
        psychiatricDetails: 'Detailed notes'
      });

      const data = res._getJSONData();
      expect(data).toHaveProperty('_id');
      expect(data).toHaveProperty('summary');
      expect(data).toHaveProperty('recommendations');
      expect(data).not.toHaveProperty('detailedMetrics');
      expect(data).not.toHaveProperty('psychiatricDetails');
    });

    it('should give orgAdmin access to cognitive metrics', async () => {
      const req = httpMocks.createRequest({
        caregiver: {
          _id: '123',
          role: 'orgAdmin'
        }
      });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      const middleware = minimumNecessaryMiddleware('medicalAnalysis');
      await middleware(req, res, next);

      res.json({
        _id: 'analysis-123',
        client: 'client-123',
        summary: 'High-level summary',
        cognitiveMetrics: { score: 85 },
        riskLevel: 'low'
      });

      const data = res._getJSONData();
      expect(data).toHaveProperty('cognitiveMetrics');
      expect(data).toHaveProperty('riskLevel');
    });
  });
});

