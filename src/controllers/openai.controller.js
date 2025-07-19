const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { openaiService } = require('../services');
const logger = require('../config/logger');

const forceRecovery = catchAsync(async (req, res) => {
  const { callId } = req.params;
  const { reason } = req.body;

  logger.info(`[OpenAI Controller] Force recovery requested for call ${callId}, reason: ${reason || 'No reason provided'}`);

  try {
    const result = await openaiService.forceRecovery(callId, reason);
    
    if (result) {
      res.status(httpStatus.OK).json({
        success: true,
        message: 'Recovery initiated successfully',
        callId,
        reason: reason || 'External recovery request',
      });
    } else {
      res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Recovery failed - no connection found or invalid state',
        callId,
      });
    }
  } catch (error) {
    logger.error(`[OpenAI Controller] Error during force recovery for ${callId}: ${error.message}`);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error during recovery',
      callId,
      error: error.message,
    });
  }
});

const getStatus = catchAsync(async (req, res) => {
  const { callId } = req.params;

  logger.info(`[OpenAI Controller] Status check requested for call ${callId}`);

  try {
    const status = await openaiService.getConnectionStatus(callId);
    
    res.status(httpStatus.OK).json({
      success: true,
      callId,
      status,
    });
  } catch (error) {
    logger.error(`[OpenAI Controller] Error getting status for ${callId}: ${error.message}`);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error getting connection status',
      callId,
      error: error.message,
    });
  }
});

const getAllConnections = catchAsync(async (req, res) => {
  logger.info('[OpenAI Controller] All connections status requested');

  try {
    const connections = await openaiService.getAllConnectionStatus();
    
    res.status(httpStatus.OK).json({
      success: true,
      connections,
      count: connections.length,
    });
  } catch (error) {
    logger.error(`[OpenAI Controller] Error getting all connections: ${error.message}`);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error getting connections status',
      error: error.message,
    });
  }
});

const forceResponseWithSilence = catchAsync(async (req, res) => {
  const { callId } = req.params;

  logger.info(`[OpenAI Controller] Force response with silence requested for call ${callId}`);

  try {
    const result = await openaiService.forceResponseGenerationWithSilence(callId);
    
    if (result) {
      res.status(httpStatus.OK).json({
        success: true,
        message: 'Forced response generation initiated',
        callId,
        note: 'This sends a text message and requests a response even with silence',
      });
    } else {
      res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Failed to force response generation - no connection found or invalid state',
        callId,
      });
    }
  } catch (error) {
    logger.error(`[OpenAI Controller] Error during force response for ${callId}: ${error.message}`);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error during forced response',
      callId,
      error: error.message,
    });
  }
});

const uploadDebugAudio = catchAsync(async (req, res) => {
  const { callId } = req.params;

  logger.info(`[OpenAI Controller] Manual debug audio upload requested for call ${callId}`);

  try {
    // Get the connection object to include call statistics
    const conn = openaiService.connections.get(callId);
    const uploadedFiles = await openaiService.uploadDebugAudioToS3(callId, conn);
    
    if (uploadedFiles.length > 0) {
      res.status(httpStatus.OK).json({
        success: true,
        message: 'Debug audio uploaded successfully',
        callId,
        uploadedFiles,
        count: uploadedFiles.length,
      });
    } else {
      res.status(httpStatus.NOT_FOUND).json({
        success: false,
        message: 'No debug audio files found to upload',
        callId,
      });
    }
  } catch (error) {
    logger.error(`[OpenAI Controller] Error uploading debug audio for ${callId}: ${error.message}`);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error during debug audio upload',
      callId,
      error: error.message,
    });
  }
});

module.exports = {
  forceRecovery,
  getStatus,
  getAllConnections,
  forceResponseWithSilence,
  uploadDebugAudio,
}; 