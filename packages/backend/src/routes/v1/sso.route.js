const express = require('express');
const validate = require('../../middlewares/validate');
const ssoValidation = require('../../validations/sso.validation');
const ssoController = require('../../controllers/sso.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: SSO
 *   description: Single Sign-On authentication (Google, Microsoft)
 */

/**
 * @swagger
 * /sso/login:
 *   post:
 *     summary: SSO login
 *     description: Authenticate using SSO provider (Google or Microsoft). Returns JWT tokens on success.
 *     tags: [SSO]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider
 *               - idToken
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [google, microsoft]
 *                 description: SSO provider name
 *               idToken:
 *                 type: string
 *                 description: ID token from SSO provider
 *             example:
 *               provider: google
 *               idToken: eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMzQ1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       "200":
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 caregiver:
 *                   $ref: '#/components/schemas/Caregiver'
 *                 tokens:
 *                   $ref: '#/components/schemas/AuthTokens'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
// SSO login endpoint
router.post('/login', validate(ssoValidation.login), ssoController.login);

/**
 * @swagger
 * /sso/verify:
 *   post:
 *     summary: Verify SSO token
 *     description: Verify an SSO token (for backend verification). Used internally to validate SSO tokens.
 *     tags: [SSO]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider
 *               - idToken
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [google, microsoft]
 *                 description: SSO provider name
 *               idToken:
 *                 type: string
 *                 description: ID token from SSO provider
 *     responses:
 *       "200":
 *         description: Token verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 userInfo:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     providerId:
 *                       type: string
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
// Verify SSO token endpoint (for backend verification)
router.post('/verify', validate(ssoValidation.verify), ssoController.verify);

/**
 * @swagger
 * /sso/exchange-code:
 *   post:
 *     summary: Exchange OAuth authorization code for access token
 *     description: Exchange OAuth authorization code for access token on the backend (server-side). This is used for PKCE flow where the token exchange requires client_secret.
 *     tags: [SSO]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider
 *               - code
 *               - redirectUri
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [google, microsoft]
 *                 description: SSO provider name
 *               code:
 *                 type: string
 *                 description: Authorization code from OAuth provider
 *               redirectUri:
 *                 type: string
 *                 description: Redirect URI used in the authorization request
 *               codeVerifier:
 *                 type: string
 *                 description: PKCE code verifier (optional, for enhanced security)
 *     responses:
 *       "200":
 *         description: Token exchange successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 expiresIn:
 *                   type: number
 *                 tokenType:
 *                   type: string
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/exchange-code', validate(ssoValidation.exchangeCode), ssoController.exchangeCode);

module.exports = router;
