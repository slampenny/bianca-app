# Database Migrations

This directory contains database migrations managed by `migrate-mongo`.

## Quick Start

### Check Migration Status

```bash
yarn migrate:status
```

### Run All Pending Migrations

```bash
yarn migrate:up
```

### Rollback Last Migration

```bash
yarn migrate:down
```

### Create a New Migration

```bash
yarn migrate:create migration-name
```

This will create a new migration file with `up` and `down` functions.

## Migration Files

Migration files follow the naming pattern: `YYYYMMDD-HHMMSS-migration-name.js`

Each migration file exports an object with:
- `up(db, client)` - Function to apply the migration
- `down(db, client)` - Function to rollback the migration

## Example Migration

```javascript
module.exports = {
  async up(db, client) {
    // Your migration logic here
    // db is the native MongoDB driver database instance
    // client is the MongoDB client
  },
  
  async down(db, client) {
    // Your rollback logic here
  }
};
```

## Using Mongoose Models

While `migrate-mongo` provides the native MongoDB driver (`db` and `client`), you can also use Mongoose models in your migrations:

```javascript
const { Patient, Org } = require('../src/models');

module.exports = {
  async up(db, client) {
    // Use Mongoose models
    const patients = await Patient.find({ org: null });
    // ... migration logic
  },
  
  async down(db, client) {
    // Rollback logic
  }
};
```

**Note:** The connection is already established by `migrate-mongo`, so Mongoose models will work as long as they're using the same connection URL.

## Configuration

Migration configuration is in `migrate-mongo-config.js` at the root of the backend package.

## Environment Variables

Migrations use the `MONGODB_URL` environment variable. Make sure it's set:

```bash
# Development
MONGODB_URL=mongodb://localhost:27017/bianca-app yarn migrate:up

# Staging
NODE_ENV=staging MONGODB_URL=<staging-url> yarn migrate:up

# Production
NODE_ENV=production MONGODB_URL=<production-url> yarn migrate:up
```

## Migration History

Migration history is stored in the `migrations` collection in your MongoDB database. This tracks which migrations have been run.

## Best Practices

1. **Always test migrations** in development/staging before production
2. **Write rollback logic** in the `down` function
3. **Make migrations idempotent** - safe to run multiple times
4. **Use transactions** when possible for data integrity
5. **Document complex migrations** with comments
6. **Review migrations** before running in production

## Troubleshooting

### Migration fails partway through

If a migration fails, you can:
1. Fix the issue in the migration file
2. Manually update the `migrations` collection to remove the failed entry
3. Re-run the migration

### Check what migrations have run

```bash
yarn migrate:status
```

### List all migrations

```bash
yarn migrate:list
```

## Related Documentation

- [migrate-mongo documentation](https://github.com/seppevs/migrate-mongo)
- [Migration README for Patient Org](./README-PATIENT-ORG-MIGRATION.md)

