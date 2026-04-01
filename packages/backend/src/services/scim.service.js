const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const httpStatus = require('http-status');
const { Org, Caregiver } = require('../models');
const ApiError = require('../utils/ApiError');
const config = require('../config/config');
const caregiverService = require('./caregiver.service');
const logger = require('../config/logger');

const SCIM_ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';
const USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';

function scimError(status, detail) {
  const err = new Error(detail);
  err.statusCode = status;
  err.isScimError = true;
  err.scimDetail = detail;
  return err;
}

function scimBasePath(orgId) {
  const base = (config.apiUrl || '').replace(/\/$/, '');
  return `${base}/scim/orgs/${orgId}/v2`;
}

/**
 * Super-admin: enable SCIM and return plaintext token once.
 */
const enableOrRotateScimToken = async (orgId) => {
  const org = await Org.findById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
  }
  const plain = `scim_${crypto.randomBytes(32).toString('base64url')}`;
  const scimBearerTokenHash = await bcrypt.hash(plain, 10);
  org.scimEnabled = true;
  org.scimBearerTokenHash = scimBearerTokenHash;
  org.scimTokenHint = plain.slice(-8);
  await org.save();
  logger.info('SCIM enabled / token rotated for org', { orgId: String(orgId) });
  return {
    token: plain,
    scimBaseUrl: scimBasePath(orgId),
    tokenHint: org.scimTokenHint,
  };
};

const disableScim = async (orgId) => {
  const org = await Org.findById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
  }
  org.scimEnabled = false;
  org.scimBearerTokenHash = undefined;
  org.scimTokenHint = undefined;
  await org.save();
  logger.info('SCIM disabled for org', { orgId: String(orgId) });
};

const getScimStatusForAdmin = async (orgId) => {
  const org = await Org.findById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
  }
  return {
    enabled: Boolean(org.scimEnabled),
    tokenHint: org.scimTokenHint || null,
    scimBaseUrl: scimBasePath(orgId),
  };
};

function caregiverToScimUser(c, orgIdForPath) {
  const id = String(c._id);
  const orgKey = orgIdForPath != null ? String(orgIdForPath) : String(c.org);
  return {
    schemas: [USER_SCHEMA],
    id,
    externalId: c.externalId || id,
    userName: c.email,
    active: c.active !== false,
    name: {
      formatted: c.name || c.email,
    },
    emails: [
      {
        value: c.email,
        primary: true,
      },
    ],
    meta: {
      resourceType: 'User',
      location: `${scimBasePath(orgKey)}/Users/${id}`,
    },
  };
}

function parseUserNameEq(filter) {
  if (!filter || typeof filter !== 'string') return null;
  const t = filter.trim();
  const m = /^userName\s+eq\s+"([^"]+)"/i.exec(t);
  if (m) return m[1].trim().toLowerCase();
  const m2 = /^userName\s+eq\s+(\S+)/i.exec(t);
  if (m2) return m2[1].replace(/^"+|"+$/g, '').trim().toLowerCase();
  return null;
}

const listUsers = async (orgId, { filter, startIndex = 1, count = 100 } = {}) => {
  const limit = Math.min(Math.max(parseInt(count, 10) || 100, 1), 200);
  const start = Math.max(parseInt(startIndex, 10) || 1, 1);
  const q = { org: orgId };
  const emailEq = parseUserNameEq(filter);
  if (emailEq) {
    q.email = emailEq;
  }
  const totalResults = await Caregiver.countDocuments(q);
  const skip = start - 1;
  const results = await Caregiver.find(q).sort({ email: 1 }).skip(skip).limit(limit).lean();

  return {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults,
    startIndex: start,
    itemsPerPage: results.length,
    Resources: results.map((c) => caregiverToScimUser(c, orgId)),
  };
};

const getUser = async (orgId, userId) => {
  const c = await Caregiver.findOne({ _id: userId, org: orgId }).lean();
  if (!c) {
    throw scimError(httpStatus.NOT_FOUND, 'User not found');
  }
  return caregiverToScimUser(c, orgId);
};

const createUser = async (orgId, body) => {
  const userName = (body.userName || body.emails?.find((e) => e.primary)?.value || '').trim().toLowerCase();
  if (!userName || !userName.includes('@')) {
    throw scimError(httpStatus.BAD_REQUEST, 'userName or primary email is required');
  }
  const nameFormatted =
    body.name?.formatted ||
    [body.name?.givenName, body.name?.familyName].filter(Boolean).join(' ').trim() ||
    userName.split('@')[0];

  if (await Caregiver.isEmailTaken(userName)) {
    const err = scimError(httpStatus.CONFLICT, 'User with this userName already exists');
    throw err;
  }

  const tempPassword = `${crypto.randomBytes(24).toString('base64url')}Aa1`;

  const caregiver = await caregiverService.createCaregiver(orgId, {
    name: nameFormatted,
    email: userName,
    password: tempPassword,
    role: 'staff',
    externalId: body.externalId || undefined,
    active: body.active !== false,
    isEmailVerified: true,
  });

  return caregiverToScimUser(caregiver, orgId);
};

const patchUser = async (orgId, userId, body) => {
  const caregiver = await Caregiver.findOne({ _id: userId, org: orgId });
  if (!caregiver) {
    throw scimError(httpStatus.NOT_FOUND, 'User not found');
  }

  const ops = body.Operations || body.operations || [];
  for (const op of ops) {
    const o = String(op.op || '').toLowerCase();
    if (o !== 'replace') continue;
    const path = String(op.path || '').toLowerCase();
    if (path === 'active' && op.value === false) {
      caregiver.active = false;
      continue;
    }
    if (path === 'active' && op.value === true) {
      caregiver.active = true;
      continue;
    }
    if (path === 'name.formatted' || path === 'name') {
      caregiver.name = String(op.value || '').trim() || caregiver.name;
    }
    if (path === 'username' || path === 'userName') {
      const nextEmail = String(op.value || '')
        .trim()
        .toLowerCase();
      if (nextEmail && nextEmail !== caregiver.email) {
        if (await Caregiver.isEmailTaken(nextEmail, caregiver._id)) {
          throw scimError(httpStatus.CONFLICT, 'Email already in use');
        }
        caregiver.email = nextEmail;
      }
    }
  }

  await caregiver.save();
  return caregiverToScimUser(caregiver, orgId);
};

const deleteUser = async (orgId, userId) => {
  const caregiver = await Caregiver.findOne({ _id: userId, org: orgId });
  if (!caregiver) {
    throw scimError(httpStatus.NOT_FOUND, 'User not found');
  }
  caregiver.active = false;
  await caregiver.save();
};

const serviceProviderConfig = (orgId) => {
  const base = scimBasePath(orgId);
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
    documentationUri: 'https://datatracker.ietf.org/doc/html/rfc7644',
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [
      {
        type: 'oauthbearertoken',
        name: 'OAuth Bearer Token',
        description: 'Bearer token issued per organization (configure in Bianca admin).',
      },
    ],
    meta: {
      resourceType: 'ServiceProviderConfig',
      location: `${base}/ServiceProviderConfig`,
    },
  };
};

const resourceTypes = (orgId) => {
  const base = scimBasePath(orgId);
  return {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: 1,
    startIndex: 1,
    itemsPerPage: 1,
    Resources: [
      {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
        id: 'User',
        name: 'User',
        endpoint: 'Users',
        description: 'Bianca facility user (caregiver)',
        schema: USER_SCHEMA,
        meta: {
          resourceType: 'ResourceType',
          location: `${base}/ResourceTypes/User`,
        },
      },
    ],
  };
};

const getResourceType = (orgId, typeId) => {
  if (String(typeId) !== 'User') {
    throw scimError(httpStatus.NOT_FOUND, 'Resource type not found');
  }
  const base = scimBasePath(orgId);
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
    id: 'User',
    name: 'User',
    endpoint: 'Users',
    description: 'Bianca facility user (caregiver)',
    schema: USER_SCHEMA,
    meta: {
      resourceType: 'ResourceType',
      location: `${base}/ResourceTypes/User`,
    },
  };
};

module.exports = {
  enableOrRotateScimToken,
  disableScim,
  getScimStatusForAdmin,
  scimBasePath,
  listUsers,
  getUser,
  createUser,
  patchUser,
  deleteUser,
  serviceProviderConfig,
  resourceTypes,
  getResourceType,
  scimError,
  SCIM_ERROR_SCHEMA,
};
