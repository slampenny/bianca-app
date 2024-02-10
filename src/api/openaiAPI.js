const OpenAI = require("openai");
const config = require("../config/config");
const logger = require("../config/logger");
const openai = new OpenAI({apiKey: config.openai.apiKey});

const openaiAPI = {
  async generateResponseFromOpenAI(messages, userName) {
    logger.info(`OpenAI - Sending messages: \n${JSON.stringify(messages)}`);
    try {
      let response = await openai.chat.completions.create({
        messages,
        model: config.openai.model,
      });

      logger.info(`OpenAI - response generated: \n${JSON.stringify(response)}`);
      response = response.data.choices[0].message.content;
      return response;
    } catch (err) {
      logger.error(`OpenAI - Error Generating Response: ${err}`);
      throw err;
    }
  },
};

module.exports = {
  openaiAPI
};
