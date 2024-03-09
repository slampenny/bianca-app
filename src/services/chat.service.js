const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const config = require('../config/config');
const { openaiAPI } = require("../api/openaiAPI.js");
const { Conversation } = require("../models/conversation.model");
const {langChainAPI} = require("../api/langChainAPI.js");
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const {Storage} = require('@google-cloud/storage');
const storage = new Storage();
const bucket = storage.bucket('bianca-app-audio-files');
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

    /**
     * Converts text to speech
     * @param {String} text - The text to convert
     * @returns {Promise<String>} - URL to the speech audio
     */
    async textToSpeech(callSid, text) {
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
            logger.info('Synthesized speech successfully');
            // Create a new blob in the bucket and upload the file data
            const timestamp = Date.now();
            const blob = bucket.file(`${callSid}/audio-${timestamp}.mp3`);
            logger.info('Created blob successfully');

            const blobStream = blob.createWriteStream();

            return new Promise((resolve, reject) => {
                blobStream.on('error', (err) => {
                    logger.error(`Error uploading audio file: ${err}`);
                    reject(err);
                });

                blobStream.on('finish', async () => {
                    // The audio file is now uploaded and can be accessed at the following URL:
                    const [url] = await blob.getSignedUrl({
                        action: 'read',
                        expires: Date.now() + 1000 * 60 * 60, // 1 hour
                    });

                    console.log('Generated signed URL successfully');

                    resolve(url);
                });

                blobStream.end(response.audioContent);
            });
            // const [response] = await client.synthesizeSpeech(request);
            // const audioContentBase64 = response.audioContent.toString('base64');
            // return audioContentBase64;
        } catch (err) {
            logger.error(`Error generating audio file: ${err}`);
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
