const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { voiceTelephonyService } = require('../services');
const logger = require('../config/logger');

const initiateCall = catchAsync(async (req, res) => {
  logger.info('[VoiceTelephony Controller] Initiating call request received.');
  const { clientId } = req.body;

  if (!clientId) {
    return res.status(httpStatus.BAD_REQUEST).send({ message: 'Patient ID is required' });
  }

  await voiceTelephonyService.initiateCall(clientId);
  logger.info(`[VoiceTelephony Controller] Call initiation processed for clientId: ${clientId}`);

  res.status(httpStatus.OK).json({ message: 'Call initiated successfully' });
});

const handleStartCall = (req, res) => {
  const externalCallId = req.body.CallSid || req.body.call_control_id || 'unknown';
  logger.info(
    `[VoiceTelephony Controller] handleStartCall invoked. externalCallId: ${externalCallId}`
  );

  const markup = voiceTelephonyService.generateAnswerMarkup(req);
  res.type(voiceTelephonyService.getAnswerMarkupContentType());
  res.send(markup);
};

const handleCallStatus = catchAsync(async (req, res) => {
  const externalCallId = req.body.CallSid || req.body.call_control_id || 'unknown';
  const status = req.body.CallStatus || req.body.event_type || 'unknown';
  logger.info(
    `[VoiceTelephony Controller] Call status invoked. externalCallId: ${externalCallId}, status: ${status}`
  );

  await voiceTelephonyService.handleCallStatus(req);

  logger.info(
    `[VoiceTelephony Controller] Call status processing complete for ${externalCallId}. Sending ACK.`
  );
  voiceTelephonyService.sendStatusWebhookAck(res);
});

const handleTestSip = (req, res) => {
  const markup = voiceTelephonyService.generateTestSipMarkup(req);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.type(voiceTelephonyService.getAnswerMarkupContentType());
  res.send(markup);
};

module.exports = {
  initiateCall,
  handleStartCall,
  handleCallStatus,
  handleTestSip,
};
