/**
 * Sync superAdmin email/password from AWS Secrets Manager into MongoDB (Caregiver).
 * Used by startup (production/staging) and by CLI script bootstrapSuperAdminFromSecret.js.
 *
 * Requires an active mongoose connection. Does not disconnect.
 */
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const mongoose = require('mongoose');
const { Caregiver, Org } = require('../models');
const logger = require('../config/logger');

const DEFAULT_SECRET_ID = 'bianca-production-superadmin-bootstrap';
const DEFAULT_REGION = 'us-east-2';

async function loadCredentialsFromSecret() {
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

/**
 * Reads SUPERADMIN_SECRET_ID (default bianca-production-superadmin-bootstrap) and upserts superAdmin caregiver.
 * @returns {{ email: string, action: 'updated'|'created' }}
 */
async function syncSuperAdminFromAwsSecret() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB must be connected before superadmin sync');
  }

  const { email, password } = await loadCredentialsFromSecret();
  logger.info(`[SuperAdmin bootstrap] Loaded credentials for email: ${email}`);

  let org;
  if (process.env.BOOTSTRAP_ORG_ID) {
    org = await Org.findById(process.env.BOOTSTRAP_ORG_ID);
    if (!org) {
      throw new Error(`No org with BOOTSTRAP_ORG_ID=${process.env.BOOTSTRAP_ORG_ID}`);
    }
  } else {
    org = await Org.findOne({}).sort({ _id: 1 });
    if (!org && process.env.BOOTSTRAP_CREATE_ORG_IF_MISSING !== '0') {
      org = await Org.create({
        name: process.env.BOOTSTRAP_ORG_NAME || 'Bianca Technologies',
        email: String(process.env.BOOTSTRAP_ORG_EMAIL || 'internal-root@biancatechnologies.com').toLowerCase(),
        country: 'US',
        caregivers: [],
        clients: [],
      });
      logger.info(`[SuperAdmin bootstrap] Created organization (database had no orgs): ${org.name}`);
    }
    if (!org) {
      throw new Error(
        'No organization in database. Set BOOTSTRAP_ORG_ID or allow auto-create (default), or insert an org.'
      );
    }
  }

  let caregiver = await Caregiver.findOne({ email });
  let action;
  if (caregiver) {
    caregiver.role = 'superAdmin';
    caregiver.password = password;
    caregiver.isEmailVerified = true;
    await caregiver.save();
    action = 'updated';
    logger.info(`[SuperAdmin bootstrap] Updated existing caregiver to superAdmin (${email})`);
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
    action = 'created';
    logger.info(`[SuperAdmin bootstrap] Created superAdmin caregiver and linked to org: ${org.name || org._id}`);
  }

  return { email, action };
}

module.exports = {
  syncSuperAdminFromAwsSecret,
  loadCredentialsFromSecret,
};
