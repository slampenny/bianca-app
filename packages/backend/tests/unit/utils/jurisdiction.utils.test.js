const {
  getJurisdiction,
  getPrivacyPolicyType,
  getDataRetentionPeriod,
  shouldAutoDeleteData,
  requiresHIPAA,
  requiresPIPEDA,
  requiresGDPR,
} = require('../../../src/utils/jurisdiction.utils');

describe('jurisdiction.utils', () => {
  describe('getJurisdiction', () => {
    it('defaults null/missing country to GDPR (not HIPAA)', () => {
      const jurisdiction = getJurisdiction(null);

      expect(jurisdiction.jurisdiction).toBe('GDPR');
      expect(jurisdiction.country).toBeNull();
      expect(jurisdiction.regulations).toContain('GDPR');
      expect(requiresHIPAA(null)).toBe(false);
    });

    it('maps HU to GDPR with minimization retention', () => {
      const jurisdiction = getJurisdiction('HU');

      expect(jurisdiction.jurisdiction).toBe('GDPR');
      expect(jurisdiction.country).toBe('HU');
      expect(jurisdiction.dataRetention.conversations).toEqual({ years: 3, autoDelete: true });
      expect(jurisdiction.dataRetention.callRecordings).toEqual({ years: 1, autoDelete: true });
      expect(jurisdiction.dataRetention.medicalAnalysis).toEqual({ years: 3, autoDelete: true });
      expect(jurisdiction.dataRetention.clientMemory).toEqual({ years: 3, autoDelete: true });
      expect(jurisdiction.dataRetention.auditLog).toEqual({ years: 3, autoDelete: true });
    });

    it('maps US to HIPAA with 7-year retention', () => {
      const jurisdiction = getJurisdiction('US');

      expect(jurisdiction.jurisdiction).toBe('HIPAA');
      expect(jurisdiction.dataRetention.conversations).toEqual({ years: 7, autoDelete: false });
      expect(jurisdiction.dataRetention.auditLog).toEqual({ years: 7, autoDelete: false });
    });

    it('maps CA to PIPEDA', () => {
      const jurisdiction = getJurisdiction('CA');

      expect(jurisdiction.jurisdiction).toBe('PIPEDA');
      expect(jurisdiction.breachNotificationRequirement).toBe('as_soon_as_feasible');
      expect(requiresPIPEDA('CA')).toBe(true);
    });

    it('maps DE to GDPR', () => {
      const jurisdiction = getJurisdiction('de');

      expect(jurisdiction.jurisdiction).toBe('GDPR');
      expect(jurisdiction.country).toBe('DE');
      expect(requiresGDPR('DE')).toBe(true);
    });
  });

  describe('getPrivacyPolicyType', () => {
    it('returns GDPR for null country and EU members', () => {
      expect(getPrivacyPolicyType(null)).toBe('GDPR');
      expect(getPrivacyPolicyType('HU')).toBe('GDPR');
      expect(getPrivacyPolicyType('DE')).toBe('GDPR');
    });

    it('returns HIPAA for US and PIPEDA for CA', () => {
      expect(getPrivacyPolicyType('US')).toBe('HIPAA');
      expect(getPrivacyPolicyType('CA')).toBe('PIPEDA');
    });
  });

  describe('shouldAutoDeleteData', () => {
    it('auto-deletes for GDPR and not for HIPAA', () => {
      expect(shouldAutoDeleteData(null)).toBe(true);
      expect(shouldAutoDeleteData('HU')).toBe(true);
      expect(shouldAutoDeleteData('US')).toBe(false);
    });
  });

  describe('getDataRetentionPeriod', () => {
    it('returns GDPR call retention of 1 year', () => {
      expect(getDataRetentionPeriod('HU', 'callRecordings')).toEqual({ years: 1, autoDelete: true });
    });

    it('falls back to HIPAA 7-year retention for US', () => {
      expect(getDataRetentionPeriod('US', 'unknownType')).toEqual({ years: 7, autoDelete: false });
    });
  });
});
