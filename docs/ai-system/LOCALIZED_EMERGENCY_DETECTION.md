# Localized Emergency Detection System

## Overview

The localized emergency detection system allows the platform to detect emergency phrases in multiple languages based on each patient's preferred language setting. This ensures that patients who speak languages other than English can still trigger emergency alerts when they express urgent medical needs.

## Features

- **Multi-language Support**: Detects emergency phrases in 10 supported languages (EN, ES, FR, DE, ZH, JA, PT, IT, RU, AR)
- **Patient Language Preference**: Automatically uses the patient's `preferredLanguage` setting
- **Admin-Only Management**: Only company staff can add, edit, or remove emergency phrases
- **Pattern-based Detection**: Uses regex patterns for flexible phrase matching
- **Severity Levels**: CRITICAL, HIGH, MEDIUM with appropriate response times
- **Categories**: Medical, Safety, Physical, Request for better organization
- **Usage Analytics**: Track which phrases are most commonly triggered
- **Bulk Import/Export**: Easy management of large phrase sets

## Architecture

### Components

1. **EmergencyPhrase Model** (`src/models/emergencyPhrase.model.js`)
   - Database model for storing emergency phrases
   - Includes language, severity, category, regex pattern
   - Tracks usage statistics and modification history

2. **LocalizedEmergencyDetector Service** (`src/services/localizedEmergencyDetector.service.js`)
   - Core detection logic using database-stored phrases
   - Caching for performance optimization
   - Language-specific phrase retrieval

3. **EmergencyPhrase Service** (`src/services/emergencyPhrase.service.js`)
   - CRUD operations for phrase management
   - Pattern validation and testing
   - Bulk import/export functionality

4. **EmergencyPhrase Controller** (`src/controllers/emergencyPhrase.controller.js`)
   - API endpoints for phrase management
   - Admin-only access controls

5. **Updated Emergency Processor** (`src/services/emergencyProcessor.service.js`)
   - Integrates with localized detector
   - Uses patient language preference

## API Endpoints

All endpoints require admin-level authentication (`manageAny:emergencyPhrase` or `readAny:emergencyPhrase`):

### Phrase Management
- `POST /v1/emergency-phrases` - Create new phrase
- `GET /v1/emergency-phrases` - List phrases with filtering
- `GET /v1/emergency-phrases/:phraseId` - Get specific phrase
- `PATCH /v1/emergency-phrases/:phraseId` - Update phrase
- `DELETE /v1/emergency-phrases/:phraseId` - Delete phrase
- `PATCH /v1/emergency-phrases/:phraseId/toggle` - Toggle active status

### Utility Endpoints
- `GET /v1/emergency-phrases/statistics` - Get usage statistics
- `POST /v1/emergency-phrases/test-pattern` - Test regex pattern
- `POST /v1/emergency-phrases/bulk-import` - Import multiple phrases
- `GET /v1/emergency-phrases/export` - Export phrases to JSON
- `GET /v1/emergency-phrases/language/:language` - Get phrases by language

## Usage

### 1. Initialize Default Phrases

```bash
node scripts/initialize-emergency-phrases.js
```

This creates default emergency phrases for all supported languages.

### 2. Adding New Phrases

```javascript
const phraseData = {
  phrase: 'heart attack',
  language: 'en',
  severity: 'CRITICAL',
  category: 'Medical',
  pattern: '\\b(heart\\s+attack|heartattack)\\b',
  description: 'Heart attack emergency phrase'
};

// POST /v1/emergency-phrases
```

### 3. Testing Patterns

```javascript
const testData = {
  pattern: '\\b(heart\\s+attack)\\b',
  testText: 'I think I am having a heart attack'
};

// POST /v1/emergency-phrases/test-pattern
```

### 4. Emergency Detection

The system automatically detects emergencies based on patient language:

```javascript
// Patient with preferredLanguage: 'es'
const result = await emergencyProcessor.processUtterance(
  patientId,
  'Creo que estoy teniendo un ataque al corazón'
);
// Will detect Spanish phrase: 'ataque al corazón'
```

## Supported Languages

| Code | Language | Example Phrase |
|------|----------|----------------|
| en   | English  | "heart attack" |
| es   | Spanish  | "ataque al corazón" |
| fr   | French   | "crise cardiaque" |
| de   | German   | "Herzinfarkt" |
| zh   | Chinese  | "心脏病发作" |
| ja   | Japanese | "心臓発作" |
| pt   | Portuguese | "ataque cardíaco" |
| it   | Italian  | "attacco di cuore" |
| ru   | Russian  | "сердечный приступ" |
| ar   | Arabic   | "نوبة قلبية" |

## Security

- **Admin-Only Access**: Only company staff can manage phrases
- **Pattern Validation**: All regex patterns are validated before saving
- **Input Sanitization**: All inputs are sanitized and validated
- **Audit Trail**: Tracks who created/modified each phrase

## Performance

- **Caching**: Compiled regex patterns are cached for 5 minutes
- **Database Indexing**: Optimized queries with compound indexes
- **Lazy Loading**: Phrases are loaded only when needed
- **Bulk Operations**: Efficient import/export for large datasets

## Monitoring

- **Usage Statistics**: Track which phrases are most effective
- **Language Distribution**: Monitor phrase coverage by language
- **Performance Metrics**: Response times and detection accuracy
- **Error Logging**: Comprehensive error tracking and debugging

## Testing

Run the comprehensive test suite:

```bash
npm test -- tests/integration/localizedEmergencyDetection.test.js
```

Tests cover:
- API endpoint functionality
- Multi-language detection
- Pattern validation
- Integration with emergency processor
- Error handling and edge cases

## Migration from Hardcoded Phrases

The system maintains backward compatibility with the existing hardcoded English phrases while providing the new localized functionality. The old `emergencyDetector.js` is still available for fallback scenarios.

## Future Enhancements

- **Machine Learning**: AI-powered phrase suggestion and optimization
- **Context Awareness**: Better false positive filtering based on conversation context
- **Custom Languages**: Support for additional languages and dialects
- **Real-time Updates**: Live phrase updates without service restart
- **Analytics Dashboard**: Visual interface for phrase management and analytics
