/**
 * Load superAdmin email/password from AWS Secrets Manager and create or update the caregiver in MongoDB.
 *
 * Secret (default name: bianca-production-superadmin-bootstrap) must be JSON:
 *   { "email": "...", "password": "..." }
 *
 * Run once on production (app container has MONGODB_URL + IAM for Secrets Manager), e.g.:
 *   docker compose exec app node src/scripts/bootstrapSuperAdminFromSecret.js
 * Or:
 *   SUPERADMIN_SECRET_ID=my-secret MONGODB_URL=... AWS_REGION=us-east-2 node src/scripts/bootstrapSuperAdminFromSecret.js
 *
 * Optional env:
 *   BOOTSTRAP_ORG_ID — attach new users to this org (default: first org by _id)
 *   BOOTSTRAP_SUPERADMIN_NAME — display name when creating a new caregiver (default: Bianca Super Admin)
 */
/* eslint-disable no-console */
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const mongoose = require('mongoose');
const { Caregiver, Org } = require('../models');

const DEFAULT_SECRET_ID = 'bianca-production-superadmin-bootstrap';
const DEFAULT_REGION = 'us-east-2';

async function loadCredentials() {
  const secretId = process.env.SUPERADMIN_SECRET_ID || DEFAULT_SECRET_ID;
  const region = process.env.AWS_REGION || DEFAULT_REGION;
  const client = new SecretsManagerClient({ region });
  const out = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  if (!out.SecretString) throw new Error('Secret has no SecretString');
  const parsed = JSON.parse(out.SecretString);
  if (!parsed.email || !parsed.password) {
    throw new Error('Secret JSON must include "email" and "password" strings');
  }
  return {
    email: String(parsed.email).trim().toLowerCase(),
    password: String(parsed.password),
  };
}

async function main() {
  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) {
    console.error('Missing MONGODB_URL');
    process.exit(1);
  }

  const { email, password } = await loadCredentials();
  console.log('Loaded bootstrap credentials for email:', email);

  await mongoose.connect(mongoUrl);

  const orgQuery = process.env.BOOTSTRAP_ORG_ID ? { _id: process.env.BOOTSTRAP_ORG_ID } : {};
  const org = await Org.findOne(orgQuery).sort({ _id: 1 });
  if (!org) {
    throw new Error(
      process.env.BOOTSTRAP_ORG_ID
        ? `No org with BOOTSTRAP_ORG_ID=${process.env.BOOTSTRAP_ORG_ID}`
        : 'No organization in database. Create an org first or set BOOTSTRAP_ORG_ID'
    );
  }

  let caregiver = await Caregiver.findOne({ email });
  if (caregiver) {
    caregiver.role = 'superAdmin';
    caregiver.password = password;
    caregiver.isEmailVerified = true;
    await caregiver.save();
    console.log('Updated existing caregiver to superAdmin.');
  } else {
    caregiver = await Caregiver.create({
      name: process.env.BOOTSTRAP_SUPERADMIN_NAME || 'Bianca Super Admin',
      email,
      password,
      role: 'superAdmin',
      org: org._id,
      clients: [],
      isEmailVerified: true,
      isPhoneVerified: false,
    });
    const already = org.caregivers.some((id) => id.equals(caregiver._id));
    if (!already) {
      org.caregivers.push(caregiver._id);
      await org.save();
    }
    console.log('Created new superAdmin caregiver and linked to org:', org.name || org._id);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
