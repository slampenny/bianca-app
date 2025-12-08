/**
 * Cache Configuration (Redis, Memory)
 */

const buildCacheConfig = (envVars) => ({
  cache: {
    type: envVars.CACHE_TYPE || 'memory',
  },
  redis: {
    url: envVars.REDIS_URL || (envVars.REDIS_ENDPOINT ? `redis://${envVars.REDIS_ENDPOINT}:${envVars.REDIS_PORT || 6379}` : null),
    endpoint: envVars.REDIS_ENDPOINT,
    port: envVars.REDIS_PORT || 6379,
  },
});

const validateCacheEnvVars = (envVars) => {
  const schema = Joi.object({
    CACHE_TYPE: Joi.string().valid('memory', 'redis').optional(),
    REDIS_URL: Joi.string().optional(),
    REDIS_ENDPOINT: Joi.string().optional(),
    REDIS_PORT: Joi.number().optional(),
  });
  return schema.validate(envVars, { allowUnknown: true });
};

const applyCacheSecrets = (config, secrets) => {
  if (secrets.CACHE_TYPE) config.cache.type = secrets.CACHE_TYPE;
  if (secrets.REDIS_URL) config.redis.url = secrets.REDIS_URL;
  if (secrets.REDIS_ENDPOINT) config.redis.endpoint = secrets.REDIS_ENDPOINT;
  if (secrets.REDIS_PORT) config.redis.port = secrets.REDIS_PORT;
  return config;
};

module.exports = {
  buildCacheConfig,
  validateCacheEnvVars,
  applyCacheSecrets,
};

