/**
 * Database Configuration (MongoDB/Mongoose)
 */

const Joi = require('joi');

const buildDatabaseConfig = (envVars) => ({
  mongoose: {
    url: (envVars.MONGODB_URL || 'mongodb://localhost:27017/bianca-app') + (envVars.NODE_ENV === 'test' ? '-test' : ''),
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
});

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

