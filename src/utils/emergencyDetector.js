// src/utils/emergencyDetector.js

/**
 * Emergency Pattern Detector with Severity Levels and Categories
 * Identifies critical medical emergencies in text using regex patterns
 * Categorizes by severity: CRITICAL (0-1 min), HIGH (1-5 min), MEDIUM (5-15 min)
 */

// Define emergency patterns with severity levels and categories
const EMERGENCY_PATTERNS = [
  // CRITICAL SEVERITY (0-1 minute response needed)
  
  // Medical Emergencies - CRITICAL
  // Match "heart attack" anywhere in text, including "having a heart attack", "I'm having a heart attack", etc.
  { pattern: /\b(heart\s+attack|heartattack)\b/i, phrase: 'heart attack', severity: 'CRITICAL', category: 'Medical' },
  { pattern: /\b(myocardial\s+infarction|mi)\b/i, phrase: 'myocardial infarction', severity: 'CRITICAL', category: 'Medical' },
  { pattern: /\b(can'?t\s+breathe|cannot\s+breathe|can't\s+breath|cannot\s+breath)\b/i, phrase: "can't breathe", severity: 'CRITICAL', category: 'Medical' },
  { pattern: /\b(choking|choke)\b/i, phrase: 'choking', severity: 'CRITICAL', category: 'Medical' },
  { pattern: /\b(stroke|stroke\s+symptoms)\b/i, phrase: 'stroke', severity: 'CRITICAL', category: 'Medical' },
  { pattern: /\b(facial\s+droop|drooping\s+face)\b/i, phrase: 'facial droop', severity: 'CRITICAL', category: 'Medical' },
  { pattern: /\b(seizure|seizing|having\s+a\s+seizure)\b/i, phrase: 'seizure', severity: 'CRITICAL', category: 'Medical' },
  { pattern: /\b(anaphylaxis|anaphylactic\s+shock)\b/i, phrase: 'anaphylaxis', severity: 'CRITICAL', category: 'Medical' },
  { pattern: /\b(overdose|overdosed|drug\s+overdose)\b/i, phrase: 'overdose', severity: 'CRITICAL', category: 'Medical' },
  { pattern: /\b(poisoned|poisoning|ingested\s+poison)\b/i, phrase: 'poisoning', severity: 'CRITICAL', category: 'Medical' },
  { pattern: /\b(passed\s+out|fainted|unconscious|lost\s+consciousness)\b/i, phrase: 'loss of consciousness', severity: 'CRITICAL', category: 'Medical' },
  { pattern: /\b(severe\s+bleeding|heavy\s+bleeding|bleeding\s+heavily)\b/i, phrase: 'severe bleeding', severity: 'CRITICAL', category: 'Medical' },
  { pattern: /\b(hemorrhage|hemorrhaging)\b/i, phrase: 'hemorrhage', severity: 'CRITICAL', category: 'Medical' },
  
  // Safety Concerns - CRITICAL
  { pattern: /\b(suicide|killing\s+myself|kill\s+myself|want\s+to\s+die|end\s+my\s+life)\b/i, phrase: 'suicide', severity: 'CRITICAL', category: 'Safety' },
  { pattern: /\b(self\s+harm|cutting\s+myself|hurting\s+myself)\b/i, phrase: 'self harm', severity: 'CRITICAL', category: 'Safety' },
  
  // HIGH SEVERITY (1-5 minute response needed)
  
  // Physical Incidents - HIGH
  { pattern: /\b(i\s+fell|fell\s+down|i\s+tripped|i\s+slipped)\b/i, phrase: 'fell down', severity: 'HIGH', category: 'Physical' },
  { pattern: /\b(can'?t\s+get\s+up|unable\s+to\s+get\s+up|cannot\s+get\s+up)\b/i, phrase: "can't get up", severity: 'HIGH', category: 'Physical' },
  { pattern: /\b(hit\s+my\s+head|bumped\s+my\s+head|head\s+injury)\b/i, phrase: 'hit my head', severity: 'HIGH', category: 'Physical' },
  { pattern: /\b(broken\s+bone|fracture|broken\s+arm|broken\s+leg)\b/i, phrase: 'broken bone', severity: 'HIGH', category: 'Physical' },
  { pattern: /\b(severe\s+pain|excruciating\s+pain|unbearable\s+pain)\b/i, phrase: 'severe pain', severity: 'HIGH', category: 'Medical' },
  { pattern: /\b(emergency\s+pain|urgent\s+pain)\b/i, phrase: 'emergency pain', severity: 'HIGH', category: 'Medical' },
  { pattern: /\b(chest\s+pain|chest\s+ache|chest\s+aches|chest\s+pressure)\b/i, phrase: 'chest pain', severity: 'HIGH', category: 'Medical' },
  { pattern: /\b(pressure\s+in\s+chest|tightness\s+in\s+chest|pressure\s+in\s+my\s+chest)\b/i, phrase: 'chest pressure', severity: 'HIGH', category: 'Medical' },
  
  // Safety Concerns - HIGH
  { pattern: /\b(intruder|someone\s+breaking\s+in|burglar|break\s+in)\b/i, phrase: 'intruder', severity: 'HIGH', category: 'Safety' },
  { pattern: /\b(someone\s+in\s+my\s+house|stranger\s+in\s+house)\b/i, phrase: 'intruder in house', severity: 'HIGH', category: 'Safety' },
  
  // MEDIUM SEVERITY (5-15 minute response needed)
  
  // General Medical - MEDIUM
  { pattern: /\b(feel\s+sick|feeling\s+sick|not\s+feeling\s+well)\b/i, phrase: 'feel sick', severity: 'MEDIUM', category: 'Medical' },
  { pattern: /\b(dizzy|lightheaded|vertigo)\b/i, phrase: 'dizzy', severity: 'MEDIUM', category: 'Medical' },
  { pattern: /\b(nauseous|nausea|throwing\s+up|vomiting)\b/i, phrase: 'nausea', severity: 'MEDIUM', category: 'Medical' },
  { pattern: /\b(difficulty\s+breathing|trouble\s+breathing|shortness\s+of\s+breath)\b/i, phrase: 'breathing difficulty', severity: 'MEDIUM', category: 'Medical' },
  { pattern: /\b(severe\s+allergic\s+reaction)\b/i, phrase: 'severe allergic reaction', severity: 'MEDIUM', category: 'Medical' },
  
  // Explicit Requests - MEDIUM
  { pattern: /\b(need\s+help|i\s+need\s+help|help\s+me)\b/i, phrase: 'need help', severity: 'MEDIUM', category: 'Request' },
  { pattern: /\b(call\s+ambulance|get\s+help\s+now|this\s+is\s+urgent)\b/i, phrase: 'call ambulance', severity: 'MEDIUM', category: 'Request' },
  { pattern: /\b(call\s+911|call\s+emergency|emergency\s+services)\b/i, phrase: 'call 911', severity: 'MEDIUM', category: 'Request' },
  { pattern: /\b(ambulance|paramedics|emergency\s+room|er)\b/i, phrase: 'emergency services', severity: 'MEDIUM', category: 'Request' },
  
  // General emergency indicators
  { pattern: /\b(medical\s+emergency|health\s+emergency)\b/i, phrase: 'medical emergency', severity: 'HIGH', category: 'Medical' },
  { pattern: /\b(life\s+threatening|life\s+or\s+death)\b/i, phrase: 'life threatening', severity: 'CRITICAL', category: 'Medical' },
];

/**
 * Detects emergency patterns in the given text with severity levels and categories
 * @param {string} text - The text to analyze for emergency patterns
 * @returns {Object} - Object containing isEmergency, severity, matchedPhrase, and category
 */
function detectEmergency(text) {
  // Handle edge cases
  if (!text || typeof text !== 'string') {
    return { 
      isEmergency: false, 
      severity: null, 
      matchedPhrase: null, 
      category: null 
    };
  }

  // Clean and normalize text
  const normalizedText = text.trim();
  
  if (normalizedText.length === 0) {
    return { 
      isEmergency: false, 
      severity: null, 
      matchedPhrase: null, 
      category: null 
    };
  }

  // Check each emergency pattern and return the highest severity match
  let highestSeverityMatch = null;
  const severityOrder = { 'CRITICAL': 3, 'HIGH': 2, 'MEDIUM': 1 };

  for (const { pattern, phrase, severity, category } of EMERGENCY_PATTERNS) {
    if (pattern.test(normalizedText)) {
      // If no match yet or this match has higher severity
      if (!highestSeverityMatch || 
          severityOrder[severity] > severityOrder[highestSeverityMatch.severity]) {
        highestSeverityMatch = { phrase, severity, category };
      }
    }
  }

  // Return the highest severity match or no emergency
  if (highestSeverityMatch) {
    return {
      isEmergency: true,
      severity: highestSeverityMatch.severity,
      matchedPhrase: highestSeverityMatch.phrase,
      category: highestSeverityMatch.category
    };
  }

  // No emergency patterns found
  return { 
    isEmergency: false, 
    severity: null, 
    matchedPhrase: null, 
    category: null 
  };
}

/**
 * Get all matched emergency patterns in the text (for debugging/analysis)
 * @param {string} text - The text to analyze
 * @returns {Array} - Array of matched phrases with severity and category
 */
function getAllEmergencyPatterns(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const matchedPatterns = [];
  const normalizedText = text.trim();

  for (const { pattern, phrase, severity, category } of EMERGENCY_PATTERNS) {
    if (pattern.test(normalizedText)) {
      matchedPatterns.push({ phrase, severity, category });
    }
  }

  return matchedPatterns;
}

/**
 * False positive patterns that indicate non-emergency contexts
 */
const FALSE_POSITIVE_PATTERNS = [
  // Hypothetical situations
  { pattern: /\b(if\s+i\s+|what\s+if\s+|suppose\s+|imagine\s+|hypothetically)\b/i, reason: 'hypothetical situation' },
  { pattern: /\b(would\s+have|could\s+have|should\s+have|might\s+have)\b/i, reason: 'hypothetical situation' },
  { pattern: /\b(in\s+case\s+|just\s+in\s+case|what\s+would\s+happen)\b/i, reason: 'hypothetical situation' },
  
  // Past events
  { pattern: /\b(last\s+year|yesterday|last\s+week|last\s+month|earlier\s+this\s+year)\b/i, reason: 'past event' },
  { pattern: /\b(used\s+to\s+|when\s+i\s+was|back\s+when|previously|before)\b/i, reason: 'past event' },
  { pattern: /\b(had\s+a\s+|suffered\s+from|experienced\s+a)\b/i, reason: 'past event' },
  
  // Third-party references
  { pattern: /\b(my\s+friend|my\s+family|my\s+neighbor|someone\s+else|on\s+tv|in\s+the\s+news)\b/i, reason: 'third-party reference' },
  { pattern: /\b(someone\s+i\s+know|a\s+person|this\s+guy|this\s+woman)\b/i, reason: 'third-party reference' },
  
  // Educational/entertainment contexts
  { pattern: /\b(example|story|dream|nightmare|movie|show|book|article)\b/i, reason: 'educational/entertainment context' },
  { pattern: /\b(learning\s+about|teaching\s+about|discussing|talking\s+about)\b/i, reason: 'educational/entertainment context' },
  { pattern: /\b(joke|funny|humor|comedy)\b/i, reason: 'educational/entertainment context' },
  
  // Medical/health discussions
  { pattern: /\b(symptoms\s+of|signs\s+of|causes\s+of|treatment\s+for)\b/i, reason: 'medical discussion' },
  { pattern: /\b(health\s+education|medical\s+information|doctor\s+said)\b/i, reason: 'medical discussion' },
];

/**
 * Filters out false positive emergency detections
 * @param {string} text - The original text
 * @param {Object} emergencyMatch - The emergency detection result
 * @returns {Object} - Object containing isFalsePositive boolean and reason string
 */
function filterFalsePositives(text, emergencyMatch) {
  // If no emergency was detected, it's not a false positive
  if (!emergencyMatch || !emergencyMatch.isEmergency) {
    return { isFalsePositive: false, reason: null };
  }

  if (!text || typeof text !== 'string') {
    return { isFalsePositive: false, reason: null };
  }

  const normalizedText = text.trim().toLowerCase();

  // Check for false positive patterns
  for (const { pattern, reason } of FALSE_POSITIVE_PATTERNS) {
    if (pattern.test(normalizedText)) {
      return { isFalsePositive: true, reason };
    }
  }

  // Additional context checks
  // NOTE: These patterns are conservative - we err on the side of sending alerts
  // Only filter if we're very confident it's not a current emergency
  const contextChecks = [
    // Check if emergency phrase appears in a hypothetical question (very specific)
    { pattern: /^\s*what\s+if\s+(i|you|someone)\s+(had|have|got|get)\s+(a\s+)?(heart\s+attack|stroke)/i, reason: 'hypothetical question' },
    
    // Check for educational context (very specific - must have "symptoms of" or "signs of" before)
    { pattern: /(what\s+are\s+)?(the\s+)?(symptoms\s+of|signs\s+of|what\s+is\s+a)\s+(heart\s+attack|stroke|emergency)/i, reason: 'educational context' },
    
    // Check for past tense (must have clear past tense verb BEFORE the emergency phrase)
    // Don't match if there's "I'm" or "I am" or "having" before it (present tense)
    { pattern: /(?:^|\W)(?:i\s+)?(had|suffered|experienced|got|was\s+diagnosed\s+with)\s+(a\s+)?(heart\s+attack|stroke|emergency)\b/i, reason: 'past tense' },
    
    // Check for third person (very specific - must be clearly about someone else)
    { pattern: /(?:^|\W)(?:my\s+)?(dad|mom|father|mother|friend|neighbor|brother|sister|uncle|aunt|they|he|she)\s+(had|has|suffered|experienced|got)\s+(a\s+)?(heart\s+attack|stroke|emergency)\b/i, reason: 'third person reference' }
  ];

  for (const { pattern, reason } of contextChecks) {
    if (pattern.test(normalizedText)) {
      return { isFalsePositive: true, reason };
    }
  }

  // No false positive indicators found
  return { isFalsePositive: false, reason: null };
}

module.exports = {
  detectEmergency,
  getAllEmergencyPatterns,
  filterFalsePositives,
  EMERGENCY_PATTERNS, // Export for testing/debugging
  FALSE_POSITIVE_PATTERNS // Export for testing/debugging
};
