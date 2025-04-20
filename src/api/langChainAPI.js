// Import the necessary modules and packages
const { LLMChain } = require('langchain/chains'); // Import the LLMChain class from the langchain package
const { OpenAI } = require('@langchain/openai'); // Import the OpenAIClient class from the @langchain/openai package
const { PromptTemplate } = require('@langchain/core/prompts'); // Import the PromptTemplate class from the @langchain/core package
const { templates } = require('../templates/templates'); // Import the templates from the local templates directory
const config = require('../config/config'); // Import the configuration settings

// Create a new instance of the OpenAI client
const llm = new OpenAI({
  concurrency: 10, // Set the maximum number of concurrent requests
  temperature: 0, // Set the randomness of the AI's responses
  modelName: config.openai.model, // Set the model name from an environment variable
});

// Define the langChainAPI object
const langChainAPI = {
  // Define the summarizeConversation method
  async summarizeConversation(message, conversationHistory, userDomain = 'casual conversation') {
    try {
      // Get the generic summarization template
      const template = templates.generic.summarization;
      // Log the template being used
      console.log(`LangChain - Using Template: ${template}`);
      // Create a new PromptTemplate instance
      const prompt = new PromptTemplate({
        template,
        inputVariables: ['prompt', 'history', 'userdomain'],
      });

      // Format the history using the PromptTemplate instance
      const formattedHistory = await prompt.format({
        prompt: message,
        history: conversationHistory,
        userdomain: userDomain,
      });
      // Create a new LLMChain instance
      const chain = new LLMChain({
        llm,
        prompt,
      });
      // Log the creation of the LLMChain instance
      console.log('LangChain - LLM Chain created');
      // Call the LLMChain instance with the formatted history and get the result
      const result = await chain.call({
        prompt: message,
        history: formattedHistory,
        userdomain: userDomain,
      });
      // Log the summarized conversation
      console.log(`LangChain - Summarized Conversation: ${result.text}`);
      // Return the summarized conversation
      return result.text;
    } catch (err) {
      // Log any errors that occur
      console.error(`LangChain - Error with Request: ${err}`);
      // Return the error message
      throw err;
    }
  },
};

// Export the langChainAPI object
module.exports = {
  langChainAPI,
};
