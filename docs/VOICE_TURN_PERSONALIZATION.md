# Voice turn personalization (per-resident VAD silence)

Bianca adapts how long she waits after a resident stops speaking before responding. Settings are **per client** (persisted on `Client.voiceTurnProfile`) with **environment-level defaults** for new residents.

This document covers deployment configuration, staging validation, and operations.

## How config reaches the backend

Bianca runs on **EC2 + Docker Compose** deployed via **AWS CodeDeploy** (not ECS task definitions).

| Layer | Role |
|-------|------|
| **CodeDeploy `before_install.sh`** | Primary path: writes `docker-compose.yml` on the instance with `AUDIO_TURN_*` env vars on the `app` service |
| **Docker Compose** | Sets container `environment:` before Node starts |
| **AWS Secrets Manager** | `MySecretsManagerSecret` (production) / `MySecretsManagerSecret-Staging` (staging). Loaded at startup via `config.loadSecrets()`. Optional override for any `AUDIO_TURN_*` key in the JSON secret |
| **Application defaults** | Used when env vars are unset (`packages/backend/src/config/audioTurn.config.js`) |

Secrets Manager keys are **optional** for voice-turn vars (they are not secrets). Prefer docker-compose / CodeDeploy for defaults; add keys to the secret JSON only when you need to change values without redeploying.

## Environment variables

| Variable | Description |
|----------|-------------|
| `AUDIO_TURN_PERSONALIZATION_ENABLED` | `true` (default) / `false` — disable to use legacy global silence only |
| `AUDIO_TURN_DEFAULT_SILENCE_DURATION_MS` | Initial silence for new residents (ms) |
| `AUDIO_TURN_MIN_SILENCE_DURATION_MS` | Floor for adaptive tuning (ms) |
| `AUDIO_TURN_MAX_SILENCE_DURATION_MS` | Ceiling for adaptive tuning (ms) |
| `AUDIO_TURN_INTERRUPTION_BUMP_MS` | Increase when Bianca interrupts mid-utterance (ms) |
| `AUDIO_TURN_SUCCESS_DECAY_MS` | Decrease after clean turns / clean calls (ms) |
| `AUDIO_TURN_SUCCESS_DECAY_MIN_TURNS` | Clean turns before in-call decay |
| `AUDIO_TURN_SUCCESS_DECAY_MIN_CALLS` | Prior observed calls before in-call decay |
| `AUDIO_TURN_PROFILE_ALPHA` | Smoothing factor for persisted updates (0–1) |
| `AUDIO_TURN_DETECTION_SILENCE_DURATION_MS` | **Legacy** global silence when personalization is disabled (default 500) |

## Recommended values

### Staging / demo (wired in CodeDeploy + `docker-compose.staging.yml`)

```
AUDIO_TURN_PERSONALIZATION_ENABLED=true
AUDIO_TURN_DEFAULT_SILENCE_DURATION_MS=300
AUDIO_TURN_MIN_SILENCE_DURATION_MS=225
AUDIO_TURN_MAX_SILENCE_DURATION_MS=2000
AUDIO_TURN_INTERRUPTION_BUMP_MS=250
AUDIO_TURN_SUCCESS_DECAY_MS=50
AUDIO_TURN_SUCCESS_DECAY_MIN_TURNS=6
AUDIO_TURN_SUCCESS_DECAY_MIN_CALLS=1
AUDIO_TURN_PROFILE_ALPHA=0.35
```

### Production (elderly residents — wired in CodeDeploy for `production`)

```
AUDIO_TURN_PERSONALIZATION_ENABLED=true
AUDIO_TURN_DEFAULT_SILENCE_DURATION_MS=450
AUDIO_TURN_MIN_SILENCE_DURATION_MS=300
AUDIO_TURN_MAX_SILENCE_DURATION_MS=2500
AUDIO_TURN_INTERRUPTION_BUMP_MS=300
AUDIO_TURN_SUCCESS_DECAY_MS=25
AUDIO_TURN_SUCCESS_DECAY_MIN_TURNS=6
AUDIO_TURN_SUCCESS_DECAY_MIN_CALLS=1
AUDIO_TURN_PROFILE_ALPHA=0.25
```

Adjust via Secrets Manager JSON or a follow-up deploy if field testing suggests different values.

## Startup verification

After deploy, check CloudWatch log group `{staging|production}/app` for:

```
[VoiceTurn] personalization enabled=true default=300 min=225 max=2000 bump=250 decay=50 alpha=0.35 legacySilenceMs=500
```

During a call:

```
[VoiceTurn] call started with vadSilenceDurationMs=300 clientId=... source=default personalization=true
[VoiceTurn] vad update 300→550 reason=interruption_bump callId=...
[VoiceTurn] persisted vadSilenceDurationMs=... clientId=...
```

## Staging test runbook

1. Deploy to staging (CodeDeploy pipeline).
2. Confirm startup log line above in `staging/app` CloudWatch logs.
3. Place a test outbound call to a staging resident with no prior profile.
4. Confirm first call log: `vadSilenceDurationMs=300` (or your staging default).
5. Speak with long pauses — Bianca should wait before responding.
6. If Bianca cuts you off, confirm bump logs and higher silence on next turn.
7. Complete a multi-turn call; confirm `persisted vadSilenceDurationMs` at hangup.
8. Second call to same resident — confirm `source=adaptive` and persisted ms in call-start log.

## Reset a resident profile

From backend (shell / script on staging):

```javascript
const { resetClientVoiceTurnProfile } = require('./services/voiceTurnProfile.service');
await resetClientVoiceTurnProfile('<clientId>');
```

Or MongoDB:

```javascript
db.clients.updateOne(
  { _id: ObjectId('...') },
  { $unset: { voiceTurnProfile: '' } }
);
```

## Manually pin wait time (`source: manual`)

Adaptive updates will **not** change `vadSilenceDurationMs` but stats still accumulate:

```javascript
db.clients.updateOne(
  { _id: ObjectId('...') },
  {
    $set: {
      'voiceTurnProfile.vadSilenceDurationMs': 800,
      'voiceTurnProfile.source': 'manual',
      'voiceTurnProfile.minSilenceDurationMs': 300,
      'voiceTurnProfile.maxSilenceDurationMs': 2500,
      'voiceTurnProfile.lastUpdatedAt': new Date(),
    },
  }
);
```

## Rollback

**Fast (no redeploy):** Add to Secrets Manager JSON (staging or production secret):

```json
"AUDIO_TURN_PERSONALIZATION_ENABLED": "false"
```

Restart the app container (`docker compose restart app` on the instance) or redeploy.

**Legacy behavior:** Uses `AUDIO_TURN_DETECTION_SILENCE_DURATION_MS` (default 500ms) globally; per-resident profiles are ignored for initial silence while disabled.

**Full revert:** Remove `AUDIO_TURN_*` lines from `before_install.sh` docker-compose template and redeploy (optional; disabling is usually enough).

## Privacy

Only timing statistics are stored on `Client.voiceTurnProfile`. No audio or transcripts are saved for this feature.

## Related code

- Config: `packages/backend/src/config/audioTurn.config.js`
- Logic: `packages/backend/src/utils/voiceTurnProfile.util.js`
- Service: `packages/backend/src/services/voiceTurnProfile.service.js`
- Realtime wiring: `packages/backend/src/services/openai.realtime.service.js`
- Deploy injection: `packages/backend/devops/codedeploy/scripts/before_install.sh`
