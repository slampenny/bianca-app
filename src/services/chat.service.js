const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const config = require('../config/config');
const { openaiAPI } = require("../api/openaiAPI.js");
const Conversation = require("../models/conversation.model");
const langChainAPI = require("../api/langChainAPI.js");
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const fs = require('fs');
const util = require('util');
const logger = require('../config/logger.js');

class ChatService {
    /**
 * Sends text to ChatGPT and gets a response
 * @param {String} userName - The name of the user
 * @param {String} userDomain - The domain of the user
 * @param {String} message - The message to send to ChatGPT
 * @param {String} role - The role of the sender (default is 'user')
 * @returns {Promise<String>} - The response from ChatGPT
 */
    async chatWith(conversation) {
        console.log(`Backend - Preparing to Send Message`);
        try {
            let messages = conversation.messages,
                openaiResponse

            // Generate a response from OpenAI
            openaiResponse = await openaiAPI.generateResponseFromOpenAI(
                messages,
                conversation.userId.name
            );

            return openaiResponse;
        } catch (err) {
            throw err;
        }
    }

    /**
     * Transcribes speech using Whisper
     * @param {String} audioUrl - The URL of the audio to transcribe
     * @returns {Promise<String>} - The transcribed text
     */
    async transcribeSpeech(audioUrl) {
        // Implement transcription using Whisper here
        // As of my last update, OpenAI had not released Whisper API for public use,
        // so this method would depend on the specifics of their API once available.
    }

    /**
     * Converts text to speech
     * @param {String} text - The text to convert
     * @returns {Promise<String>} - URL to the speech audio
     */
    async textToSpeech(text) {
        const client = new TextToSpeechClient();
        const request = {
            input: { text: text },
            voice: {
                languageCode: process.env.GOOGLE_CLOUD_TTS_LANGUAGE,
                name: process.env.GOOGLE_CLOUD_TTS_NAME,
                ssmlGender: process.env.GOOGLE_CLOUD_TTS_GENDER,
            },
            audioConfig: { audioEncoding: process.env.GOOGLE_CLOUD_TTS_ENCODING },
        };

        try {
            const [response] = await client.synthesizeSpeech(request);
            const audioContentBase64 = response.audioContent.toString('base64');
            return audioContentBase64;
        } catch (err) {
            console.error(`Error generating audio file: ${err}`);
            throw err;
        }
    }
}

module.exports = new ChatService();
