const express = require('express');
const validate = require('../../middlewares/validate');
const caregiverValidation = require('../../validations/caregiver.validation');
const caregiverController = require('../../controllers/caregiver.controller');
const testController = require('../../controllers/test.controller');
const router = express.Router();

/**
 * @swagger
 * /test/summarize:
 *   post:
 *     summary: Test the summarizeConversation function
 *     description: This is for testing purposes only.
 *     tags: [Test]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *                 description: must be unique
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: At least one number and one letter
 *             example:
 *               name: fake name
 *               email: fake@example.com
 *               password: password1
 *     responses:
 *       "200":
 *         description: Summarization response
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/summarize', testController.testSummarize);

/**
 * @swagger
 * /test/clean:
 *   post:
 *     summary: Test the summarizeConversation function
 *     description: This is for testing purposes only.
 *     tags: [Test]
 *     responses:
 *       "200":
 *         description: Clean response
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/clean', testController.testCleanDB);

/**
 * @swagger
 * /test/call:
 *   post:
 *     summary: Test the call with twilio feature
 *     description: This is for testing purposes only.
 *     tags: [Test]
 *     responses:
 *       "200":
 *         description: the call was initiated
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/call', testController.testCall);

// POST /v1/test/play-audio/:channelId
router.post('/play-audio/:channelId', async (req, res) => {
    const asteriskChannelId = req.params.channelId;
    const ariClient = getAriClient(); // Get the singleton instance
  
    if (!ariClient || !ariClient.channels.has(asteriskChannelId)) { // Use .channels map
      return res.status(404).send(`Channel ${asteriskChannelId} not found or ARI client not ready.`);
    }
  
    try {
      // --- Simulate receiving audio data (Base64 uLaw) ---
      // Option A: Use a pre-recorded beep.ulaw file (ensure it exists)
      // const beepFilePath = path.join(__dirname, '../../path/to/sounds/beep.ulaw'); // Find a path
      // const audioBuffer = fs.readFileSync(beepFilePath);
      // const base64Audio = audioBuffer.toString('base64');
  
      // Option B: Use a hardcoded short silence or tone (Base64 uLaw)
      // This represents a short period of silence in uLaw format, Base64 encoded
      const base64Audio = '/////////////////////////////////////////w=='; // ~20ms silence
  
      logger.info(`[Test Route] Attempting to play simulated audio on channel ${asteriskChannelId}`);
  
      // Directly call the playback function in ari.client
      await ariClient.playAudioToChannel(asteriskChannelId, base64Audio);
  
      res.status(200).send(`Playback initiated for channel ${asteriskChannelId}`);
  
    } catch (error) {
      logger.error(`[Test Route] Error playing audio to ${asteriskChannelId}: ${error.message}`);
      res.status(500).send('Failed to initiate playback');
    }
  });

/**
 * @swagger
 * /test/asterisk:
 *   get:
 *     summary: Test Asterisk connectivity
 *     description: Checks if Asterisk ARI is connected and ready to handle calls
 *     tags: [Test]
 *     responses:
 *       "200":
 *         description: Asterisk is connected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 asteriskStatus:
 *                   type: string
 *                 message:
 *                   type: string
 *       "503":
 *         description: Asterisk is not connected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.get('/asterisk', testController.testAsteriskCall);

/**
 * @swagger
 * /test/debug:
 *   get:
 *     summary: Get debug information about the system
 *     description: Returns detailed information about connections, system health, and services
 *     tags: [Test]
 *     responses:
 *       "200":
 *         description: Debug information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 connectionState:
 *                   type: object
 *                 webSocketServer:
 *                   type: object
 *                 environment:
 *                   type: object
 *                 health:
 *                   type: object
 *       "500":
 *         description: Server error
 */
router.get('/debug', testController.getDebugInfo);

/**
 * @swagger
 * /test/create-caregiver:
 *   post:
 *     summary: Test the summarizeConversation function
 *     description: This is for testing purposes only.
 *     tags: [Test]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orgId:
 *                  type: string
 *                  format: uuid
 *                  description: Organization id
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *                 description: must be unique
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: At least one number and one letter
 *             example:
 *               orgId: 60d0fe4f3d6a4e0015f8d8d0
 *               name: fake name
 *               email: fake@example.com
 *               password: password1
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *                $ref: '#/components/schemas/Caregiver'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/create-caregiver', validate(caregiverValidation.createCaregiver), caregiverController.createCaregiver);

module.exports = router;