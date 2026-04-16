/**
 * Load superAdmin email/password from AWS Secrets Manager and create or update the caregiver in MongoDB.
 *
 * Secret (default name: bianca-production-superadmin-bootstrap) must be JSON:
 *   { "email": "...", "password": "..." }
 *
 * Run on production (app container has MONGODB_URL + IAM for Secrets Manager), e.g.:
 *   docker compose exec app node src/scripts/bootstrapSuperAdminFromSecret.js
 *
 * Production/staging also run this automatically on API startup unless
 * SYNC_SUPERADMIN_FROM_SECRET_ON_START=false — see superadminBootstrap.service.js
 *
 * Optional env:
 *   SUPERADMIN_SECRET_ID, AWS_REGION
 *   BOOTSTRAP_ORG_ID — attach new users to this org (default: first org by _id)
 *   BOOTSTRAP_SUPERADMIN_NAME — display name when creating a new caregiver (default: Bianca Super Admin)
 *   BOOTSTRAP_CREATE_ORG_IF_MISSING — if "0", do not auto-create an org when the DB has none (default: create)
 *   BOOTSTRAP_ORG_NAME / BOOTSTRAP_ORG_EMAIL — when auto-creating the first org
 */
/* eslint-disable no-console */
const mongoose = require('mongoose');
const { syncSuperAdminFromAwsSecret } = require('../services/superadminBootstrap.service');

async function main() {
  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) {
    console.error('Missing MONGODB_URL');
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);
  const { email, action } = await syncSuperAdminFromAwsSecret();
  console.log(`Done. ${action} superAdmin for ${email}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
