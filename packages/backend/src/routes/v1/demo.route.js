const express = require('express');
const router = express.Router();
const logger = require('../../config/logger');
const config = require('../../config/config');

function getSeedDatabaseDemo() {
  return require('../../scripts/seedDatabaseDemo');
}

const allowedDemoHosts = new Set([
  `demo.${config.primaryDomain}`,
  'demo.myphonefriend.com'
]);

const isDemoHost = (req) => {
  const hostname = (req.hostname || '').toLowerCase();
  return allowedDemoHosts.has(hostname);
};

const canAccessDemoReset = (req) => config.env === 'staging' || isDemoHost(req);

/**
 * @swagger
 * tags:
 *   name: Demo
 *   description: Demo data management endpoints (unguarded for sales team)
 */

/**
 * @swagger
 * /demo/reset:
 *   post:
 *     summary: Reset demo database with comprehensive demo data
 *     description: |
 *       Clears the database and seeds it with comprehensive demo data showcasing all app features.
 *       This endpoint is unguarded to allow sales team to reset demo data easily.
 *       Creates multiple patients, conversations, schedules, alerts, payment methods, and invoices.
 *     tags: [Demo]
 *     responses:
 *       "200":
 *         description: Demo database reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Demo database reset successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     patients:
 *                       type: number
 *                       example: 9
 *                     conversations:
 *                       type: number
 *                       example: 72
 *                     schedules:
 *                       type: number
 *                       example: 27
 *                     alerts:
 *                       type: number
 *                       example: 10
 *       "500":
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to reset demo database"
 */
router.post('/reset', async (req, res) => {
  if (!canAccessDemoReset(req)) {
    return res.status(404).json({
      success: false,
      message: 'Not found'
    });
  }

  try {
    logger.info('Demo database reset requested');
    
    const result = await getSeedDatabaseDemo()();
    
    logger.info('Demo database reset completed successfully');
    
    res.status(200).json({
      success: true,
      message: 'Demo database reset successfully',
      data: {
        clients: result.clients?.length || 0,
        org: result.org?._id || null,
        caregiver: result.caregiver?._id || null,
      }
    });
  } catch (error) {
    logger.error('Error resetting demo database:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset demo database',
      error: error.message
    });
  }
});

module.exports = router;
