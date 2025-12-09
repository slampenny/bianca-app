/**
 * Database Configuration (MongoDB/Mongoose)
 */

const Joi = require('joi');
const fs = require('fs');

/**
 * Normalizes MongoDB URL for local development
 * Replaces Docker service name "mongodb" with "localhost" when running outside Docker
 */
const normalizeMongoUrl = (url) => {
  if (!url) return url;
  
  // Check if we're running in Docker by checking for common Docker environment indicators
  const isDocker = process.env.DOCKER_CONTAINER === 'true' || 
                   process.env.IN_DOCKER === 'true' ||
                   fs.existsSync('/.dockerenv');
  
  // If not in Docker and URL uses Docker service name, replace with localhost
  if (!isDocker && url.includes('://mongodb:')) {
    return url.replace('://mongodb:', '://localhost:');
  }
  
  return url;
};

const buildDatabaseConfig = (envVars) => {
  const mongoUrl = normalizeMongoUrl(envVars.MONGODB_URL || 'mongodb://localhost:27017/bianca-app');
  const dbSuffix = envVars.NODE_ENV === 'test' ? '-test' : '';
  
  return {
    mongoose: {
      url: mongoUrl + dbSuffix,
      options: {
        connectTimeoutMS: 30000,
        socketTimeoutMS: 60000,
        serverSelectionTimeoutMS: 30000,
        maxPoolSize: 10,
        minPoolSize: 2,
        retryWrites: true,
        w: 'majority',
        heartbeatFrequencyMS: 10000,
      },
    },
  };
};

const validateDatabaseEnvVars = (envVars) => {
  const schema = Joi.object({
    MONGODB_URL: Joi.string().optional(),
  });
  return schema.validate(envVars, { allowUnknown: true });
};

const applyDatabaseSecrets = (config, secrets) => {
  // MongoDB URL typically comes from environment variables, not secrets
  // But we can override if needed
  // if (secrets.MONGODB_URL) {
  //   config.mongoose.url = secrets.MONGODB_URL + (config.env === 'test' ? '-test' : '');
  // }
  return config;
};

module.exports = {
  buildDatabaseConfig,
  validateDatabaseEnvVars,
  applyDatabaseSecrets,
};

