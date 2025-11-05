# Emergency Detection System

A comprehensive emergency detection and alerting system for patient utterances with intelligent deduplication, false positive filtering, and caregiver notifications.

## Features

### 🚨 Emergency Detection
- **Severity Levels**: CRITICAL (0-1 min), HIGH (1-5 min), MEDIUM (5-15 min)
- **Categories**: Medical, Safety, Physical, Request
- **Pattern Matching**: 50+ emergency patterns with case-insensitive matching
- **Confidence Scoring**: Dynamic confidence calculation based on severity and category

### 🛡️ False Positive Filtering
- **Hypothetical Situations**: "If I had a heart attack..."
- **Past Events**: "My dad had a stroke last year"
- **Third-party References**: "My friend is having..."
- **Educational Contexts**: "What are the symptoms of..."

### ⏰ Alert Deduplication
- **Debounce Window**: Configurable time window (default: 5 minutes)
- **Hourly Limits**: Maximum alerts per patient per hour (default: 10)
- **Category-based**: Different emergency types can alert independently
- **Automatic Cleanup**: Old alerts removed to prevent memory bloat

### 📱 Notifications
- **Alerts API Integration**: Creates alerts in existing system
- **AWS SNS Push Notifications**: Sends SMS to patient's caregivers
- **Configurable Templates**: Customizable message templates by severity
- **Multi-caregiver Support**: Notifies all assigned caregivers

## Quick Start

### Basic Usage

```javascript
const { emergencyProcessor } = require('./src/services/emergencyProcessor.service');

// Process patient utterance
const result = await emergencyProcessor.processUtterance(
  'patient123',
  "I'm having a heart attack",
  Date.now()
);

if (result.shouldAlert) {
  // Create alert in system
  const alertResult = await emergencyProcessor.createAlert(
    'patient123',
    result.alertData,
    "I'm having a heart attack"
  );
  
  console.log('Alert created:', alertResult.success);
}
```

### Configuration

Create `config/emergency.config.json` or set `EMERGENCY_CONFIG` environment variable:

```json
{
  "debounceMinutes": 5,
  "maxAlertsPerHour": 10,
  "enableSNSPushNotifications": true,
  "severityResponseTimes": {
    "CRITICAL": 60,
    "HIGH": 300,
    "MEDIUM": 900
  }
}
```

### Environment Variables

```bash
# Enable SNS notifications
EMERGENCY_SNS_TOPIC_ARN=arn:aws:sns:us-east-2:123456789012:emergency-alerts
AWS_REGION=us-east-2

# Configuration file path
EMERGENCY_CONFIG_PATH=./config/emergency.config.json

# Or inline configuration
EMERGENCY_CONFIG='{"debounceMinutes": 5, "maxAlertsPerHour": 10}'
```

## API Reference

### EmergencyProcessor

#### `processUtterance(patientId, text, timestamp?)`
Process a patient utterance for emergency detection.

**Parameters:**
- `patientId` (string): Patient identifier
- `text` (string): Patient utterance text
- `timestamp` (number, optional): Timestamp (defaults to now)

**Returns:**
```javascript
{
  shouldAlert: boolean,
  alertData: {
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM',
    category: 'Medical' | 'Safety' | 'Physical' | 'Request',
    phrase: string,
    confidence: number,
    responseTimeSeconds: number
  } | null,
  reason: string,
  processing: {
    emergencyDetected: boolean,
    falsePositive: boolean,
    deduplicationPassed: boolean,
    confidence: number
  }
}
```

#### `createAlert(patientId, alertData, originalText)`
Create an alert in the system and send notifications.

**Parameters:**
- `patientId` (string): Patient identifier
- `alertData` (object): Alert data from `processUtterance`
- `originalText` (string): Original patient utterance

**Returns:**
```javascript
{
  success: boolean,
  alert: object, // Created alert record
  notificationResult: object, // SNS notification result
  patient: {
    id: string,
    name: string,
    preferredName: string
  }
}
```

### AlertDeduplicator

#### `shouldAlert(patientId, category, text, timestamp?)`
Check if an alert should be sent based on deduplication rules.

#### `recordAlert(patientId, category, timestamp?, text?)`
Record that an alert was sent.

#### `getRecentAlerts(patientId, hoursBack?)`
Get recent alerts for a patient.

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `debounceMinutes` | number | 5 | Minutes to wait before allowing duplicate alerts |
| `maxAlertsPerHour` | number | 10 | Maximum alerts per patient per hour |
| `enableFalsePositiveFilter` | boolean | true | Enable false positive filtering |
| `enableSNSPushNotifications` | boolean | false | Enable AWS SNS notifications |
| `severityResponseTimes` | object | See config | Response time limits by severity |

## Emergency Patterns

### CRITICAL Severity
- **Medical**: Heart attack, stroke, can't breathe, choking, seizures, anaphylaxis, overdose, poisoning
- **Safety**: Suicide, self-harm

### HIGH Severity
- **Medical**: Chest pain, severe pain
- **Physical**: Fell down, can't get up, hit head, broken bones
- **Safety**: Intruder, break-in

### MEDIUM Severity
- **Medical**: Feel sick, dizzy, nausea, breathing difficulty
- **Request**: Need help, call ambulance, call 911

## Testing

```bash
# Run emergency detection tests
yarn test src/utils/__tests__/emergencyDetector.test.js

# Run deduplication tests
yarn test src/utils/__tests__/alertDeduplicator.test.js

# Run processor tests
yarn test src/services/__tests__/emergencyProcessor.test.js
```

## Integration

### With OpenAI Realtime Service

```javascript
// In your conversation handler
const { emergencyProcessor } = require('../services/emergencyProcessor.service');

// After receiving patient utterance
const emergencyResult = await emergencyProcessor.processUtterance(
  patientId,
  patientUtterance,
  Date.now()
);

if (emergencyResult.shouldAlert) {
  // Create alert and notify caregivers
  await emergencyProcessor.createAlert(patientId, emergencyResult.alertData, patientUtterance);
  
  // Optionally interrupt conversation for critical emergencies
  if (emergencyResult.alertData.severity === 'CRITICAL') {
    // Handle critical emergency flow
  }
}
```

### With Existing Alerts API

The system automatically integrates with your existing alerts API:
- Creates alert records in the database
- Uses existing alert importance levels (urgent, high, medium, low)
- Respects visibility settings (assigned caregivers)
- Sets relevance until times based on severity

## Monitoring

### Get System Status

```javascript
const status = emergencyProcessor.getStatus();
console.log('Processor status:', status);
```

### Get Deduplication Statistics

```javascript
const stats = alertDeduplicator.getStats();
console.log('Deduplication stats:', stats);
```

## Error Handling

The system is designed to never throw exceptions that would stop processing:

- Invalid inputs return safe defaults
- Network errors are logged but don't block processing
- Configuration errors are validated at startup
- Graceful degradation when services are unavailable

## Security Considerations

- Patient data is only stored temporarily for deduplication
- Phone numbers are validated before sending notifications
- Configuration can be updated without code changes
- All operations are logged for audit trails

## Performance

- In-memory deduplication for fast lookups
- Automatic cleanup prevents memory leaks
- Minimal database queries
- Configurable debounce windows reduce spam
