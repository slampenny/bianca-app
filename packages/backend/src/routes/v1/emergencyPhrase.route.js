const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const emergencyPhraseValidation = require('../../validations/emergencyPhrase.validation');
const emergencyPhraseController = require('../../controllers/emergencyPhrase.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: EmergencyPhrases
 *   description: Emergency phrase management for detection
 */

/**
 * @swagger
 * /emergency-phrases:
 *   post:
 *     summary: Create an emergency phrase
 *     description: Create a new emergency phrase for detection. Only company admins can create phrases.
 *     tags: [EmergencyPhrases]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phrase
 *               - language
 *               - severity
 *               - category
 *               - pattern
 *             properties:
 *               phrase:
 *                 type: string
 *                 description: The emergency phrase text
 *               language:
 *                 type: string
 *                 enum: [en, es, fr, de, zh, ja, pt, it, ru, ar, hi, zh-cn]
 *                 default: en
 *               severity:
 *                 type: string
 *                 enum: [CRITICAL, HIGH, MEDIUM]
 *               category:
 *                 type: string
 *                 enum: [Medical, Safety, Physical, Request]
 *               pattern:
 *                 type: string
 *                 description: Regex pattern for matching
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       "201":
 *         description: Emergency phrase created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmergencyPhrase'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *   get:
 *     summary: Get emergency phrases
 *     description: Retrieve emergency phrases with optional filtering. Company staff can read all phrases.
 *     tags: [EmergencyPhrases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *         description: Filter by language
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [CRITICAL, HIGH, MEDIUM]
 *         description: Filter by severity
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [Medical, Safety, Physical, Request]
 *         description: Filter by category
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Sort by field (e.g., createdAt:desc)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of results
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/EmergencyPhrase'
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 totalResults:
 *                   type: integer
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */
// All routes require admin-level access (only company staff, not org staff)
router
  .route('/')
  .post(
    auth('manageAny:emergencyPhrase'), // Only company admins can create
    validate(emergencyPhraseValidation.createEmergencyPhrase),
    emergencyPhraseController.createEmergencyPhrase
  )
  .get(
    auth('readAny:emergencyPhrase'), // Company staff can read
    validate(emergencyPhraseValidation.getEmergencyPhrases),
    emergencyPhraseController.getEmergencyPhrases
  );

/**
 * @swagger
 * /emergency-phrases/statistics:
 *   get:
 *     summary: Get emergency phrase statistics
 *     description: Get usage statistics for emergency phrases
 *     tags: [EmergencyPhrases]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalPhrases:
 *                   type: integer
 *                 activePhrases:
 *                   type: integer
 *                 phrasesByLanguage:
 *                   type: object
 *                 phrasesBySeverity:
 *                   type: object
 *                 phrasesByCategory:
 *                   type: object
 *                 totalUsage:
 *                   type: integer
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */
router
  .route('/statistics')
  .get(
    auth('readAny:emergencyPhrase'),
    validate(emergencyPhraseValidation.getPhraseStatistics),
    emergencyPhraseController.getPhraseStatistics
  );

/**
 * @swagger
 * /emergency-phrases/test-pattern:
 *   post:
 *     summary: Test emergency phrase pattern
 *     description: Test if a text matches an emergency phrase pattern
 *     tags: [EmergencyPhrases]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *               - pattern
 *             properties:
 *               text:
 *                 type: string
 *                 description: Text to test against pattern
 *               pattern:
 *                 type: string
 *                 description: Regex pattern to test
 *     responses:
 *       "200":
 *         description: Pattern test result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 matches:
 *                   type: boolean
 *                 matchDetails:
 *                   type: object
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
router
  .route('/test-pattern')
  .post(
    auth('readAny:emergencyPhrase'),
    validate(emergencyPhraseValidation.testPhrasePattern),
    emergencyPhraseController.testPhrasePattern
  );

/**
 * @swagger
 * /emergency-phrases/bulk-import:
 *   post:
 *     summary: Bulk import emergency phrases
 *     description: Import multiple emergency phrases at once. Only company admins can import.
 *     tags: [EmergencyPhrases]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phrases
 *             properties:
 *               phrases:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - phrase
 *                     - language
 *                     - severity
 *                     - category
 *                     - pattern
 *     responses:
 *       "201":
 *         description: Phrases imported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 imported:
 *                   type: integer
 *                 failed:
 *                   type: integer
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/EmergencyPhrase'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */
router
  .route('/bulk-import')
  .post(
    auth('manageAny:emergencyPhrase'),
    validate(emergencyPhraseValidation.bulkImportPhrases),
    emergencyPhraseController.bulkImportPhrases
  );

/**
 * @swagger
 * /emergency-phrases/export:
 *   get:
 *     summary: Export emergency phrases
 *     description: Export all emergency phrases (CSV or JSON format)
 *     tags: [EmergencyPhrases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, json]
 *           default: json
 *         description: Export format
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *         description: Filter by language
 *     responses:
 *       "200":
 *         description: Export file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EmergencyPhrase'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
router
  .route('/export')
  .get(
    auth('readAny:emergencyPhrase'),
    validate(emergencyPhraseValidation.exportPhrases),
    emergencyPhraseController.exportPhrases
  );

/**
 * @swagger
 * /emergency-phrases/language/{language}:
 *   get:
 *     summary: Get emergency phrases by language
 *     description: Retrieve all active emergency phrases for a specific language
 *     tags: [EmergencyPhrases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: language
 *         required: true
 *         schema:
 *           type: string
 *           enum: [en, es, fr, de, zh, ja, pt, it, ru, ar, hi, zh-cn]
 *         description: Language code
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EmergencyPhrase'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 */
router
  .route('/language/:language')
  .get(
    auth('readAny:emergencyPhrase'),
    validate(emergencyPhraseValidation.getPhrasesByLanguage),
    emergencyPhraseController.getPhrasesByLanguage
  );

/**
 * @swagger
 * /emergency-phrases/{phraseId}:
 *   get:
 *     summary: Get an emergency phrase
 *     description: Get a specific emergency phrase by ID
 *     tags: [EmergencyPhrases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: phraseId
 *         required: true
 *         schema:
 *           type: string
 *         description: Emergency phrase ID
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmergencyPhrase'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *   patch:
 *     summary: Update an emergency phrase
 *     description: Update an existing emergency phrase. Only company admins can update.
 *     tags: [EmergencyPhrases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: phraseId
 *         required: true
 *         schema:
 *           type: string
 *         description: Emergency phrase ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phrase:
 *                 type: string
 *               language:
 *                 type: string
 *                 enum: [en, es, fr, de, zh, ja, pt, it, ru, ar, hi, zh-cn]
 *               severity:
 *                 type: string
 *                 enum: [CRITICAL, HIGH, MEDIUM]
 *               category:
 *                 type: string
 *                 enum: [Medical, Safety, Physical, Request]
 *               pattern:
 *                 type: string
 *               description:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmergencyPhrase'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Delete an emergency phrase
 *     description: Delete an emergency phrase. Only company admins can delete.
 *     tags: [EmergencyPhrases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: phraseId
 *         required: true
 *         schema:
 *           type: string
 *         description: Emergency phrase ID
 *     responses:
 *       "204":
 *         description: No content
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
  .route('/:phraseId')
  .get(
    auth('readAny:emergencyPhrase'),
    validate(emergencyPhraseValidation.getEmergencyPhrase),
    emergencyPhraseController.getEmergencyPhrase
  )
  .patch(
    auth('manageAny:emergencyPhrase'), // Only company admins can update
    validate(emergencyPhraseValidation.updateEmergencyPhrase),
    emergencyPhraseController.updateEmergencyPhrase
  )
  .delete(
    auth('manageAny:emergencyPhrase'), // Only company admins can delete
    validate(emergencyPhraseValidation.deleteEmergencyPhrase),
    emergencyPhraseController.deleteEmergencyPhrase
  );

/**
 * @swagger
 * /emergency-phrases/{phraseId}/toggle:
 *   patch:
 *     summary: Toggle emergency phrase status
 *     description: Enable or disable an emergency phrase. Only company admins can toggle.
 *     tags: [EmergencyPhrases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: phraseId
 *         required: true
 *         schema:
 *           type: string
 *         description: Emergency phrase ID
 *     responses:
 *       "200":
 *         description: Status toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmergencyPhrase'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
  .route('/:phraseId/toggle')
  .patch(
    auth('manageAny:emergencyPhrase'), // Only company admins can toggle
    validate(emergencyPhraseValidation.togglePhraseStatus),
    emergencyPhraseController.togglePhraseStatus
  );

module.exports = router;
