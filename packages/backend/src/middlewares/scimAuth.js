const httpStatus = require('http-status');
const bcrypt = require('bcryptjs');
const Org = require('../models/org.model');
const catchAsync = require('../utils/catchAsync');

function scimUnauthorized(res, detail) {
  res.status(httpStatus.UNAUTHORIZED);
  res.setHeader('Content-Type', 'application/scim+json');
  return res.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
    status: String(httpStatus.UNAUTHORIZED),
    detail: detail || 'Unauthorized',
  });
}

/**
 * SCIM 2.0 Bearer token auth. Resolves org from :orgId and verifies token against org.scimBearerTokenHash.
 */
const scimBearerAuth = () =>
  catchAsync(async (req, res, next) => {
    const orgId = req.params.orgId;
    if (!orgId) {
      return scimUnauthorized(res, 'Missing organization');
    }
    const header = req.headers.authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) {
      return scimUnauthorized(res, 'Missing or invalid Authorization header');
    }
    const token = match[1].trim();
    if (!token) {
      return scimUnauthorized(res, 'Empty bearer token');
    }

    const org = await Org.findById(orgId).select('+scimBearerTokenHash');
    if (!org || !org.scimEnabled || !org.scimBearerTokenHash) {
      return scimUnauthorized(res, 'Invalid credentials');
    }

    const ok = await bcrypt.compare(token, org.scimBearerTokenHash);
    if (!ok) {
      return scimUnauthorized(res, 'Invalid credentials');
    }

    req.scimOrg = org;
    next();
  });

module.exports = scimBearerAuth;
