# Call Workflow Implementation

This document describes the implementation of the "Call Now" button workflow for patient calls.

## Overview

The call workflow allows agents to manually initiate calls to patients and monitor call progress in real-time through the conversation screen. It uses polling for status updates and integrates with your existing Twilio/Asterisk infrastructure.

## Architecture

### Backend
- **Controller-based coordination**: The `callWorkflow.controller.js` coordinates between existing services
- **Enhanced Conversation model**: Added call-related fields to track call status, duration, and outcomes
- **RESTful API endpoints**: Clean API for initiating calls, updating status, and monitoring progress

### Frontend
- **Call Now Button**: Added to patient lists to initiate calls
- **Call Status Banner**: Shows real-time call progress in conversation screens
- **Polling-based updates**: 2-second intervals for status updates, 1-second for duration timer

## Backend Changes

### 1. Conversation Model Updates
Added new fields to `src/models/conversation.model.js`:
```javascript
callStatus: 'initiating' | 'ringing' | 'answered' | 'connected' | 'ended' | 'failed' | 'busy' | 'no_answer'
callStartTime: Date
callEndTime: Date
callDuration: Number
callOutcome: 'answered' | 'no_answer' | 'busy' | 'failed' | 'voicemail'
agentId: ObjectId (required)
callNotes: String
```

### 2. New API Endpoints
- `POST /api/v1/calls/initiate` - Start a call to a patient
- `GET /api/v1/calls/:conversationId/status` - Get current call status
- `POST /api/v1/calls/:conversationId/status` - Update call status
- `POST /api/v1/calls/:conversationId/end` - End a call
- `GET /api/v1/calls/active` - Get active calls for current agent
- `GET /api/v1/calls/:conversationId/conversation` - Get conversation with call details

### 3. Controller Implementation
The controller handles:
- Patient and agent validation
- Conversation creation
- Twilio call initiation
- Status updates and error handling

## Frontend Implementation

### 1. Call Now Button
```tsx
<CallNowButton 
  patientId="patient-123"
  patientName="John Doe"
  className="mb-2"
/>
```

**Features:**
- Shows loading state while calling
- Handles errors gracefully
- Redirects to conversation screen on success
- Uses testIDs for E2E testing

### 2. Call Status Banner
```tsx
<CallStatusBanner
  conversationId="conv-123"
  initialStatus="ringing"
  patientName="John Doe"
  onStatusChange={(status) => console.log('Status:', status)}
/>
```

**Features:**
- Real-time status updates via polling
- Duration timer for active calls
- End call button for connected calls
- Color-coded status badges
- Responsive design

### 3. API Integration
```typescript
// Initiate call
const response = await initiateCall({
  patientId: 'patient-123',
  callNotes: 'Manual check-in call'
});

// Get status updates
const status = await getCallStatus('conv-123');

// End call
await endCall('conv-123', 'answered', 'Call went well');
```

## Usage Flow

### 1. Agent Initiates Call
1. Agent sees "Call Now" button on patient list
2. Clicks button → API call to `/calls/initiate`
3. Backend creates conversation and initiates Twilio call
4. Frontend redirects to conversation screen

### 2. Call Progress Monitoring
1. Conversation screen shows call status banner
2. Banner polls for updates every 2 seconds
3. Status changes: initiating → ringing → answered → connected
4. Duration timer updates every second during active calls

### 3. Call Completion
1. Agent can manually end call with "End Call" button
2. Or call ends automatically (patient hangs up, etc.)
3. Final status and duration recorded
4. Conversation marked as completed

## Testing

### Backend Tests
- **Integration tests**: `tests/integration/callWorkflow.integration.test.js`
- **API endpoint testing**: All CRUD operations
- **Error handling**: Invalid data, missing resources
- **Authentication**: Token validation

### Frontend Tests
- **Component tests**: `frontend-components/__tests__/CallNowButton.test.tsx`
- **User interaction**: Button clicks, loading states
- **Error handling**: API failures, validation errors
- **Navigation**: Route changes on success

## Configuration

### Environment Variables
No new environment variables required. Uses existing Twilio configuration.

### Polling Intervals
- **Status updates**: 2 seconds (configurable in `CallStatusBanner`)
- **Duration timer**: 1 second (for active calls only)

## Security

- **Authentication required**: All endpoints require valid JWT token
- **Agent validation**: Only authenticated agents can initiate calls
- **Patient ownership**: Agents can only call patients in their organization
- **Input validation**: Joi schemas validate all request data

## Performance Considerations

- **Polling optimization**: Stops polling when call ends
- **Database queries**: Efficient population of patient/agent data
- **Error handling**: Graceful degradation on API failures
- **Memory management**: Cleanup of intervals and state

## Future Enhancements

1. **WebSocket support**: Replace polling with real-time updates
2. **Call recording**: Integrate with existing recording system
3. **Call analytics**: Track call success rates, duration patterns
4. **Bulk calling**: Initiate multiple calls simultaneously
5. **Call scheduling**: Schedule calls for later execution

## Troubleshooting

### Common Issues

1. **Call not initiating**
   - Check Twilio credentials and configuration
   - Verify patient has valid phone number
   - Check agent authentication

2. **Status not updating**
   - Verify polling is active (check browser console)
   - Check conversation ID in URL
   - Verify backend status endpoint is working

3. **Navigation issues**
   - Check route configuration
   - Verify conversation ID format
   - Check browser console for errors

### Debug Mode
Enable debug logging in backend:
```javascript
logger.info('[CallWorkflow] Debug info:', { conversationId, status });
```

## Integration Points

- **Twilio**: Call initiation and status webhooks
- **Asterisk**: SIP connection and call handling
- **Existing conversation system**: Message storage and retrieval
- **Patient management**: Patient data and phone numbers
- **Agent authentication**: JWT token validation

## Deployment

1. **Backend**: Deploy updated models, controllers, and routes
2. **Database**: Run any necessary migrations for new fields
3. **Frontend**: Deploy new components and API integration
4. **Testing**: Verify all endpoints work in staging environment
5. **Production**: Deploy to production and monitor for issues
