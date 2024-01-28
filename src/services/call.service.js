  const { User } = require('../models'); // Assuming User model includes phone number
  const openAiService = require('./openAiService');
  const config = require('../config/config');
  const { Call } = require('../models');
  const ApiError = require('../utils/ApiError');
  const httpStatus = require('http-status');

  const getCallById = async (id) => {
    const call = await Call.findById(id);
    if (!call) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Call not found');
    }
    return call;
  };

  /**
   * Processes the recorded speech from a call
   * @param {String} callSid - The SID of the Twilio call
   * @param {String} recordingUrl - The URL of the call recording
   */
  const processCallRecording = async (callSid, recordingUrl) => {
    // Fetch the recording and convert it to text using OpenAI's Whisper
    const transcribedText = await openAiService.transcribeSpeech(recordingUrl);

    // Send the transcribed text to ChatGPT for a response
    const chatGptResponse = await openAiService.chatWithGpt(transcribedText);

    // Use Twilio to send the ChatGPT response back as speech
    await sendResponseAsCall(callSid, chatGptResponse);
  };

  /**
  * Sends a text response as a voice message in a call
  * @param {String} callSid - The SID of the Twilio call
  * @param {String} textResponse - The text response to be converted to speech
  */
  const sendResponseAsCall = async (callSid, textResponse) => {
    // Convert the text response to speech using a TTS service
    const speechUrl = await openAiService.textToSpeech(textResponse);

    // Use Twilio to play the speech URL in the call
    await twilioClient.calls(callSid)
        .update({ url: `${config.twilio.playbackUrl}?SpeechUrl=${encodeURIComponent(speechUrl)}` });
  };

  module.exports = {
    getCallById,
    processCallRecording,
    sendResponseAsCall
  };
