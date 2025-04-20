const OpenAI = require('openai');
const config = require('../config/config');
const logger = require('../config/logger');

const openai = new OpenAI({ apiKey: config.openai.apiKey });
const { prompts } = require('../templates/prompts');

const openaiAPI = {
  async generateResponseFromOpenAI(messages, userName) {
    logger.info(`OpenAI - Sending messages: \n${JSON.stringify(messages)}`);
    const cleanedMessages = messages.map(({ role, content }) => ({ role, content }));
    // Include the system prompt in the messages
    cleanedMessages.unshift(prompts.system);

    try {
      let response = await openai.chat.completions.create({
        messages: cleanedMessages,
        model: config.openai.model,
      });

      logger.info(`OpenAI - response generated: \n${JSON.stringify(response)}`);
      response = response.choices[0].message.content;
      return response;
    } catch (err) {
      logger.error(`OpenAI - Error Generating Response: ${err}`);
      throw err;
    }
  },
};

module.exports = {
  openaiAPI,
};
