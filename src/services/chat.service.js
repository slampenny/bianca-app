const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const config = require('../config/config');
const { openaiAPI } = require("../api/openaiAPI.js");
const { Conversation } = require("../models/conversation.model");
const {langChainAPI} = require("../api/langChainAPI.js");
const logger = require('../config/logger');

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
        logger.info(`Backend - Preparing to Send Message`);
        try {
            let messages = conversation.messages,
                openaiResponse

            // Generate a response from OpenAI
            openaiResponse = await openaiAPI.generateResponseFromOpenAI(
                messages,
                conversation.patientId.name
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
    async summarize(conversation) {
        try {
            // Summarize the conversation using LangChain
            return await langChainAPI.summarizeConversation(
                conversation.messages,
                conversation.history
            );
        } catch (err) {
            throw err;
        }
    }

    async cleanup(callSid) {
        const [files] = await bucket.getFiles({prefix: callSid});
        await Promise.all(files.map(file => file.delete()));
        logger.info(`All audio files for call ${callSid} deleted.`);
    }
}

module.exports = new ChatService();
