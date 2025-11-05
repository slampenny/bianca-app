# Test Routes Cleanup Plan

## Summary

The `test.route.js` file has **97 routes** total, with **56 audio/diagnostic routes** that can be removed now that audio works well.

## Routes to Keep (41 routes)

### Basic Utilities (3)
- `/summarize` - Test conversation summarization
- `/seed` - Seed database for testing
- `/clean` - Clean test data

### Feature Testing Routes to Keep
- **Sentiment Analysis** (6 routes): Lines 9684-10006
- **Medical Analysis** (6 routes): Lines 10482-10790
- **Emergency** (1 route): Line 11053
- **Billing** (1 route): Line 11222
- **Push Notifications** (1 route): Line 10893

### Other Routes to Evaluate
- `/conversations` - Get conversations
- `/call` - Test call initiation
- `/create-caregiver` - Create test caregiver
- `/diagnose` - System diagnosis
- `/config-check` - Configuration check
- `/service-status` - Service status
- `/mongodb-connection` - MongoDB connection test
- `/routes-summary` - Summary of all routes
- `/debug-sentiment-analysis` - Debug sentiment
- `/debug-conversation-data` - Debug conversation data

## Routes to Remove (56+ routes)

### Audio Diagnostic Routes (Duplicate sets)
These appear twice in the file:

**First set (lines ~7344-7714):**
- `/audio/calls`
- `/audio/diagnose/:channelId`
- `/audio/diagnose-latest`
- `/audio/listeners`
- `/audio/senders`
- `/audio/openai`
- `/audio/status`
- `/test-openai-audio-acceptance` (duplicate)
- `/standalone-audio-diagnostic` (duplicate)
- `/openai-audio-generation-diagnostic` (duplicate)
- `/send-text-to-openai`

**Second set (lines ~8150-8520):**
- Same routes duplicated (remove entire second set)

### Single Audio/Diagnostic Routes
- `/websocket` - OpenAI WebSocket test
- `/network-info` - Network information
- `/rtp-sender-all` - RTP sender list
- `/complete-audio-diagnostic/:callId`
- `/force-audio-test/:callId`
- `/trigger-openai-response/:callId`
- `/openai-test` - OpenAI API test
- `/ari-test` - Asterisk ARI test
- `/rtp-test` - RTP test
- `/audio-pipeline-test` - Audio pipeline test
- `/openai-connections` - List OpenAI connections
- `/openai-websocket-diagnostic`
- `/ari-connectivity` - ARI connectivity test
- `/audio-pipeline-debug`
- `/compare-audio-stages`
- `/download-debug-audio`
- `/force-audio-commit`
- `/audio-conversion-test`
- `/rtp-packet-analysis`
- `/test-audio-chain`
- `/simulate-audio-to-openai`
- `/network-connectivity`
- `/asterisk-connectivity`
- `/ari-call-simulation`
- `/rtp-audio-flow`
- `/monitor-rtp-destination`
- `/rtp-endpoint-diagnostic`
- `/udp-transmission-diagnostic`
- `/openai-audio-debug`
- `/audio-data-diagnostic`
- `/test-audio-validation`
- `/diagnose-buffer-too-small`
- `/analyze-audio-data`
- `/diagnose-openai-response-generation`
- `/force-openai-response`
- `/diagnose-speech-detection`
- `/fix-rtp-sender/:callId`
- `/audio-pipeline-diagnostic/:callId`

## Cleanup Strategy

Since the file is large (11,302 lines), we should:

1. **Remove duplicate routes first** (second set of `/audio/*` routes, lines ~8150-8600)
2. **Remove single audio/diagnostic routes** in batches
3. **Keep feature testing routes** (sentiment, medical, emergency, billing)
4. **Test after cleanup** to ensure routes still work

## Estimated Impact

- **Before**: 11,302 lines, 97 routes
- **After**: ~4,000-5,000 lines, 41 routes
- **Removed**: ~6,000 lines, 56 routes

This will significantly reduce file size and maintenance burden.



