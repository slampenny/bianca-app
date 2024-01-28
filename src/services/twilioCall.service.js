const httpStatus = require('http-status');
const { VoiceResponse } = require('twilio').twiml;
const ApiError = require('../utils/ApiError');
const openAiService = require('./openAi.service');
const twilio = require('twilio'); // Service for interacting with ChatGPT
const { Call, User } = require('../models');

const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);

/**
 * Initiates a call to a user
 * @param {ObjectId} userId - ID of the user to call
 * @returns {Promise<String>} - Call SID
 */
const initiateCall = async (userId) => {
    // Retrieve user or caregiver from the database
    const user = await User.findById(userId);
    if (!user || !user.phoneNumber) {
        throw new ApiError(httpStatus.NOT_FOUND, 'User or phone number not found');
    }

    // Initiate a call using Twilio
    const call = await twilioClient.calls.create({
        to: user.phoneNumber,
        from: config.twilio.phoneNumber,
        url: config.twilio.voiceUrl // URL to TwiML for handling call
    });

    if (!call) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to initiate call');
    }

    // Save call details to your database
    await new Call({ userId, callSid: call.sid, phoneNumber: user.phoneNumber }).save();

    return call.sid;
};

/**
 * Handles an incoming call and generates TwiML instructions
 * @param {Object} callData - Data received from Twilio about the call
 * @returns {Promise<String>} - TwiML instructions
 */
const handleIncomingCall = async (callData) => {
    const twiml = new VoiceResponse();

    // Example: Get a response from ChatGPT based on user's input
    const response = await openAiService.chatWithGpt(callData.input);
    twiml.say(response);

    return twiml.toString();
};

/**
 * Handles real-time conversation during the call
 * @param {String} callSid - The SID of the Twilio call
 * @param {String} userInput - The user's spoken input
 */
const handleRealTimeInteraction = async (callSid, userInput) => {
    // Transcribe the user's speech (if not already transcribed)
    const transcribedText = await openAiService.transcribeSpeech(userInput);

    // Get ChatGPT's response
    const chatGptResponse = await openAiService.chatWithGpt(transcribedText);

    // Convert the text response to speech using a TTS service
    const speechUrl = await openAiService.textToSpeech(chatGptResponse);

    // Use Twilio to play the speech URL in the call
    await twilioClient.calls(callSid)
        .update({ url: `${config.twilio.playbackUrl}?SpeechUrl=${encodeURIComponent(speechUrl)}` });
};

module.exports = {
    initiateCall,
    handleIncomingCall,
    handleRealTimeInteraction
};
