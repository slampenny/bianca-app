const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const { OpenAIApi, Configuration } = require("openai");
const config = require('../config/config');

const configuration = new Configuration({
    apiKey: config.openai.apiKey,
});
const openai = new OpenAIApi(configuration);

class OpenAiService {
    /**
     * Sends text to ChatGPT and gets a response
     * @param {String} text - The text input for ChatGPT
     * @returns {Promise<String>} - The response from ChatGPT
     */
    async chatWithGpt(text) {
        try {
            const response = await openai.createChatCompletion({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: text }],
            });
            return response.data.choices[0].message.content;
        } catch (error) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error communicating with OpenAI');
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
        // Convert text to speech using an appropriate API or service
        // This could be an external TTS service as OpenAI doesn't offer a direct TTS API as of my last update.
    }
}

module.exports = new OpenAiService();
