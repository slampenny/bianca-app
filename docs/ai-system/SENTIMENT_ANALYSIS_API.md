# Sentiment Analysis API Documentation

This document describes the sentiment analysis API endpoints that provide insights into patient emotional states and conversation trends.

## Overview

The sentiment analysis system automatically analyzes patient conversations using ChatGPT to provide:
- Overall sentiment classification (positive, negative, neutral, mixed)
- Sentiment scores (-1 to 1)
- Patient mood analysis
- Key emotions detection
- Concern level assessment
- Trend analysis over time
- Key insights and recommendations

## API Endpoints

### Base URL
All sentiment analysis endpoints are available under `/api/v1/sentiment/`

### Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Get Sentiment Trend for Patient

**GET** `/sentiment/patient/{patientId}/trend`

Returns sentiment analysis data points for a patient over a specified time range, suitable for displaying in graphs and charts.

#### Parameters
- `patientId` (path): The patient ID
- `timeRange` (query, optional): Time range for analysis
  - `month` (default): Last month
  - `year`: Last year  
  - `lifetime`: All time

#### Response
```json
{
  "patientId": "507f1f77bcf86cd799439011",
  "timeRange": "month",
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-02-01T00:00:00.000Z",
  "totalConversations": 15,
  "analyzedConversations": 12,
  "dataPoints": [
    {
      "conversationId": "507f1f77bcf86cd799439012",
      "date": "2024-01-15T10:30:00.000Z",
      "duration": 300,
      "sentiment": {
        "overallSentiment": "positive",
        "sentimentScore": 0.7,
        "confidence": 0.9,
        "patientMood": "Patient appears cheerful and optimistic",
        "keyEmotions": ["happiness", "satisfaction"],
        "concernLevel": "low",
        "summary": "Patient expressed positive feelings about their treatment"
      },
      "sentimentAnalyzedAt": "2024-01-15T10:35:00.000Z"
    }
  ],
  "summary": {
    "averageSentiment": 0.4,
    "sentimentDistribution": {
      "positive": 8,
      "neutral": 3,
      "negative": 1
    },
    "trendDirection": "improving",
    "confidence": 0.8,
    "keyInsights": [
      "Patient shows generally positive sentiment",
      "Sentiment trend is improving over time"
    ]
  }
}
```

### 2. Get Sentiment Summary for Patient

**GET** `/sentiment/patient/{patientId}/summary`

Returns a summary of recent sentiment analysis for a patient, including key insights and trends.

#### Parameters
- `patientId` (path): The patient ID

#### Response
```json
{
  "totalConversations": 10,
  "analyzedConversations": 8,
  "averageSentiment": 0.3,
  "sentimentDistribution": {
    "positive": 5,
    "neutral": 2,
    "negative": 1
  },
  "trendDirection": "stable",
  "confidence": 0.7,
  "keyInsights": [
    "Recent conversations show positive sentiment"
  ],
  "recentTrend": [
    {
      "conversationId": "507f1f77bcf86cd799439012",
      "date": "2024-01-15T10:30:00.000Z",
      "duration": 300,
      "sentiment": {
        "overallSentiment": "positive",
        "sentimentScore": 0.7,
        "confidence": 0.9
      }
    }
  ]
}
```

### 3. Get Sentiment for Specific Conversation

**GET** `/sentiment/conversation/{conversationId}`

Returns the sentiment analysis data for a specific conversation if available.

#### Parameters
- `conversationId` (path): The conversation ID

#### Response
```json
{
  "conversationId": "507f1f77bcf86cd799439012",
  "sentiment": {
    "overallSentiment": "positive",
    "sentimentScore": 0.7,
    "confidence": 0.9,
    "patientMood": "Patient appears cheerful and optimistic",
    "keyEmotions": ["happiness", "satisfaction"],
    "concernLevel": "low",
    "summary": "Patient expressed positive feelings about their treatment",
    "recommendations": "Continue current treatment plan"
  },
  "sentimentAnalyzedAt": "2024-01-15T10:35:00.000Z",
  "hasSentimentAnalysis": true
}
```

### 4. Trigger Sentiment Analysis for Conversation

**POST** `/sentiment/conversation/{conversationId}/analyze`

Manually triggers sentiment analysis for a completed conversation using ChatGPT.

#### Parameters
- `conversationId` (path): The conversation ID

#### Response
```json
{
  "success": true,
  "conversationId": "507f1f77bcf86cd799439012",
  "sentiment": {
    "overallSentiment": "positive",
    "sentimentScore": 0.7,
    "confidence": 0.9,
    "patientMood": "Patient appears cheerful and optimistic",
    "keyEmotions": ["happiness", "satisfaction"],
    "concernLevel": "low",
    "summary": "Patient expressed positive feelings about their treatment",
    "recommendations": "Continue current treatment plan"
  },
  "analyzedAt": "2024-01-15T10:35:00.000Z"
}
```

## Data Models

### SentimentAnalysis
- `overallSentiment`: "positive" | "negative" | "neutral" | "mixed"
- `sentimentScore`: Number (-1 to 1)
- `confidence`: Number (0 to 1)
- `patientMood`: String (description of emotional state)
- `keyEmotions`: Array of strings
- `concernLevel`: "low" | "medium" | "high"
- `satisfactionIndicators`: Object with positive/negative arrays
- `summary`: String (brief analysis summary)
- `recommendations`: String (follow-up care recommendations)
- `fallback`: Boolean (whether fallback parsing was used)

### SentimentTrendPoint
- `conversationId`: String
- `date`: ISO date string
- `duration`: Number (seconds)
- `sentiment`: SentimentAnalysis object
- `sentimentAnalyzedAt`: ISO date string

## Error Responses

### 400 Bad Request
```json
{
  "code": 400,
  "message": "Invalid timeRange. Must be one of: month, year, lifetime"
}
```

### 401 Unauthorized
```json
{
  "code": 401,
  "message": "Please authenticate"
}
```

### 403 Forbidden
```json
{
  "code": 403,
  "message": "You do not have access to this patient"
}
```

### 404 Not Found
```json
{
  "code": 404,
  "message": "Patient not found"
}
```

### 500 Internal Server Error
```json
{
  "code": 500,
  "message": "Sentiment analysis failed: OpenAI API error"
}
```

## Usage Examples

### Frontend Integration

#### React/TypeScript Example
```typescript
// Get sentiment trend for a patient
const getSentimentTrend = async (patientId: string, timeRange: 'month' | 'year' | 'lifetime' = 'month') => {
  const response = await fetch(`/api/v1/sentiment/patient/${patientId}/trend?timeRange=${timeRange}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch sentiment trend');
  }
  
  return response.json();
};

// Display sentiment trend in a chart
const SentimentChart = ({ patientId }: { patientId: string }) => {
  const [trendData, setTrendData] = useState(null);
  
  useEffect(() => {
    getSentimentTrend(patientId, 'month').then(setTrendData);
  }, [patientId]);
  
  if (!trendData) return <div>Loading...</div>;
  
  return (
    <div>
      <h3>Sentiment Trend ({trendData.timeRange})</h3>
      <p>Average Sentiment: {trendData.summary.averageSentiment}</p>
      <p>Trend: {trendData.summary.trendDirection}</p>
      <p>Data Points: {trendData.dataPoints.length}</p>
      
      {/* Render chart with trendData.dataPoints */}
    </div>
  );
};
```

#### Chart.js Example
```javascript
// Prepare data for Chart.js
const prepareChartData = (trendData) => {
  return {
    labels: trendData.dataPoints.map(point => 
      new Date(point.date).toLocaleDateString()
    ),
    datasets: [{
      label: 'Sentiment Score',
      data: trendData.dataPoints.map(point => 
        point.sentiment?.sentimentScore || 0
      ),
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      tension: 0.1
    }]
  };
};
```

## Testing

### Test Routes (Recommended for Staging)
The sentiment analysis system includes comprehensive test routes that can be accessed without authentication:

#### Available Test Endpoints:
- `POST /api/v1/test/sentiment/analyze` - Test basic sentiment analysis
- `GET /api/v1/test/sentiment/trend/{patientId}` - Test patient trend analysis
- `GET /api/v1/test/sentiment/summary/{patientId}` - Test patient summary analysis
- `GET /api/v1/test/sentiment/conversation/{conversationId}` - Test conversation sentiment check
- `POST /api/v1/test/sentiment/analyze-conversation/{conversationId}` - Test manual analysis
- `POST /api/v1/test/sentiment/run-all-tests` - Run comprehensive test suite

#### Staging Test Script:
```bash
# From the staging server
cd /path/to/bianca-app-backend
export API_BASE_URL="https://staging-api.yourdomain.com"
export TEST_PATIENT_ID="real-patient-id"
node scripts/test-sentiment-staging.js
```

### Manual Testing with Authentication
Use the provided test script with authentication:
```bash
# Set environment variables
export AUTH_TOKEN="your-jwt-token"
export TEST_PATIENT_ID="real-patient-id"
export TEST_CONVERSATION_ID="real-conversation-id"

# Run tests
node scripts/test-sentiment-api.js
```

### cURL Examples
```bash
# Get sentiment trend
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/v1/sentiment/patient/507f1f77bcf86cd799439011/trend?timeRange=month"

# Get sentiment summary
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/v1/sentiment/patient/507f1f77bcf86cd799439011/summary"

# Trigger sentiment analysis
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/v1/sentiment/conversation/507f1f77bcf86cd799439012/analyze"
```

## Swagger Documentation

The API is fully documented with Swagger/OpenAPI specifications. Access the interactive documentation at:
- Development: `http://localhost:3000/v1/docs`
- Production: `https://your-api-domain.com/v1/docs`

## Performance Considerations

- Sentiment analysis is performed automatically when conversations end
- Trend analysis queries are optimized with database indexes
- Results are cached in the conversation's `analyzedData` field
- Batch analysis is available for processing multiple conversations

## Security

- All endpoints require authentication
- Staff users can only access their assigned patients
- Organization admins can access all patients in their organization
- Patient data is protected by role-based access control

## Monitoring

- Sentiment analysis failures are logged for monitoring
- API response times are tracked
- Error rates are monitored for OpenAI API calls
- Conversation completion rates with sentiment analysis are tracked
