# Seeding Production Database

## Overview

After deploying to production, you need to seed the database with all required data. This includes:

- Emergency phrases (all languages)
- Organizations
- Caregivers
- Patients
- Conversations and messages
- Schedules
- Alerts
- Payment methods
- Invoices
- Sentiment analysis data

⚠️ **WARNING**: The seed script will **DELETE ALL EXISTING DATA** and replace it with seed data. Only run this if:
- No one is currently using the system, OR
- You're okay with losing all existing data

## Quick Start

### Option 1: Run via SSH (Recommended)

```bash
# SSH into production instance
ssh -i your-key.pem ec2-user@<production-ip>

# Navigate to deployment directory
cd /opt/bianca-production

# Run the seed script
docker exec -i production_app node /usr/src/bianca-app/src/scripts/seedDatabase.js
```

### Option 2: Use the Production Script

From your local machine, you can use the provided script:

```bash
# Make sure you have SSH access configured
./run-full-seed-production.sh
```

Or if you want to run it directly on the production instance:

```bash
# SSH into production
ssh -i your-key.pem ec2-user@<production-ip>
cd /opt/bianca-production

# Run the script
./run-full-seed-production.sh
```

### Option 3: Use the Existing Seed Script

The existing `run-seed-script.sh` can also be used:

```bash
./run-seed-script.sh
```

This will automatically find production and staging instances and run the seed on both.

## What Gets Seeded

The seed script will create:

1. **Emergency Phrases** - Detection patterns for all supported languages:
   - en, es, fr, de, zh, ja, pt, it, ru, ar, hi, zh-cn
   - Includes CRITICAL, HIGH, and MEDIUM severity phrases

2. **Test Organizations** - Sample organization data

3. **Test Caregivers** - Including:
   - `fake@example.org` - Main test caregiver
   - `admin@example.org` - Admin user

4. **Test Patients** - Multiple patients with different scenarios:
   - Patient 1 - For declining health patterns
   - Patient 2 - Normal patient
   - Patient 3 (Margaret Thompson) - For fraud/abuse testing

5. **Conversations** - Sample conversations including:
   - Normal conversations
   - Declining patient conversations
   - Fraud/abuse pattern conversations
   - Recent conversations

6. **Schedules** - Sample call schedules

7. **Alerts** - Various alert types

8. **Payment Methods** - Test payment methods (Stripe test cards)

9. **Invoices** - Sample invoices

10. **Sentiment Analysis** - Sentiment data for conversations

11. **Medical Analysis** - Triggers medical analysis jobs for seeded patients

## Verification

After seeding, verify the data was created:

```bash
# Check emergency phrases
docker exec -it production_mongodb mongosh bianca-service --eval "db.emergencyphrases.countDocuments()"

# Check organizations
docker exec -it production_mongodb mongosh bianca-service --eval "db.orgs.countDocuments()"

# Check caregivers
docker exec -it production_mongodb mongosh bianca-service --eval "db.caregivers.countDocuments()"

# Check patients
docker exec -it production_mongodb mongosh bianca-service --eval "db.patients.countDocuments()"

# Check conversations
docker exec -it production_mongodb mongosh bianca-service --eval "db.conversations.countDocuments()"
```

## Troubleshooting

### Container Not Found

If you get "container not found" errors:

```bash
# List running containers
docker ps

# Find the app container name
docker ps --filter "name=app" --format "{{.Names}}"

# Use the correct container name
docker exec -i <container-name> node /usr/src/bianca-app/src/scripts/seedDatabase.js
```

### Database Connection Issues

If you get MongoDB connection errors:

```bash
# Check if MongoDB container is running
docker ps --filter "name=mongodb"

# Check MongoDB logs
docker logs production_mongodb

# Verify MongoDB is accessible from app container
docker exec -it production_app ping -c 2 mongodb
```

### Seed Script Errors

If the seed script fails:

1. Check the error message in the output
2. Verify all required environment variables are set
3. Check application logs:
   ```bash
   docker logs production_app --tail 100
   ```
4. Verify database connectivity:
   ```bash
   docker exec -it production_app node -e "const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URL || 'mongodb://mongodb:27017/bianca-service').then(() => console.log('Connected')).catch(e => console.error(e))"
   ```

## After Seeding

Once seeding is complete:

1. ✅ Verify all collections have data
2. ✅ Test emergency detection with a test call
3. ✅ Verify caregivers can log in
4. ✅ Check that conversations and alerts are visible
5. ✅ Test payment methods if applicable

## Related Files

- `src/scripts/seedDatabase.js` - Main seed script
- `src/scripts/seeders/*.seeder.js` - Individual seeder modules
- `run-full-seed-production.sh` - Production seed script
- `run-seed-script.sh` - SSH-based seed script for multiple environments
