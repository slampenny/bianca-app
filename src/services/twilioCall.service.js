const twilio = require('twilio');
const config = require('../config/config');
const chatService = require('./chat.service');
const { Conversation, User } = require('../models');

const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
const VoiceResponse = twilio.twiml.VoiceResponse;

const initiateCall = async (userId) => {
  const user = await User.findById(userId);
  if (!user || !user.phoneNumber) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User or phone number not found');
  }

  const call = await twilioClient.calls.create({
    url: `/v1/twilio/prepare-call`, // Endpoint to prepare call
    to: user.phoneNumber,
    from: config.twilio.phoneNumber,
  });

  // Create a new conversation for this call
  const conversation = new Conversation({ callSid: call.sid, userId: user._id });
  await conversation.save();

  return call.sid;
};

const prepareCall = () => {
  const twiml = new VoiceResponse();

  twiml.gather({
    input: 'speech',
    speechTimeout: 'auto',
    speechModel: 'experimental_conversations',
    action: `/v1/twilio/real-time-interaction`, // Endpoint to process speech response
  });

  twiml.toString();
};

const handleRealTimeInteraction = async (callSid, speechResult) => {
    // Save the user's speech to the conversation
    const conversation = await Conversation.findOne({ callSid }).populate('userId');
    conversation.messages.push({ role: 'user', content: speechResult });
  
    // Send the user's speech to ChatGPT and get a response
    const chatGptResponse = await chatService.chatWith(
        conversation
    );

    // Save ChatGPT's response to the conversation
    conversation.messages.push({ role: 'assistant', content: chatGptResponse });
    await conversation.save();
  
    // Convert the ChatGPT response to speech and get a URL for the speech file
    const speechUrl = await chatService.textToSpeech(chatGptResponse);
  
    // Update the call to play the speech file
    //await twilioClient.calls(callSid).update({ twiml: `<Play>${speechUrl}</Play>` });
  
    // Prepare the call for the next user speech
    const twiml = new VoiceResponse();
    twiml.say(chatGptResponse);
    twiml.redirect('/v1/twilio/prepare-call');
  
    return twiml.toString();
  };

module.exports = {
  initiateCall,
  prepareCall,
  handleRealTimeInteraction,
};