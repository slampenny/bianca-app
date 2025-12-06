# Localization Strings Guide

## Overview

Localization strings in the Bianca application are stored in **two different places**:

1. **Static JSON files** - For email templates and UI strings
2. **Database (EmergencyPhrase model)** - For emergency detection phrases

## 1. Static JSON Files (Email Templates & UI)

### Location
- `/locales/en.json` - English
- `/locales/es.json` - Spanish
- `/src/locales/*.json` - Additional language files

### What They Contain
- Email templates (invite, password reset, verification)
- UI strings
- Static text content

### How They're Used
These files are loaded at application startup and don't require database seeding. They're part of the codebase and are deployed with the application.

### Languages Supported
- English (en)
- Spanish (es)
- French (fr)
- German (de)
- Chinese (zh)
- Japanese (ja)
- Portuguese (pt)
- Italian (it)
- Russian (ru)
- Arabic (ar)
- Hindi (hi)
- Korean (ko)

## 2. Database-Stored Emergency Phrases

### Location
- **Model**: `EmergencyPhrase` (MongoDB collection)
- **Seeder**: `src/scripts/seeders/emergencyPhrases.seeder.js`

### What They Contain
Emergency detection patterns for multiple languages:
- Medical emergencies (heart attack, stroke, seizure, etc.)
- Safety emergencies (suicide threats)
- Physical emergencies (falls, can't get up)
- Request patterns (call 911, need help)

### Languages Supported
- en, es, fr, de, zh, ja, pt, it, ru, ar, hi, zh-cn

### How They're Used
The `LocalizedEmergencyDetector` service loads these phrases from the database on initialization. If phrases aren't seeded, the emergency detector will fall back to basic detection.

## Seeding Emergency Phrases

### Why Re-seed After Deployment?

After deploying to production, you need to ensure the database has all emergency phrases for all supported languages. The seeder is designed to skip if phrases already exist, but you can force a re-seed.

### Option 1: Seed Emergency Phrases Only (Recommended for Production)

This only seeds emergency phrases without affecting other data:

```bash
# On production instance via SSH
ssh -i your-key.pem ec2-user@<production-ip>
cd /opt/bianca-production
docker exec -i production_app node /usr/src/bianca-app/src/scripts/seedEmergencyPhrasesOnly.js
```

Or use the provided script:

```bash
# From your local machine
./run-seed-emergency-phrases-production.sh
```

### Option 2: Full Database Seed (Development/Testing Only)

⚠️ **WARNING**: This clears ALL data and re-seeds everything. Only use in development or staging!

```bash
# On production instance
docker exec -i production_app node /usr/src/bianca-app/src/scripts/seedDatabase.js
```

### Option 3: Force Re-seed Emergency Phrases

If you need to update existing phrases, you can delete them first:

```bash
# Connect to MongoDB on production
docker exec -it production_mongodb mongosh

# Delete existing phrases
use bianca-service
db.emergencyphrases.deleteMany({})

# Exit MongoDB
exit

# Then run the seeder
docker exec -i production_app node /usr/src/bianca-app/src/scripts/seedEmergencyPhrasesOnly.js
```

## Verification

After seeding, verify the phrases were loaded:

```bash
# Check phrase count
docker exec -it production_mongodb mongosh bianca-service --eval "db.emergencyphrases.countDocuments()"

# Check by language
docker exec -it production_mongodb mongosh bianca-service --eval "db.emergencyphrases.aggregate([{$group: {_id: '\$language', count: {$sum: 1}}}, {$sort: {_id: 1}}])"

# Check by severity
docker exec -it production_mongodb mongosh bianca-service --eval "db.emergencyphrases.aggregate([{$group: {_id: '\$severity', count: {$sum: 1}}}, {$sort: {_id: 1}}])"
```

## Scripts Available

1. **`src/scripts/seedEmergencyPhrasesOnly.js`**
   - Standalone script to seed only emergency phrases
   - Deletes existing phrases and re-seeds
   - Safe to run on production

2. **`run-seed-emergency-phrases.sh`**
   - Local script to run the seeder
   - For development/testing

3. **`run-seed-emergency-phrases-production.sh`**
   - Production script that detects Docker container
   - Can run on host or inside container

## After Deployment Checklist

✅ **After pushing to production:**

1. Verify deployment completed successfully
2. Run emergency phrases seeder:
   ```bash
   ssh -i your-key.pem ec2-user@<production-ip>
   cd /opt/bianca-production
   docker exec -i production_app node /usr/src/bianca-app/src/scripts/seedEmergencyPhrasesOnly.js
   ```
3. Verify phrases were seeded (check logs or MongoDB)
4. Test emergency detection with a test call

## Troubleshooting

### Phrases Not Loading

1. **Check if phrases exist in database:**
   ```bash
   docker exec -it production_mongodb mongosh bianca-service --eval "db.emergencyphrases.countDocuments()"
   ```

2. **Check application logs:**
   ```bash
   docker logs production_app | grep -i "emergency\|localized"
   ```

3. **Manually reload phrases:**
   The `LocalizedEmergencyDetector` loads phrases on initialization. Restart the app container to reload:
   ```bash
   docker restart production_app
   ```

### Seeder Skipping

The seeder skips if phrases already exist. To force re-seed:
1. Delete existing phrases (see Option 3 above)
2. Run the seeder again

## Related Files

- `src/models/emergencyPhrase.model.js` - EmergencyPhrase model
- `src/services/localizedEmergencyDetector.service.js` - Service that uses the phrases
- `src/scripts/seeders/emergencyPhrases.seeder.js` - Seeder implementation
- `locales/*.json` - Static localization files
