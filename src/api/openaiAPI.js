const OpenAI = require("openai");
const config = require("../config/config");
const openai = new OpenAI(config.openai.apiKey);

const openaiAPI = {
  async generateResponseFromOpenAI(messages, userName) {
    console.log(`OpenAI - Sending messages: \n${JSON.stringify(messages)}`);
    try {
      let response = await openai.ChatCompletion.create({
        messages,
        model: process.env.OPENAI_API_MODEL,
        user: userName,
      });
      response = response.data.choices[0].message.content;
      console.log(`OpenAI - response generated: \n${response}`);
      return response;
    } catch (err) {
      console.error(
        `OpenAI - Error Generating Response. Status: ${err.response.status}. Error: ${err.response.statusText}`
      );
      return `OpenAI - Error Generating Response. Status: ${err.response.status}. Error: ${err.response.statusText}`;
    }
  },
};

module.exports = {
  openaiAPI
};
