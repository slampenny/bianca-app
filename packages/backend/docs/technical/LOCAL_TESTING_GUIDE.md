# Local Testing Guide for OpenAI Realtime API (Beta/GA Migration)

This guide explains how to test the OpenAI Realtime API locally without deploying to staging or making real phone calls.

## Quick Start

### Option 1: Command Line Script (Easiest)

```bash
cd packages/backend

# Test with current config (Beta or GA based on OPENAI_REALTIME_USE_GA)
node scripts/test-openai-realtime-local.js

# Test with Beta API explicitly
OPENAI_REALTIME_USE_GA=false node scripts/test-openai-realtime-local.js

# Test with GA API explicitly
OPENAI_REALTIME_USE_GA=true node scripts/test-openai-realtime-local.js

# Test with specific transcription model
OPENAI_REALTIME_TRANSCRIPTION_MODEL=gpt-4o-transcribe \
  OPENAI_REALTIME_USE_GA=true \
  node scripts/test-openai-realtime-local.js
```

### Option 2: HTTP Endpoint (If Backend is Running)

If your backend is running locally (`yarn dev`), you can test via HTTP:

```bash
# Get auth token first (login via API or use existing token)
TOKEN="your-jwt-token"

# Test with current config
curl -X POST http://localhost:3000/v1/test/openai-connection \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Test with GA API explicitly
curl -X POST http://localhost:3000/v1/test/openai-connection \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"useGA": true}'

# Test with Beta API explicitly
curl -X POST http://localhost:3000/v1/test/openai-connection \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"useGA": false}'
```

## What Gets Tested

The test verifies:
1. ✅ WebSocket connection to OpenAI Realtime API
2. ✅ Session creation (`session.created` event)
3. ✅ Session configuration (`session.update` message)
4. ✅ Session update confirmation (`session.updated` event)
5. ✅ Correct API version (Beta vs GA) based on headers
6. ✅ Correct session format (Beta vs GA structure)

## Expected Output

### Successful Test (Beta)
```
🧪 OpenAI Realtime API Connection Test (Local)

============================================================

📋 Configuration:
   API Version: Beta (useGA: false)
   Model: gpt-4o-realtime-preview-2025-01-12 (auto-selected for Beta)
   Transcription Model: gpt-4o-mini-transcribe
   Voice: alloy
   API Key: ✅ Set

🔌 Testing Connection...

   Test ID: local-test-1766339284123
   Connecting to OpenAI Realtime API (Beta)...

✅ Connection Test SUCCESSFUL!

============================================================

📊 Results:
   Status: success
   Session ID: sess_abc123...
   API Version: Beta
   Messages Received: 2

📝 Session Details:
   Model: gpt-4o-realtime-preview-2025-01-12
   Voice: alloy
   Input Audio Format: g711_ulaw
   Output Audio Format: g711_ulaw
   Transcription Model: gpt-4o-mini-transcribe

📨 Received Messages:
   1. session.created (2025-12-21T...)
   2. session.updated (2025-12-21T...)

============================================================

✅ Test completed successfully!
✅ Beta format confirmed - input_audio_format present
```

### Successful Test (GA)
```
🧪 OpenAI Realtime API Connection Test (Local)

============================================================

📋 Configuration:
   API Version: GA (useGA: true)
   Model: gpt-realtime (auto-selected for GA)
   Transcription Model: gpt-4o-mini-transcribe
   Voice: alloy
   API Key: ✅ Set

🔌 Testing Connection...

   Test ID: local-test-1766339284567
   Connecting to OpenAI Realtime API (GA)...

✅ Connection Test SUCCESSFUL!

============================================================

📊 Results:
   Status: success
   Session ID: sess_xyz789...
   API Version: GA
   Messages Received: 2

📝 Session Details:
   Model: gpt-4o-realtime-preview-2025-01-12
   Voice: alloy
   Audio Input Format: g711_ulaw
   Audio Output Format: g711_ulaw
   Transcription Model: gpt-4o-mini-transcribe

📨 Received Messages:
   1. session.created (2025-12-21T...)
   2. session.updated (2025-12-21T...)

============================================================

✅ Test completed successfully!
✅ GA format confirmed - session.audio structure present
```

## Environment Variables

Set these in your `.env` file or export them:

```bash
# Required
OPENAI_API_KEY=sk-...

# Optional - Controls which API version to use
OPENAI_REALTIME_USE_GA=false  # false = Beta, true = GA

# Optional - Transcription model
OPENAI_REALTIME_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe  # or gpt-4o-transcribe or whisper-1

# Optional - Model and voice
# Note: Model is auto-selected based on OPENAI_REALTIME_USE_GA:
#   - Beta: gpt-4o-realtime-preview-2025-01-12
#   - GA: gpt-realtime
# You can override via OPENAI_REALTIME_MODEL if needed
OPENAI_REALTIME_VOICE=alloy

# Optional - Sentiment analysis uses a chat-completions model (default: gpt-4o)
# Set if OPENAI_MODEL is a realtime-only model and sentiment fails with 404
OPENAI_SENTIMENT_MODEL=gpt-4o
```

### Testing sentiment analysis locally

Sentiment analysis runs when a call is finalized and can be tested without a real call:

```bash
# From repo root
yarn workspace @bianca-app/backend test:sentiment:local

# Or from packages/backend (with .env present)
node scripts/test-sentiment-local.js
```

Requires `OPENAI_API_KEY` in `.env`. The script analyzes sample conversation text by default. To test with a real conversation ID (MongoDB must be running):

```bash
MONGODB_URL=mongodb://localhost:27017/bianca-app node scripts/test-sentiment-local.js <conversationId>
```

If sentiment fails in staging with a 404 model error, set `OPENAI_SENTIMENT_MODEL=gpt-4o` in Secrets Manager (or env) so sentiment uses a valid chat-completions model.

## Troubleshooting

### Error: OPENAI_API_KEY is not set
**Solution:** Set your OpenAI API key in `.env` file:
```bash
echo "OPENAI_API_KEY=sk-your-key-here" >> packages/backend/.env
```

### Error: Connection timeout
**Possible causes:**
- Network connectivity issues
- OpenAI API is down
- API key doesn't have Realtime API access

**Solution:**
1. Check internet connection
2. Verify API key is valid
3. Check OpenAI status page

### Error: Invalid model
**Solution:** Verify the model name is correct:
```bash
# Check current model
grep OPENAI_REALTIME_MODEL packages/backend/.env

# Try with explicit model
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview-2025-01-12 node scripts/test-openai-realtime-local.js
```

### Error: Session structure mismatch
**If using GA but getting Beta format:**
- Check that `OPENAI_REALTIME_USE_GA=true` is set
- Verify the model supports GA API
- Check logs for which format was sent

**If using Beta but getting GA format:**
- This shouldn't happen, but check OpenAI API documentation
- Verify model version supports Beta API

## Comparing Beta vs GA

To compare both versions side-by-side:

```bash
# Test Beta
echo "=== Testing BETA ==="
OPENAI_REALTIME_USE_GA=false node scripts/test-openai-realtime-local.js

# Test GA
echo "=== Testing GA ==="
OPENAI_REALTIME_USE_GA=true node scripts/test-openai-realtime-local.js
```

## What to Look For

### ✅ Success Indicators
- Connection established
- `session.created` event received
- `session.updated` event received
- Session structure matches expected format (Beta or GA)
- No errors in logs

### ⚠️ Warning Signs
- Connection timeout
- Missing events
- Unexpected session structure
- API version mismatch in logs

### ❌ Failure Indicators
- Connection refused
- Authentication errors
- Invalid model errors
- Session creation failures

## Next Steps After Local Testing

Once local testing passes:
1. Test in staging environment
2. Monitor logs for any differences
3. Gradually roll out to production using feature flag

## Production: pipeline green but “no OpenAI”

CI (CodeBuild) and production EC2 are **different environments**:

| Check | Why it matters |
|--------|----------------|
| **`GET /health`** → `services.openai.apiKeyConfigured` | Confirms the process has a non-empty `OPENAI_API_KEY` (does **not** prove the key is valid). |
| **Deploy actually rolled** | CodeBuild tests run a fresh image; production must **pull the new image** (CodeDeploy / compose) or it may still run an older build without Realtime fixes. |
| **`POST /v1/test/openai-connection`** (with JWT) on prod API | End-to-end Realtime handshake; if this fails, check CloudWatch for `[OpenAI Realtime]` and `invalid_api_key` / `session.update` errors. |
| **Phone path ≠ test endpoint** | Live calls go **Twilio → Asterisk → ARI → OpenAI**. ARI not connected or SIP issues can look like “no AI” even when the test route works. |

## Related Documentation

- [Migration Plan](../technical/OPENAI_REALTIME_BETA_TO_GA_MIGRATION.md)
- [Event Documentation](../technical/OPENAI_REALTIME_EVENT_DOCUMENTATION.md)

