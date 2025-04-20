const { openaiAPI } = require('../api/openaiAPI.js');
const { langChainAPI } = require('../api/langChainAPI.js');
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
      const { messages } = conversation;
      let openaiResponse;

      // Generate a response from OpenAI
      openaiResponse = await openaiAPI.generateResponseFromOpenAI(messages, conversation.patientId.name);

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
      return await langChainAPI.summarizeConversation(conversation.messages, conversation.history);
    } catch (err) {
      throw err;
    }
  }
}

module.exports = new ChatService();
