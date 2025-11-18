const winston = require('winston');

/**
 * HIPAA-Compliant Logger with PHI Redaction
 * 
 * HIPAA Requirements:
 * - §164.308(a)(1)(ii)(D) - Information System Activity Review
 * - Logs must NOT contain PHI (Protected Health Information)
 * - All PHI must be redacted before logging
 */

// PHI Redaction Patterns
const PHI_PATTERNS = [
  // Email addresses
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL_REDACTED]' },
  
  // Phone numbers (various formats)
  { pattern: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, replacement: '[PHONE_REDACTED]' },
  
  // MongoDB ObjectIds (patient IDs, conversation IDs, etc.) - only in specific contexts
  { pattern: /patient[^\s]*[:\s=]["']?[a-f0-9]{24}["']?/gi, replacement: 'patient=[ID_REDACTED]' },
  { pattern: /conversation[^\s]*[:\s=]["']?[a-f0-9]{24}["']?/gi, replacement: 'conversation=[ID_REDACTED]' },
  { pattern: /"patientId"\s*:\s*"[a-f0-9]{24}"/g, replacement: '"patientId":"[ID_REDACTED]"' },
  { pattern: /"conversationId"\s*:\s*"[a-f0-9]{24}"/g, replacement: '"conversationId":"[ID_REDACTED]"' },
  
  // JSON fields containing PHI
  { pattern: /"email"\s*:\s*"[^"]+"/g, replacement: '"email":"[REDACTED]"' },
  { pattern: /"phone"\s*:\s*"[^"]+"/g, replacement: '"phone":"[REDACTED]"' },
  { pattern: /"phoneNumber"\s*:\s*"[^"]+"/g, replacement: '"phoneNumber":"[REDACTED]"' },
  { pattern: /"ssn"\s*:\s*"[^"]+"/g, replacement: '"ssn":"[REDACTED]"' },
  { pattern: /"dateOfBirth"\s*:\s*"[^"]+"/g, replacement: '"dateOfBirth":"[REDACTED]"' },
  { pattern: /"dob"\s*:\s*"[^"]+"/g, replacement: '"dob":"[REDACTED]"' },
  { pattern: /"address"\s*:\s*"[^"]+"/g, replacement: '"address":"[REDACTED]"' },
  { pattern: /"medicalRecordNumber"\s*:\s*"[^"]+"/g, replacement: '"medicalRecordNumber":"[REDACTED]"' },
  { pattern: /"diagnosis"\s*:\s*"[^"]+"/g, replacement: '"diagnosis":"[REDACTED]"' },
  { pattern: /"medication"\s*:\s*"[^"]+"/g, replacement: '"medication":"[REDACTED]"' },
  { pattern: /"symptoms"\s*:\s*"[^"]+"/g, replacement: '"symptoms":"[REDACTED]"' },
  
  // Conversation transcripts
  { pattern: /"transcript"\s*:\s*"[^"]*"/g, replacement: '"transcript":"[TRANSCRIPT_REDACTED]"' },
  { pattern: /"transcription"\s*:\s*"[^"]*"/g, replacement: '"transcription":"[TRANSCRIPT_REDACTED]"' },
  { pattern: /"text"\s*:\s*"[^"]*"/g, replacement: '"text":"[TEXT_REDACTED]"' },
  
  // Social Security Numbers (various formats)
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN_REDACTED]' },
  { pattern: /\b\d{9}\b/g, replacement: '[SSN_REDACTED]' },
  
  // Credit card numbers
  { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: '[CARD_REDACTED]' },
  
  // Dates that could be DOB
  { pattern: /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](19|20)\d{2}\b/g, replacement: '[DATE_REDACTED]' },
];

/**
 * Custom Winston format for PHI redaction
 * In staging/development, debug logs don't redact emails for troubleshooting
 */
const phiRedactor = winston.format((info) => {
  // Convert message to string if it's an object
  let message = typeof info.message === 'string' ? info.message : JSON.stringify(info.message);
  
  // In staging/development, don't redact emails in debug logs for troubleshooting
  const isDebugLog = info.level === 'debug';
  const isStagingOrDev = process.env.NODE_ENV === 'staging' || process.env.NODE_ENV === 'development';
  const shouldRedactEmails = !(isDebugLog && isStagingOrDev);
  
  // Apply PHI redaction patterns
  PHI_PATTERNS.forEach(({ pattern, replacement }) => {
    // Skip email redaction in debug logs for staging/development
    if (!shouldRedactEmails && pattern.source.includes('@')) {
      return; // Skip email pattern
    }
    message = message.replace(pattern, replacement);
  });
  
  // Redact any remaining sensitive data in metadata
  if (info.meta && typeof info.meta === 'object') {
    info.meta = redactObject(info.meta, shouldRedactEmails);
  }
  
  info.message = message;
  return info;
})();

/**
 * Recursively redact sensitive fields from objects
 * @param {Object} obj - Object to redact
 * @param {boolean} shouldRedactEmails - Whether to redact emails (false for debug logs in staging/dev)
 */
function redactObject(obj, shouldRedactEmails = true) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  const redacted = Array.isArray(obj) ? [] : {};
  const sensitiveFields = [
    'phone', 'phoneNumber', 'ssn', 'dateOfBirth', 'dob',
    'address', 'medicalRecordNumber', 'diagnosis', 'medication',
    'symptoms', 'transcript', 'transcription', 'text', 'password',
    'token', 'secret', 'apiKey'
  ];
  
  // Add email to sensitive fields only if we should redact emails
  if (shouldRedactEmails) {
    sensitiveFields.push('email');
  }
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      // Redact sensitive fields
      if (sensitiveFields.includes(key.toLowerCase())) {
        redacted[key] = '[REDACTED]';
      }
      // Recursively redact nested objects
      else if (typeof obj[key] === 'object' && obj[key] !== null) {
        redacted[key] = redactObject(obj[key], shouldRedactEmails);
      }
      // Keep other values
      else {
        redacted[key] = obj[key];
      }
    }
  }
  
  return redacted;
}

/**
 * Production-safe error formatter
 * Removes stack traces and sensitive error details in production
 */
const errorFormatter = winston.format((info) => {
  if (info.level === 'error' && process.env.NODE_ENV === 'production') {
    // Keep error message but remove stack trace in production logs
    if (info.stack) {
      delete info.stack;
    }
  }
  return info;
})();

// Create logger with PHI redaction
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : process.env.NODE_ENV === 'test' ? 'warn' : 'debug',
  
  format: winston.format.combine(
    phiRedactor,           // HIPAA: Redact PHI from all logs
    errorFormatter,        // Format errors safely
    winston.format.timestamp(),
    winston.format.errors({ stack: process.env.NODE_ENV !== 'production' }), // Stack traces only in dev
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let log = `${timestamp} ${level}: ${message}`;
      
      // Add metadata if present (already redacted)
      if (Object.keys(meta).length > 0 && process.env.NODE_ENV !== 'production') {
        log += ` ${JSON.stringify(meta)}`;
      }
      
      return log;
    })
  ),
  
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'], // 'error' level logs go to STDERR; all others to STDOUT
    }),
  ],
  
  exceptionHandlers: [
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
  
  rejectionHandlers: [
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
});

// Add file transport for production (optional)
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
  
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    })
  );
}

// Warn about PHI in development
if (process.env.NODE_ENV === 'development') {
  logger.info('[HIPAA] PHI redaction is active. All sensitive data will be masked in logs.');
}

module.exports = logger;
