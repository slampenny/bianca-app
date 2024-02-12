const twilio = require('twilio');
const config = require('../config/config');
const chatService = require('./chat.service');
const { Conversation, Message, User } = require('../models');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const httpStatus = require('http-status');
const e = require('express');

const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
const VoiceResponse = twilio.twiml.VoiceResponse;

const initiateCall = async (userId) => {
  
  const user = await User.findById(userId);
  if (!user || !user.phone) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User or phone number not found');
  }
  
  const call = await twilioClient.calls.create({
    url: `${config.twilio.apiUrl}/v1/twilio/prepare-call`, // Endpoint to prepare call
    to: user.phone,
    from: config.twilio.phone,
  });

  const previousConversation = await Conversation.find({ userId: userId }).sort({ createdAt: -1 }).limit(1);

  const conversation = new Conversation({ 
    callSid: call.sid, 
    userId: user._id,
    history: previousConversation.length > 0 ? previousConversation[0].history : null 
  });
  await conversation.save();

  return call.sid;
};

const prepareCall = () => {
  logger.info(`In Prepare Call function`);
  const twiml = new VoiceResponse();

  twiml.gather({
    input: 'speech',
    speechTimeout: 'auto',
    speechModel: 'experimental_conversations',
    action: `${config.twilio.apiUrl}/v1/twilio/real-time-interaction`, // Endpoint to process speech response
  });
  
  twiml.say('Hello, I am Bianca. How can I help you today?');
  return twiml.toString();
};

const handleRealTimeInteraction = async (callSid, speechResult) => {
    logger.info(`Save the user's speech to the conversation with these params: ${callSid} and ${speechResult}`);
    const conversation = await Conversation.findOne({ callSid }).populate('userId');
    if (!conversation) {
      logger.error(`No conversation found with callSid: ${callSid}`);
      throw new Error(`No conversation found with callSid: ${callSid}`);
    }

    const userMessage = new Message({ role: 'user', content: speechResult });
    await userMessage.save();
    conversation.messages.push(userMessage._id);
  
    // Populate the messages array
    await conversation.populate('messages').execPopulate();

    logger.info(`Send the user's speech to ChatGPT and get a response`);
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
    
      logger.info(`Prepare the call for the next user speech`);
      const twiml = new VoiceResponse();
      twiml.play(speechUrl); // Use the <Play> verb with the URL of the audio file
      twiml.redirect(`${config.twilio.apiUrl}/v1/twilio/prepare-call`);
        
      return twiml.toString();
      // logger.info(`Prepare the call for the next user speech`);
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
      chatService.summarize(conversation);
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