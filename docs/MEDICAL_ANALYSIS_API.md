# Medical NLP Analysis API

## Overview

The Medical NLP Analysis API provides endpoints for analyzing patient conversations to detect cognitive and psychiatric indicators using lightweight NLP techniques. This system processes conversation patterns monthly to identify potential health concerns and generate actionable recommendations.

## API Endpoints

### Base URL
```
/api/v1/medical-analysis
```

### Authentication
All endpoints require Bearer token authentication.

## Endpoints

### 1. Get Medical Analysis
**GET** `/api/v1/medical-analysis/{patientId}`

Retrieves comprehensive medical NLP analysis for a patient over a specified time period.

#### Parameters
- `patientId` (path): Patient ID
- `timeRange` (query): Time range for analysis (`month`, `quarter`, `year`, `custom`)
- `startDate` (query): Start date for custom range (ISO 8601 format)
- `endDate` (query): End date for custom range (ISO 8601 format)
- `includeBaseline` (query): Whether to include baseline comparison (boolean, default: true)

#### Response
```json
{
  "success": true,
  "data": {
    "patientId": "string",
    "patientName": "string",
    "timeRange": "month",
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-01-31T23:59:59.999Z",
    "conversationCount": 15,
    "messageCount": 45,
    "totalWords": 1250,
    "analysis": {
      "cognitiveMetrics": {
        "riskScore": 65,
        "confidence": "medium",
        "indicators": [...],
        "fillerWordDensity": 0.03,
        "vagueReferenceDensity": 0.02,
        "informationDensity": 45.5
      },
      "psychiatricMetrics": {
        "depressionScore": 55,
        "anxietyScore": 40,
        "overallRiskScore": 48,
        "crisisIndicators": {
          "hasCrisisIndicators": false,
          "crisisCount": 0
        }
      },
      "vocabularyMetrics": {
        "uniqueWords": 180,
        "totalWords": 1250,
        "typeTokenRatio": 0.144,
        "avgWordLength": 4.2,
        "complexityScore": 68
      },
      "warnings": [],
      "confidence": "medium",
      "analysisDate": "2024-01-31T12:00:00.000Z"
    },
    "baseline": {
      "patientId": "string",
      "type": "rolling",
      "establishedDate": "2024-01-01T00:00:00.000Z",
      "lastUpdated": "2024-01-31T12:00:00.000Z",
      "metrics": {...},
      "version": 3
    },
    "recommendations": [
      {
        "category": "cognitive",
        "severity": "medium",
        "title": "Monitor Communication Patterns",
        "description": "Increased use of filler words may indicate cognitive changes",
        "priority": 2
      }
    ],
    "generatedAt": "2024-01-31T12:00:00.000Z"
  }
}
```

### 2. Get Medical Analysis Summary
**GET** `/api/v1/medical-analysis/{patientId}/summary`

Retrieves a summary of medical analysis suitable for dashboard display.

#### Parameters
- `patientId` (path): Patient ID

#### Response
```json
{
  "success": true,
  "data": {
    "patientId": "string",
    "patientName": "string",
    "hasData": true,
    "summary": {
      "totalConversations": 15,
      "lastAnalysisDate": "2024-01-31T12:00:00.000Z",
      "overallHealthScore": 72,
      "riskIndicators": [
        {
          "category": "cognitive",
          "severity": "medium",
          "description": "Cognitive decline indicators detected"
        }
      ],
      "positiveTrends": [
        {
          "category": "cognitive",
          "description": "Good vocabulary complexity maintained"
        }
      ],
      "concerns": []
    },
    "lastAnalysisDate": "2024-01-31T12:00:00.000Z",
    "conversationCount": 15,
    "messageCount": 45
  }
}
```

### 3. Get Baseline
**GET** `/api/v1/medical-analysis/{patientId}/baseline`

Retrieves the established baseline metrics for a patient.

#### Parameters
- `patientId` (path): Patient ID

#### Response
```json
{
  "success": true,
  "data": {
    "patientId": "string",
    "type": "rolling",
    "establishedDate": "2024-01-01T00:00:00.000Z",
    "lastUpdated": "2024-01-31T12:00:00.000Z",
    "dataPoints": [...],
    "metrics": {
      "vocabularyScore": {
        "mean": 68.5,
        "std": 5.2,
        "min": 60,
        "max": 75
      },
      "depressionScore": {
        "mean": 45.2,
        "std": 8.1,
        "min": 35,
        "max": 55
      }
    },
    "seasonalAdjustments": {...},
    "version": 3
  }
}
```

### 4. Establish Baseline
**POST** `/api/v1/medical-analysis/{patientId}/baseline`

Establishes or updates the baseline metrics for a patient.

#### Parameters
- `patientId` (path): Patient ID

#### Request Body
```json
{
  "metrics": {
    "vocabularyScore": 68,
    "depressionScore": 45,
    "anxietyScore": 40,
    "cognitiveScore": 72,
    "analysisDate": "2024-01-31T12:00:00.000Z"
  }
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "patientId": "string",
    "type": "initial",
    "establishedDate": "2024-01-31T12:00:00.000Z",
    "lastUpdated": "2024-01-31T12:00:00.000Z",
    "dataPoints": [...],
    "metrics": {...},
    "seasonalAdjustments": {...},
    "version": 1
  },
  "message": "Baseline established successfully"
}
```

## Analysis Components

### Cognitive Metrics
- **Risk Score**: Overall cognitive health score (0-100)
- **Filler Word Density**: Frequency of "um", "uh", "like", etc.
- **Vague Reference Density**: Frequency of "thing", "stuff", "whatnot"
- **Information Density**: Concepts per sentence ratio
- **Word Finding Difficulty**: Patterns indicating aphasia-like symptoms

### Psychiatric Metrics
- **Depression Score**: Linguistic indicators of depression (0-100)
- **Anxiety Score**: Anxiety-related language patterns (0-100)
- **Crisis Indicators**: Detection of suicidal ideation or self-harm language
- **Temporal Focus**: Past/present/future orientation analysis
- **Absolutist Language**: Use of "always", "never", "everything", "nothing"

### Vocabulary Metrics
- **Type-Token Ratio**: Vocabulary diversity measure
- **Average Word Length**: Complexity indicator
- **Complexity Score**: Overall language sophistication (0-100)
- **Unique Word Count**: Total distinct words used

### Recommendations System
The system generates prioritized recommendations based on analysis results:

- **Priority 0**: Critical (crisis indicators, immediate intervention needed)
- **Priority 1**: High (significant concerns, professional evaluation recommended)
- **Priority 2**: Medium (monitoring recommended, minor concerns)

## Error Handling

All endpoints return appropriate HTTP status codes and error messages:

- **400**: Bad Request (invalid parameters)
- **401**: Unauthorized (missing or invalid token)
- **404**: Not Found (patient not found)
- **500**: Internal Server Error (analysis failed)

## Rate Limiting

Standard API rate limiting applies to all endpoints.

## Data Privacy

All analysis is performed on conversation data that has already been processed and stored according to your existing privacy policies. No additional data collection occurs.

## Integration Notes

- The analysis system integrates with your existing conversation and patient services
- Baseline data is stored using your existing database infrastructure
- All analysis results are logged for audit purposes
- The system is designed to handle large volumes of conversation data efficiently
