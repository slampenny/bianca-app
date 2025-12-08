// tests/unit/emergencyDetector.test.js

const { detectEmergency, getAllEmergencyPatterns, filterFalsePositives } = require('../../src/utils/emergencyDetector');

describe('Emergency Detector', () => {
  describe('detectEmergency', () => {
    test('should detect heart attack emergency with CRITICAL severity', () => {
      const result = detectEmergency("I think I'm having a heart attack");
      expect(result.isEmergency).toBe(true);
      expect(result.matchedPhrase).toBe('heart attack');
      expect(result.severity).toBe('CRITICAL');
      expect(result.category).toBe('Medical');
    });

    test('should detect breathing emergency with CRITICAL severity', () => {
      const result = detectEmergency("I can't breathe");
      expect(result.isEmergency).toBe(true);
      expect(result.matchedPhrase).toBe("can't breathe");
      expect(result.severity).toBe('CRITICAL');
      expect(result.category).toBe('Medical');
    });

    test('should not detect emergency in normal text', () => {
      const result = detectEmergency("Everything is fine today");
      expect(result.isEmergency).toBe(false);
      expect(result.matchedPhrase).toBe(null);
      expect(result.severity).toBe(null);
      expect(result.category).toBe(null);
    });

    test('should handle case-insensitive matching', () => {
      const result = detectEmergency("I'M HAVING A HEART ATTACK!");
      expect(result.isEmergency).toBe(true);
      expect(result.matchedPhrase).toBe('heart attack');
    });

    test('should handle variations of breathing problems', () => {
      const testCases = [
        "I can't breathe",
        "I cannot breathe", 
        "I can't breath",
        "I have difficulty breathing",
        "I'm having trouble breathing",
        "I have shortness of breath"
      ];

      testCases.forEach(text => {
        const result = detectEmergency(text);
        expect(result.isEmergency).toBe(true);
      });
    });

    test('should detect chest pain variations', () => {
      const testCases = [
        "I have chest pain",
        "My chest aches",
        "There's pressure in my chest",
        "Chest pressure is severe"
      ];

      testCases.forEach(text => {
        const result = detectEmergency(text);
        expect(result.isEmergency).toBe(true);
      });
    });

    test('should detect emergency service calls', () => {
      const testCases = [
        "Call 911",
        "Call emergency services",
        "I need an ambulance",
        "Get me to the ER"
      ];

      testCases.forEach(text => {
        const result = detectEmergency(text);
        expect(result.isEmergency).toBe(true);
      });
    });

    test('should detect HIGH severity emergencies', () => {
      const testCases = [
        { text: "I fell down", expected: { severity: 'HIGH', category: 'Physical', phrase: 'fell down' } },
        { text: "I have severe pain", expected: { severity: 'HIGH', category: 'Medical', phrase: 'severe pain' } },
        { text: "I can't get up", expected: { severity: 'HIGH', category: 'Physical', phrase: "can't get up" } },
        { text: "There's an intruder", expected: { severity: 'HIGH', category: 'Safety', phrase: 'intruder' } }
      ];

      testCases.forEach(({ text, expected }) => {
        const result = detectEmergency(text);
        expect(result.isEmergency).toBe(true);
        expect(result.severity).toBe(expected.severity);
        expect(result.category).toBe(expected.category);
        expect(result.matchedPhrase).toBe(expected.phrase);
      });
    });

    test('should detect MEDIUM severity emergencies', () => {
      const testCases = [
        { text: "I feel sick", expected: { severity: 'MEDIUM', category: 'Medical', phrase: 'feel sick' } },
        { text: "I'm dizzy", expected: { severity: 'MEDIUM', category: 'Medical', phrase: 'dizzy' } },
        { text: "I need help", expected: { severity: 'MEDIUM', category: 'Request', phrase: 'need help' } },
        { text: "Call ambulance", expected: { severity: 'MEDIUM', category: 'Request', phrase: 'call ambulance' } }
      ];

      testCases.forEach(({ text, expected }) => {
        const result = detectEmergency(text);
        expect(result.isEmergency).toBe(true);
        expect(result.severity).toBe(expected.severity);
        expect(result.category).toBe(expected.category);
        expect(result.matchedPhrase).toBe(expected.phrase);
      });
    });

    test('should prioritize higher severity when multiple patterns match', () => {
      const result = detectEmergency("I'm having a heart attack and feel dizzy");
      expect(result.isEmergency).toBe(true);
      expect(result.severity).toBe('CRITICAL'); // heart attack is CRITICAL, dizzy is MEDIUM
      expect(result.matchedPhrase).toBe('heart attack');
      expect(result.category).toBe('Medical');
    });

    test('should handle edge cases', () => {
      expect(detectEmergency("")).toEqual({ 
        isEmergency: false, 
        severity: null, 
        matchedPhrase: null, 
        category: null 
      });
      expect(detectEmergency(null)).toEqual({ 
        isEmergency: false, 
        severity: null, 
        matchedPhrase: null, 
        category: null 
      });
      expect(detectEmergency(undefined)).toEqual({ 
        isEmergency: false, 
        severity: null, 
        matchedPhrase: null, 
        category: null 
      });
      expect(detectEmergency(123)).toEqual({ 
        isEmergency: false, 
        severity: null, 
        matchedPhrase: null, 
        category: null 
      });
    });

    test('should handle whitespace', () => {
      const result = detectEmergency("   I'm having a heart attack   ");
      expect(result.isEmergency).toBe(true);
      expect(result.matchedPhrase).toBe('heart attack');
      expect(result.severity).toBe('CRITICAL');
      expect(result.category).toBe('Medical');
    });
  });

  describe('getAllEmergencyPatterns', () => {
    test('should return all matched patterns with severity and category', () => {
      const result = getAllEmergencyPatterns("I'm having a heart attack and can't breathe");
      expect(result.length).toBeGreaterThanOrEqual(2);
      
      const heartAttack = result.find(p => p.phrase === 'heart attack');
      const cantBreathe = result.find(p => p.phrase === "can't breathe");
      
      expect(heartAttack).toBeDefined();
      expect(heartAttack.severity).toBe('CRITICAL');
      expect(heartAttack.category).toBe('Medical');
      
      expect(cantBreathe).toBeDefined();
      expect(cantBreathe.severity).toBe('CRITICAL');
      expect(cantBreathe.category).toBe('Medical');
    });

    test('should return empty array for non-emergency text', () => {
      const result = getAllEmergencyPatterns("Everything is fine today");
      expect(result).toEqual([]);
    });
  });

  describe('filterFalsePositives', () => {
    test('should identify hypothetical situations as false positives', () => {
      const emergencyMatch = detectEmergency("If I had a heart attack, I would call 911");
      const filter = filterFalsePositives("If I had a heart attack, I would call 911", emergencyMatch);
      
      expect(filter.isFalsePositive).toBe(true);
      expect(filter.reason).toBe('hypothetical situation');
    });

    test('should identify past events as false positives', () => {
      const emergencyMatch = detectEmergency("My dad had a stroke last year");
      const filter = filterFalsePositives("My dad had a stroke last year", emergencyMatch);
      
      expect(filter.isFalsePositive).toBe(true);
      expect(filter.reason).toBe('past event'); // "last year" triggers past event pattern first
    });

    test('should not filter real emergencies', () => {
      const emergencyMatch = detectEmergency("I'm having chest pain right now");
      const filter = filterFalsePositives("I'm having chest pain right now", emergencyMatch);
      
      expect(filter.isFalsePositive).toBe(false);
      expect(filter.reason).toBe(null);
    });

    test('should identify third-party references as false positives', () => {
      const testCases = [
        "My friend is having a heart attack",
        "Someone on TV had a stroke",
        "My neighbor fell down yesterday"
      ];

      testCases.forEach(text => {
        const emergencyMatch = detectEmergency(text);
        const filter = filterFalsePositives(text, emergencyMatch);
        expect(filter.isFalsePositive).toBe(true);
      });
    });

    test('should identify educational contexts as false positives', () => {
      const testCases = [
        "What are the symptoms of a heart attack?",
        "I'm learning about stroke signs",
        "This is an example of chest pain"
      ];

      testCases.forEach(text => {
        const emergencyMatch = detectEmergency(text);
        const filter = filterFalsePositives(text, emergencyMatch);
        expect(filter.isFalsePositive).toBe(true);
      });
    });

    test('should handle no emergency detected', () => {
      const emergencyMatch = { isEmergency: false };
      const filter = filterFalsePositives("Everything is fine", emergencyMatch);
      
      expect(filter.isFalsePositive).toBe(false);
      expect(filter.reason).toBe(null);
    });

    test('should handle invalid inputs', () => {
      expect(filterFalsePositives(null, null)).toEqual({ isFalsePositive: false, reason: null });
      expect(filterFalsePositives("", { isEmergency: false })).toEqual({ isFalsePositive: false, reason: null });
    });
  });
});
