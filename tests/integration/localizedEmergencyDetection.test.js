// Import integration setup FIRST to ensure proper mocking
require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
const { EmergencyPhrase } = require('../../src/models');

// Import integration test app AFTER all mocks are set up
const app = require('../utils/integration-app');
const { setupMongoMemoryServer, teardownMongoMemoryServer } = require('../utils/mongodb-memory-server');
const { localizedEmergencyDetector } = require('../../src/services/localizedEmergencyDetector.service');
const { emergencyPhraseService } = require('../../src/services');
const { emergencyProcessor } = require('../../src/services/emergencyProcessor.service');

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('Localized Emergency Detection', () => {
  beforeEach(async () => {
    // Clear emergency phrases, users, and patients before each test
    const { Org, Caregiver, Patient } = require('../../src/models');
    await EmergencyPhrase.deleteMany();
    await Org.deleteMany();
    await Caregiver.deleteMany();
    await Patient.deleteMany();
  });

  afterEach(async () => {
    // Clean up after each test
    const { Org, Caregiver, Patient } = require('../../src/models');
    await EmergencyPhrase.deleteMany();
    await Org.deleteMany();
    await Caregiver.deleteMany();
    await Patient.deleteMany();
  });

  describe('Emergency Phrase Management API', () => {
    let adminToken;
    const { insertCaregiversAndAddToOrg, superAdmin } = require('../fixtures/caregiver.fixture');
    const { insertOrgs, orgOne } = require('../fixtures/org.fixture');

    beforeEach(async () => {
      // Create a superAdmin user for testing emergency phrase management
      // (requires 'manageAny:emergencyPhrase' permission)
      const [org] = await insertOrgs([orgOne]);
      const caregivers = await insertCaregiversAndAddToOrg(org, [superAdmin]);
      const adminUser = caregivers[0];

      // Login to get token
      const res = await request(app)
        .post('/v1/auth/login')
        .send({
          email: superAdmin.email,
          password: 'Password1'
        });

      if (res.status !== 200) {
        console.log('Login failed:', res.body);
        throw new Error(`Login failed: ${res.status} - ${JSON.stringify(res.body)}`);
      }

      adminToken = res.body.tokens.access.token;
    });

    test('should create emergency phrase', async () => {
      const phraseData = {
        phrase: 'heart attack',
        language: 'en',
        severity: 'CRITICAL',
        category: 'Medical',
        pattern: '\\b(heart\\s+attack|heartattack)\\b',
        description: 'Heart attack emergency phrase'
      };

      const res = await request(app)
        .post('/v1/emergency-phrases')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(phraseData)
        .expect(httpStatus.CREATED);

      expect(res.body).toMatchObject({
        phrase: phraseData.phrase,
        language: phraseData.language,
        severity: phraseData.severity,
        category: phraseData.category,
        pattern: phraseData.pattern,
        isActive: true
      });
    });

    test('should get emergency phrases', async () => {
      // Create test phrases
      await EmergencyPhrase.create([
        {
          phrase: 'heart attack',
          language: 'en',
          severity: 'CRITICAL',
          category: 'Medical',
          pattern: '\\b(heart\\s+attack)\\b',
          createdBy: '000000000000000000000000',
          lastModifiedBy: '000000000000000000000000'
        },
        {
          phrase: 'ataque al corazón',
          language: 'es',
          severity: 'CRITICAL',
          category: 'Medical',
          pattern: '\\b(ataque\\s+al\\s+corazón)\\b',
          createdBy: '000000000000000000000000',
          lastModifiedBy: '000000000000000000000000'
        }
      ]);

      const res = await request(app)
        .get('/v1/emergency-phrases')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(httpStatus.OK);

      expect(res.body.results).toHaveLength(2);
      expect(res.body.totalResults).toBe(2);
    });

    test('should filter phrases by language', async () => {
      // Create test phrases
      await EmergencyPhrase.create([
        {
          phrase: 'heart attack',
          language: 'en',
          severity: 'CRITICAL',
          category: 'Medical',
          pattern: '\\b(heart\\s+attack)\\b',
          createdBy: '000000000000000000000000',
          lastModifiedBy: '000000000000000000000000'
        },
        {
          phrase: 'ataque al corazón',
          language: 'es',
          severity: 'CRITICAL',
          category: 'Medical',
          pattern: '\\b(ataque\\s+al\\s+corazón)\\b',
          createdBy: '000000000000000000000000',
          lastModifiedBy: '000000000000000000000000'
        }
      ]);

      const res = await request(app)
        .get('/v1/emergency-phrases?language=es')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(httpStatus.OK);

      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].language).toBe('es');
    });

    test('should test phrase pattern', async () => {
      const testData = {
        pattern: '\\b(heart\\s+attack)\\b',
        testText: 'I think I am having a heart attack'
      };

      const res = await request(app)
        .post('/v1/emergency-phrases/test-pattern')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testData)
        .expect(httpStatus.OK);

      expect(res.body.isValid).toBe(true);
      expect(res.body.matches).toBe(true);
      expect(res.body.matchDetails).toBeDefined();
    });

    test('should get phrase statistics', async () => {
      // Create test phrases
      await EmergencyPhrase.create([
        {
          phrase: 'heart attack',
          language: 'en',
          severity: 'CRITICAL',
          category: 'Medical',
          pattern: '\\b(heart\\s+attack)\\b',
          createdBy: '000000000000000000000000',
          lastModifiedBy: '000000000000000000000000'
        },
        {
          phrase: 'ataque al corazón',
          language: 'es',
          severity: 'CRITICAL',
          category: 'Medical',
          pattern: '\\b(ataque\\s+al\\s+corazón)\\b',
          createdBy: '000000000000000000000000',
          lastModifiedBy: '000000000000000000000000'
        }
      ]);

      const res = await request(app)
        .get('/v1/emergency-phrases/statistics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(httpStatus.OK);

      expect(res.body.totalPhrases).toBe(2);
      expect(res.body.byLanguage.en).toBe(1);
      expect(res.body.byLanguage.es).toBe(1);
      expect(res.body.bySeverity.CRITICAL).toBe(2);
    });
  });

  describe('Localized Emergency Detection Service', () => {
    beforeEach(async () => {
      // Create test phrases for different languages
      await EmergencyPhrase.create([
        {
          phrase: 'heart attack',
          language: 'en',
          severity: 'CRITICAL',
          category: 'Medical',
          pattern: '\\b(heart\\s+attack|heartattack)\\b',
          createdBy: '000000000000000000000000',
          lastModifiedBy: '000000000000000000000000'
        },
        {
          phrase: 'ataque al corazón',
          language: 'es',
          severity: 'CRITICAL',
          category: 'Medical',
          pattern: '\\b(ataque\\s+al\\s+corazón|infarto)\\b',
          createdBy: '000000000000000000000000',
          lastModifiedBy: '000000000000000000000000'
        },
        {
          phrase: 'crise cardiaque',
          language: 'fr',
          severity: 'CRITICAL',
          category: 'Medical',
          pattern: '\\b(crise\\s+cardiaque|infarctus)\\b',
          createdBy: '000000000000000000000000',
          lastModifiedBy: '000000000000000000000000'
        }
      ]);
    });

    test('should detect emergency in English', async () => {
      const result = await localizedEmergencyDetector.detectEmergency(
        'I think I am having a heart attack',
        'en'
      );

      expect(result.isEmergency).toBe(true);
      expect(result.severity).toBe('CRITICAL');
      expect(result.category).toBe('Medical');
      expect(result.phrase).toBe('heart attack');
      expect(result.language).toBe('en');
    });

    test('should detect emergency in Spanish', async () => {
      const result = await localizedEmergencyDetector.detectEmergency(
        'Creo que estoy teniendo un ataque al corazón',
        'es'
      );

      expect(result.isEmergency).toBe(true);
      expect(result.severity).toBe('CRITICAL');
      expect(result.category).toBe('Medical');
      expect(result.phrase).toBe('ataque al corazón');
      expect(result.language).toBe('es');
    });

    test('should detect emergency in French', async () => {
      const result = await localizedEmergencyDetector.detectEmergency(
        'Je pense que j\'ai une crise cardiaque',
        'fr'
      );

      expect(result.isEmergency).toBe(true);
      expect(result.severity).toBe('CRITICAL');
      expect(result.category).toBe('Medical');
      expect(result.phrase).toBe('crise cardiaque');
      expect(result.language).toBe('fr');
    });

    test('should not detect emergency in wrong language', async () => {
      const result = await localizedEmergencyDetector.detectEmergency(
        'Creo que estoy teniendo un ataque al corazón',
        'en' // Looking for English phrases but text is in Spanish
      );

      expect(result.isEmergency).toBe(false);
      expect(result.language).toBe('en');
    });

    test('should return no emergency for non-emergency text', async () => {
      const result = await localizedEmergencyDetector.detectEmergency(
        'I had a great day today',
        'en'
      );

      expect(result.isEmergency).toBe(false);
      expect(result.severity).toBe(null);
      expect(result.category).toBe(null);
    });

    test('should handle invalid language gracefully', async () => {
      const result = await localizedEmergencyDetector.detectEmergency(
        'I think I am having a heart attack',
        'invalid_language'
      );

      expect(result.isEmergency).toBe(false);
      expect(result.language).toBe('invalid_language');
    });

    test('should get all emergency patterns', async () => {
      const result = await localizedEmergencyDetector.getAllEmergencyPatterns(
        'I think I am having a heart attack and I cannot breathe',
        'en'
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('phrase');
      expect(result[0]).toHaveProperty('severity');
      expect(result[0]).toHaveProperty('category');
    });

    test('should get phrase statistics', async () => {
      const stats = await localizedEmergencyDetector.getPhraseStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.totalPhrases).toBe(3);
      expect(stats.byLanguage.en).toBe(1);
      expect(stats.byLanguage.es).toBe(1);
      expect(stats.byLanguage.fr).toBe(1);
    });
  });

  describe('Integration with Emergency Processor', () => {
    let patientId;

    beforeEach(async () => {
      // Create test phrases
      await EmergencyPhrase.create([
        {
          phrase: 'heart attack',
          language: 'en',
          severity: 'CRITICAL',
          category: 'Medical',
          pattern: '\\b(heart\\s+attack|heartattack)\\b',
          createdBy: '000000000000000000000000',
          lastModifiedBy: '000000000000000000000000'
        },
        {
          phrase: 'ataque al corazón',
          language: 'es',
          severity: 'CRITICAL',
          category: 'Medical',
          pattern: '\\b(ataque\\s+al\\s+corazón|infarto)\\b',
          createdBy: '000000000000000000000000',
          lastModifiedBy: '000000000000000000000000'
        }
      ]);

      // Create a test patient
      const { Patient } = require('../../src/models');
      const patient = new Patient({
        name: 'Test Patient',
        email: 'test@example.com',
        phone: '1234567890',
        preferredLanguage: 'es'
      });
      await patient.save();
      patientId = patient._id;
    });

    test('should process utterance with patient language preference', async () => {
      const result = await emergencyProcessor.processUtterance(
        patientId,
        'Creo que estoy teniendo un ataque al corazón'
      );

      expect(result.shouldAlert).toBe(true);
      expect(result.alertData).toBeDefined();
      expect(result.alertData.severity).toBe('CRITICAL');
      expect(result.alertData.category).toBe('Medical');
      expect(result.alertData.phrase).toBe('ataque al corazón');
    });
  });
});
