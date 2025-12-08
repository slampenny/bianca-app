// Import the necessary modules and packages
const { ChatOpenAI } = require('@langchain/openai'); // Import the ChatOpenAI class from the modern @langchain/openai package
const { PromptTemplate } = require('@langchain/core/prompts'); // Import the PromptTemplate class from the @langchain/core package
const { templates } = require('../templates/templates'); // Import the templates from the local templates directory
const config = require('../config/config'); // Import the configuration settings

// Lazy initialization of ChatOpenAI - only create when needed and API key is available
let llm = null;
const getLLM = () => {
  if (!llm) {
    // Only initialize if API key is available (skip in test mode if not provided)
    if (!config.openai?.apiKey && process.env.NODE_ENV === 'test') {
      throw new Error('OpenAI API key not available. LangChain features are disabled in test mode without API key.');
    }
    llm = new ChatOpenAI({
      maxConcurrency: 10, // Set the maximum number of concurrent requests
      temperature: 0, // Set the randomness of the AI's responses
      modelName: config.openai.model, // Set the model name from an environment variable
    });
  }
  return llm;
};

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
      
      // Use the modern invoke method instead of chain.call
      const llmInstance = getLLM();
      const result = await llmInstance.invoke(formattedHistory);
      // Log the summarized conversation
      console.log(`LangChain - Summarized Conversation: ${result.content}`);
      // Return the summarized conversation
      return result.content;
    } catch (err) {
      // Log any errors that occur
      console.error(`LangChain - Error with Request: ${err}`);
      // Return the error message
      throw err;
    }
  },

  // Define the extractUserInformation method
  async extractUserInformation(conversationHistory, userDomain = 'casual conversation') {
    try {
      // Get the user extraction template
      const template = templates.generic.userExtraction;
      // Log the template being used
      console.log(`LangChain - Using User Extraction Template`);
      
      const prompt = new PromptTemplate({
        template,
        inputVariables: ['history', 'userdomain'],
      });

      const formattedPrompt = await prompt.format({
        history: conversationHistory,
        userdomain: userDomain,
      });

      const llmInstance = getLLM();
      const result = await llmInstance.invoke(formattedPrompt);
      console.log(`LangChain - Extracted User Information: ${result.content}`);
      return result.content;
    } catch (err) {
      console.error(`LangChain - Error extracting user information: ${err}`);
      throw err;
    }
  },

  // Define the processConversation method that runs both summarization and user extraction
  async processConversation(message, conversationHistory, userDomain = 'casual conversation') {
    try {
      // Run both operations in parallel for efficiency
      const [summary, userInfo] = await Promise.all([
        this.summarizeConversation(message, conversationHistory, userDomain),
        this.extractUserInformation(conversationHistory, userDomain)
      ]);

      return {
        summary,
        userInformation: userInfo,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      console.error(`LangChain - Error processing conversation: ${err}`);
      throw err;
    }
  },
};

// Export the langChainAPI object
module.exports = {
  langChainAPI,
};
