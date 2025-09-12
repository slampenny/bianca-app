# Scripts Directory

This directory contains utility scripts for testing and deployment.

## Sentiment Analysis Test Scripts

### 1. `test-sentiment.js`
Direct service testing script that tests the sentiment analysis service directly without going through the API.

**Usage:**
```bash
# From the project root
node scripts/test-sentiment.js
```

**What it tests:**
- Basic sentiment analysis with sample conversations
- Positive, negative, and neutral sentiment detection
- Detailed vs basic analysis modes
- Fallback parsing when JSON parsing fails

### 2. `test-sentiment-api.js`
API endpoint testing script that tests the sentiment analysis API endpoints with authentication.

**Usage:**
```bash
# Set environment variables
export AUTH_TOKEN="your-jwt-token"
export TEST_PATIENT_ID="real-patient-id"
export TEST_CONVERSATION_ID="real-conversation-id"

# Run tests
node scripts/test-sentiment-api.js
```

**What it tests:**
- All sentiment analysis API endpoints
- Authentication and authorization
- Error handling
- Real patient and conversation data

### 3. `test-sentiment-staging.js` ⭐ **RECOMMENDED FOR STAGING**
Staging-friendly test script that uses the test routes to avoid authentication issues.

**Usage:**
```bash
# Set environment variables (optional)
export API_BASE_URL="https://staging-api.yourdomain.com"
export TEST_PATIENT_ID="real-patient-id"
export TEST_CONVERSATION_ID="real-conversation-id"

# Run tests
node scripts/test-sentiment-staging.js
```

**What it tests:**
- All sentiment analysis functionality via test routes
- Different time ranges (month, year, lifetime)
- Different conversation types (positive, negative, neutral)
- Comprehensive test suite
- No authentication required (uses test routes)

## Test Routes Available

The following test routes are available in the staging instance:

### Basic Sentiment Analysis
```bash
POST /api/v1/test/sentiment/analyze
```
Tests sentiment analysis with sample or custom conversation text.

### Patient Trend Analysis
```bash
GET /api/v1/test/sentiment/trend/{patientId}?timeRange=month
```
Tests sentiment trend analysis for a patient over different time ranges.

### Patient Summary Analysis
```bash
GET /api/v1/test/sentiment/summary/{patientId}
```
Tests sentiment summary analysis for a patient.

### Conversation Sentiment Check
```bash
GET /api/v1/test/sentiment/conversation/{conversationId}
```
Checks if a conversation has sentiment analysis data.

### Manual Sentiment Analysis
```bash
POST /api/v1/test/sentiment/analyze-conversation/{conversationId}
```
Manually triggers sentiment analysis for a completed conversation.

### Comprehensive Test Suite
```bash
POST /api/v1/test/sentiment/run-all-tests
```
Runs all sentiment analysis tests with optional patient and conversation IDs.

## Environment Variables

### Required for API Testing (`test-sentiment-api.js`)
- `AUTH_TOKEN`: JWT token for authentication
- `TEST_PATIENT_ID`: Real patient ID for testing
- `TEST_CONVERSATION_ID`: Real conversation ID for testing

### Optional for Staging Testing (`test-sentiment-staging.js`)
- `API_BASE_URL`: Base URL of the API (defaults to localhost:3000)
- `TEST_PATIENT_ID`: Patient ID for testing (defaults to test ID)
- `TEST_CONVERSATION_ID`: Conversation ID for testing (defaults to test ID)

## Example Usage from Staging

### 1. Test Basic Sentiment Analysis
```bash
curl -X POST https://staging-api.yourdomain.com/v1/test/sentiment/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "conversationText": "Patient: Hi Bianca, I am feeling great today! Bianca: That is wonderful to hear!",
    "detailed": true
  }'
```

### 2. Test Patient Trend Analysis
```bash
curl "https://staging-api.yourdomain.com/v1/test/sentiment/trend/507f1f77bcf86cd799439011?timeRange=month"
```

### 3. Run Comprehensive Test Suite
```bash
curl -X POST https://staging-api.yourdomain.com/v1/test/sentiment/run-all-tests \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "507f1f77bcf86cd799439011",
    "conversationId": "507f1f77bcf86cd799439012"
  }'
```

### 4. Run Staging Test Script
```bash
# From the staging server
cd /path/to/bianca-app-backend
export API_BASE_URL="https://staging-api.yourdomain.com"
export TEST_PATIENT_ID="real-patient-id"
node scripts/test-sentiment-staging.js
```

## Troubleshooting

### Common Issues

1. **"OpenAI API Key not found"**
   - Ensure the OpenAI API key is properly configured in the environment
   - Check that the sentiment service can access the config

2. **"Patient not found"**
   - Use a real patient ID from your database
   - Ensure the patient has completed conversations

3. **"Conversation not found"**
   - Use a real conversation ID from your database
   - Ensure the conversation status is 'completed'

4. **"No sentiment analysis data"**
   - The conversation may not have been analyzed yet
   - Use the manual analysis endpoint to trigger analysis

### Debug Mode

To enable debug logging, set the environment variable:
```bash
export DEBUG=sentiment:*
```

## Integration with CI/CD

These test scripts can be integrated into your CI/CD pipeline:

```yaml
# Example GitHub Actions step
- name: Test Sentiment Analysis
  run: |
    export API_BASE_URL="https://staging-api.yourdomain.com"
    export TEST_PATIENT_ID="${{ secrets.TEST_PATIENT_ID }}"
    node scripts/test-sentiment-staging.js
```

## Monitoring

The test routes provide structured responses that can be monitored:

```json
{
  "success": true,
  "testType": "sentiment_analysis",
  "result": {
    "data": {
      "overallSentiment": "positive",
      "sentimentScore": 0.7,
      "confidence": 0.9
    }
  }
}
```

Use these responses to set up monitoring alerts for sentiment analysis functionality.


