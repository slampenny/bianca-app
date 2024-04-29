const twilio = require('twilio');
const config = require('../config/config');
const chatService = require('./chat.service');
const { Conversation, Message, Patient } = require('../models');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const httpStatus = require('http-status');

const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
const VoiceResponse = twilio.twiml.VoiceResponse;

const initiateCall = async (patientId) => {
  
  const patient = await Patient.findById(patientId);
  if (!patient || !patient.phone) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Patient or phone number not found');
  }
  
  const call = await twilioClient.calls.create({
    url: `${config.twilio.apiUrl}/v1/twilio/prepare-call?initial=true`, // Endpoint to prepare call
    to: patient.phone,
    from: config.twilio.phone,
    statusCallback: `${config.twilio.apiUrl}/v1/twilio/end-call`, // Endpoint to handle call status updates
    statusCallbackEvent: ['completed'], // List of call status events to trigger the webhook
    statusCallbackMethod: 'POST', // HTTP method to use for the webhook request
  });

  const previousConversation = await Conversation.find({ patientId: patientId }).sort({ createdAt: -1 }).limit(1);

  const conversation = new Conversation({ 
    callSid: call.sid, 
    patientId: patient._id,
    history: previousConversation.length > 0 ? previousConversation[0].history : null 
  });
  await conversation.save();

  return call.sid;
};

const prepareCall = (req) => {
  logger.info(`In Prepare Call function`);
  const twiml = new VoiceResponse();
  if (req.query.initial === 'true') {
    twiml.say('Hello, I am Bianca. How can I help you today?');
  }
  
  twiml.gather({
    input: 'speech',
    speechTimeout: 'auto',
    speechModel: 'experimental_conversations',
    action: `${config.twilio.apiUrl}/v1/twilio/real-time-interaction`, // Endpoint to process speech response
    actionOnEmptyResult: true,
  });

  return twiml.toString();
};

const handleRealTimeInteraction = async (callSid, speechResult, callStatus) => {
    logger.info(`In Handle Real Time Interaction function with callSid: ${callSid}, speechResult: ${speechResult}, and callStatus: ${callStatus}`);
    if (!speechResult) {
      // A timeout occurred
      logger.info('A timeout occurred');
      const twiml = new VoiceResponse();
      twiml.say(`I didn't hear anything. I'll phone back later`);
      return twiml.toString();
    }

    logger.info(`Save the patient's speech to the conversation with these params: ${callSid} and ${speechResult}`);
    const conversation = await Conversation.findOne({ callSid }).populate('patientId');
    if (!conversation) {
      logger.error(`No conversation found with callSid: ${callSid}`);
      throw new Error(`No conversation found with callSid: ${callSid}`);
    }

    const patientMessage = new Message({ role: 'patient', content: speechResult });
    await patientMessage.save();
    conversation.messages.push(patientMessage._id);
  
    // Populate the messages array
    await conversation.populate('messages').execPopulate();

    logger.info(`Send the patient's speech to ChatGPT and get a response`);
    try {
      const chatGptResponse = await chatService.chatWith(
          conversation
      );

      logger.info(`Save ChatGPT's response to the conversation`);
      const assistantMessage = new Message({ role: 'assistant', content: chatGptResponse });
      await assistantMessage.save();

      conversation.messages.push(assistantMessage._id);
      await conversation.save();
    
      logger.info(`Convert the ChatGPT response to speech and get a URL for the speech file`);
      const speechUrl = await chatService.textToSpeech(callSid, chatGptResponse);
    
      logger.info(`Prepare the call for the next patient speech`);
      const twiml = new VoiceResponse();
      twiml.play(speechUrl); // Use the <Play> verb with the URL of the audio file
      twiml.redirect(`${config.twilio.apiUrl}/v1/twilio/prepare-call`);
        
      return twiml.toString();
      // logger.info(`Prepare the call for the next patient speech`);
      // const twiml = new VoiceResponse();
      // twiml.say(chatGptResponse);
      // twiml.redirect(`${config.twilio.apiUrl}/v1/twilio/prepare-call`);
      
      // return twiml.toString();
    } catch (err) { 
      logger.error(`Error with ChatGPT: ${err}, so we hang up the call`);
    }

    const twiml = new VoiceResponse();
    twiml.hangup();
    return twiml.toString();
  };

  const endCall = async (callSid) => {
    logger.info(`In End Call function with callSid: ${callSid}`);
    const conversation = await Conversation.findOne({ callSid }).populate('messages');
    if (!conversation) {
      logger.error(`No conversation found with callSid: ${callSid}`);
    } else {
      conversation.history = await chatService.summarize(conversation);
      // Set the end time of the conversation to the current time
      conversation.endTime = new Date();
      await conversation.save();
    }
    try {
      chatService.cleanup(callSid);
    } catch (err) {
      logger.error(`Error with cleanup: ${err}`);
    }
  };

module.exports = {
  endCall,
  initiateCall,
  prepareCall,
  handleRealTimeInteraction,
};