const config = require('../../config/config');
const logger = require('../../config/logger');
const { Call, Conversation, Client } = require('../../models');
const chatService = require('../chat.service');
const alertService = require('../alert.service');
const { agenda } = require('../../config/agenda');
const { isVoicemailAnsweredBy } = require('./answerMarkup.builder');

function calculateCallCost(duration) {
  const minimumBillableDuration = config.billing.minimumBillableDuration || 30;
  const billableDuration = Math.max(duration, minimumBillableDuration);
  const totalMinutes = billableDuration / 60;
  return totalMinutes * config.billing.ratePerMinute;
}

async function updateCallStatus(callSid, status, logPrefix) {
  try {
    await Call.findOneAndUpdate(
      { callSid },
      { status, callStatus: status === 'in-progress' ? 'answered' : status }
    );
    logger.info(`${logPrefix} Updated call status to ${status} for ${callSid}`);
  } catch (err) {
    logger.error(`${logPrefix} Failed to update call status: ${err.message}`);
  }
}

async function disconnectOpenAIForVoicemail(callSid, call, logPrefix) {
  try {
    const { getOpenAIServiceInstance } = require('../openai.realtime.service');
    const openAIService = getOpenAIServiceInstance();

    if (openAIService.connections.has(callSid)) {
      logger.info(`${logPrefix} Disconnecting OpenAI connection for voicemail call ${callSid}`);
      await openAIService.disconnect(callSid);
      return;
    }

    if (call.conversationId) {
      for (const [connCallId, conn] of openAIService.connections.entries()) {
        if (conn.conversationId && conn.conversationId.toString() === call.conversationId.toString()) {
          logger.info(
            `${logPrefix} Disconnecting OpenAI connection for voicemail call ${callSid} (found via conversationId: ${connCallId})`
          );
          await openAIService.disconnect(connCallId);
          return;
        }
      }
    }

    logger.debug(`${logPrefix} No OpenAI connection found to disconnect for voicemail call ${callSid}`);
  } catch (error) {
    logger.error(`${logPrefix} Error disconnecting OpenAI for voicemail ${callSid}: ${error.message}`);
  }
}

async function scheduleRetryCall(call, org, logPrefix) {
  const retrySettings = org.callRetrySettings || {};
  const maxRetries = retrySettings.retryCount || 2;
  const retryIntervalMinutes = retrySettings.retryIntervalMinutes || 15;
  const currentRetryAttempt = call.retryAttempt || 0;
  const originalCallId = call.originalCallId || call._id;

  if (currentRetryAttempt >= maxRetries) {
    logger.info(`${logPrefix} Max retries (${maxRetries}) reached for call ${call._id}, not scheduling retry`);
    return;
  }

  const nextRetryAttempt = currentRetryAttempt + 1;
  const retryTime = new Date(Date.now() + retryIntervalMinutes * 60 * 1000);

  await agenda.schedule(retryTime, 'retryMissedCall', {
    callId: call._id.toString(),
    clientId: call.clientId.toString(),
    retryAttempt: nextRetryAttempt,
    originalCallId: originalCallId.toString(),
  });

  call.retryScheduledAt = retryTime;
  call.retryAttempt = nextRetryAttempt;
  call.originalCallId = originalCallId;
  call.maxRetries = maxRetries;
  await call.save();

  logger.info(
    `${logPrefix} Scheduled retry call #${nextRetryAttempt} for call ${call._id} at ${retryTime.toISOString()}`
  );
}

async function createOutboundCallRecord(client, clientId, externalCallId, logPrefix) {
  const onboardingService = require('../onboarding.service');
  const onboardingPlanService = require('../onboardingPlan.service');
  const onboardingDash = await onboardingService.getDashboardForClient(client._id);
  const onboardingPlan = await onboardingPlanService.getPlanForClientId(client._id);
  const nextOnboardingDay =
    onboardingPlanService.isOnboardingEnabled(onboardingPlan) &&
    !onboardingDash.journey.journeyComplete &&
    onboardingDash.journey.currentDay != null
      ? onboardingDash.journey.currentDay
      : null;
  const isOnboardingOutbound = nextOnboardingDay != null;

  const callRecord = await Call.create({
    callSid: externalCallId,
    clientId: client._id,
    startTime: new Date(),
    callStartTime: new Date(),
    callType: isOnboardingOutbound ? 'onboarding' : 'wellness-check',
    ...(isOnboardingOutbound ? { onboardingDay: nextOnboardingDay } : {}),
    status: 'initiated',
    callStatus: 'initiating',
  });

  if (isOnboardingOutbound) {
    logger.info(
      `${logPrefix} Outbound is onboarding session day ${nextOnboardingDay} for client ${client._id}`
    );
  }

  logger.info(`${logPrefix} Call record created: ${callRecord._id}`);
  return callRecord;
}

/**
 * Provider-agnostic call status handling (Twilio form posts or Telnyx JSON webhooks after normalization).
 * @param {{ callSid: string, callStatus: string|null, callDuration?: number, answeredBy?: string|null }} normalized
 * @param {{ hangupCall: (id: string) => Promise<void>, logPrefix?: string }} deps
 */
async function handleNormalizedCallStatus(normalized, deps) {
  const { callSid, callStatus: CallStatus, callDuration: CallDuration, answeredBy: AnsweredBy } =
    normalized;
  const logPrefix = deps.logPrefix || '[VoiceCall]';
  const hangupCall = deps.hangupCall;

  logger.info(
    `${logPrefix} Call status update for ${callSid}: ${CallStatus || 'null'} (AnsweredBy: ${AnsweredBy || 'null'})`
  );

  try {
    const call = await Call.findOne({ callSid });
    if (!call) {
      logger.warn(`${logPrefix} No call found for callSid: ${callSid}`);
      return;
    }

    if (
      !CallStatus &&
      AnsweredBy &&
      (AnsweredBy === 'machine_end_beep' ||
        AnsweredBy === 'machine_end_silence' ||
        AnsweredBy === 'machine_start' ||
        AnsweredBy === 'machine')
    ) {
      logger.warn(`${logPrefix} Async AMD detected voicemail for ${callSid}: ${AnsweredBy}`);
      call.callOutcome = 'voicemail';
      await call.save();
      logger.info(`${logPrefix} Marked call ${callSid} as voicemail (will process on completion)`);
      return;
    }

    const isVoicemail =
      isVoicemailAnsweredBy(AnsweredBy) ||
      CallStatus === 'machine' ||
      call.callOutcome === 'voicemail';

    const handleVoicemailCompletion = async () => {
      await disconnectOpenAIForVoicemail(callSid, call, logPrefix);
      call.endTime = new Date();
      call.callEndTime = new Date();
      call.status = 'failed';
      call.callOutcome = 'voicemail';
      call.duration = parseInt(CallDuration, 10) || call.duration || 0;
      call.callDuration = call.duration;
      call.cost = calculateCallCost(call.duration);
      await call.save();

      const voicemailClient = await Client.findById(call.clientId).populate('org');
      const voicemailOrg = voicemailClient?.org;
      if (!voicemailOrg) {
        logger.warn(
          `${logPrefix} Client ${call.clientId} does not have an org assigned - using default retry settings`
        );
      }

      if (voicemailOrg?.callRetrySettings?.retryCount > 0) {
        try {
          await scheduleRetryCall(call, voicemailOrg, logPrefix);
        } catch (retryError) {
          logger.error(`${logPrefix} Failed to schedule retry: ${retryError.message}`);
        }
      }

      const alertOnAllMissedCalls = voicemailOrg?.callRetrySettings?.alertOnAllMissedCalls !== false;
      const currentRetryAttempt = call.retryAttempt || 0;
      const maxRetries = voicemailOrg?.callRetrySettings?.retryCount || 2;
      const shouldAlert = alertOnAllMissedCalls || currentRetryAttempt >= maxRetries;

      if (shouldAlert) {
        try {
          await alertService.createAlert({
            message: 'Wellness check call went to voicemail',
            importance: 'medium',
            alertType: 'client',
            relatedClient: call.clientId,
            relatedCall: call._id,
            createdBy: call.clientId,
            createdModel: 'Client',
            visibility: 'assignedCaregivers',
            relevanceUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          });
          logger.info(`${logPrefix} Created alert for voicemail call ${callSid}`);
        } catch (alertError) {
          logger.error(
            `${logPrefix} Failed to create alert for voicemail ${callSid}: ${alertError.message}`,
            alertError
          );
        }
      }
    };

    switch (CallStatus) {
      case 'completed':
        if (isVoicemail) {
          await handleVoicemailCompletion();
        } else {
          call.endTime = new Date();
          call.callEndTime = new Date();
          call.duration = parseInt(CallDuration, 10) || 0;
          call.callDuration = call.duration;
          call.status = 'completed';
          call.callStatus = 'ended';
          call.callOutcome = 'answered';
          call.cost = calculateCallCost(call.duration);

          if (call.originalCallId && call.retryAttempt > 0) {
            try {
              const remainingJobs = await agenda.jobs({
                name: 'retryMissedCall',
                'data.originalCallId': call.originalCallId.toString(),
              });
              for (const job of remainingJobs) {
                await job.remove();
                logger.info(
                  `${logPrefix} Cancelled remaining retry job ${job.attrs._id} for successful retry call ${callSid}`
                );
              }
            } catch (cancelError) {
              logger.error(`${logPrefix} Failed to cancel remaining retries: ${cancelError.message}`);
            }
          }

          await call.save();

          if (call.conversationId) {
            try {
              const conversation = await Conversation.findById(call.conversationId)
                .select('analyzedData')
                .lean();
              const sentimentAt = conversation?.analyzedData?.sentimentAnalyzedAt;
              const alreadyFinalized =
                sentimentAt && Date.now() - new Date(sentimentAt).getTime() < 5 * 60 * 1000;
              if (!alreadyFinalized) {
                const conversationService = require('../conversation.service');
                await conversationService.finalizeConversation(call.conversationId.toString(), true);
              }
            } catch (finalizeError) {
              logger.error(
                `${logPrefix} Failed to finalize conversation for call ${callSid}: ${finalizeError.message}`,
                finalizeError
              );
              try {
                const conversation = await Conversation.findById(call.conversationId);
                if (conversation?.messages?.length > 0) {
                  conversation.history = await chatService.summarize(conversation);
                  await conversation.save();
                }
              } catch (summaryError) {
                logger.error(`${logPrefix} Fallback summarize failed: ${summaryError.message}`);
              }
            }
          }
        }
        break;

      case 'busy':
      case 'failed':
      case 'no-answer': {
        call.endTime = new Date();
        call.callEndTime = new Date();
        call.status = 'failed';
        call.callStatus = CallStatus === 'no-answer' ? 'no_answer' : CallStatus;
        call.callOutcome = CallStatus === 'no-answer' ? 'no_answer' : CallStatus;
        call.cost = calculateCallCost(call.duration || 0);
        await call.save();

        const client = await Client.findById(call.clientId).populate('org');
        const org = client?.org;

        if (org?.callRetrySettings?.retryCount > 0) {
          try {
            await scheduleRetryCall(call, org, logPrefix);
          } catch (retryError) {
            logger.error(`${logPrefix} Failed to schedule retry: ${retryError.message}`);
          }
        }

        const alertOnAllMissedCalls = org?.callRetrySettings?.alertOnAllMissedCalls !== false;
        const currentRetryAttempt = call.retryAttempt || 0;
        const maxRetries = org?.callRetrySettings?.retryCount || 2;
        const shouldAlert = alertOnAllMissedCalls || currentRetryAttempt >= maxRetries;

        if (shouldAlert) {
          const alertMessages = {
            busy: 'Wellness check call received busy signal',
            'no-answer': 'Wellness check call was not answered',
            failed: 'Wellness check call failed to connect',
          };
          try {
            await alertService.createAlert({
              message: alertMessages[CallStatus] || `Wellness check call failed: ${CallStatus}`,
              importance: 'medium',
              alertType: 'client',
              relatedClient: call.clientId,
              relatedCall: call._id,
              createdBy: call.clientId,
              createdModel: 'Client',
              visibility: 'assignedCaregivers',
              relevanceUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            });
          } catch (alertError) {
            logger.error(`${logPrefix} Failed to create alert for ${callSid}: ${alertError.message}`);
          }
        }
        break;
      }

      case 'machine':
        await handleVoicemailCompletion();
        break;

      default:
        switch (CallStatus) {
          case 'ringing':
            call.status = 'in-progress';
            call.callStatus = 'ringing';
            break;
          case 'initiated':
            if (['in-progress', 'completed', 'failed', 'machine'].includes(call.status)) {
              logger.info(`${logPrefix} Ignoring initiated for ${callSid}; call already ${call.status}`);
              break;
            }
            call.status = 'initiated';
            call.callStatus = 'initiating';
            break;
          case 'in-progress':
          case 'answered':
            if (isVoicemail) {
              logger.warn(`${logPrefix} Voicemail detected in ${CallStatus} for ${callSid}`);
              await disconnectOpenAIForVoicemail(callSid, call, logPrefix);
              try {
                await hangupCall(callSid);
              } catch (hangupError) {
                logger.error(`${logPrefix} Error hanging up voicemail call ${callSid}: ${hangupError.message}`);
              }
              await handleVoicemailCompletion();
            } else {
              call.status = 'in-progress';
              call.callStatus = CallStatus === 'answered' ? 'answered' : 'connected';
            }
            break;
          default:
            if (['in-progress', 'completed', 'failed', 'machine'].includes(call.status)) {
              logger.warn(
                `${logPrefix} Unknown status "${CallStatus}" for ${callSid}; preserving ${call.status}`
              );
              break;
            }
            call.status = 'initiated';
            call.callStatus = 'initiating';
        }
    }

    if (!call.isNew && call.isModified()) {
      await call.save();
    }
    logger.info(`${logPrefix} Updated call for ${callSid} with status ${CallStatus}`);
  } catch (error) {
    logger.error(`${logPrefix} Error handling call status: ${error.message}`);
  }
}

module.exports = {
  calculateCallCost,
  updateCallStatus,
  disconnectOpenAIForVoicemail,
  scheduleRetryCall,
  createOutboundCallRecord,
  handleNormalizedCallStatus,
};
