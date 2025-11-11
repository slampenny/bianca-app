/**
 * Cache Service - Abstraction layer for caching
 * 
 * Currently uses in-memory caching (zero cost)
 * Can be switched to Redis later by changing the implementation
 * 
 * Usage:
 *   const cache = require('./services/cache.service');
 *   await cache.set('key', 'value', 3600); // 1 hour TTL
 *   const value = await cache.get('key');
 *   await cache.del('key');
 */

let NodeCache;
try {
  NodeCache = require('node-cache');
} catch (err) {
  // node-cache not installed - will use no-op fallback
  NodeCache = null;
}
const logger = require('../config/logger');
const config = require('../config/config');

// In-memory cache instance (zero cost)
let memoryCache = null;

// Redis client (will be initialized if Redis is configured)
let redisClient = null;

/**
 * Initialize the cache service
 * Uses in-memory cache by default, switches to Redis if configured
 */
const initializeCache = () => {
  const cacheType = config.cache?.type || process.env.CACHE_TYPE || 'memory';
  const redisUrl = config.redis?.url || process.env.REDIS_URL;
  
  if (cacheType === 'redis' && redisUrl) {
    // Initialize Redis client
    try {
      const redis = require('redis');
      redisClient = redis.createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('Redis reconnection failed after 10 retries');
              return new Error('Redis connection failed');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      redisClient.on('error', (err) => {
        logger.error('Redis Client Error:', err);
      });

      redisClient.on('connect', () => {
        logger.info('Redis client connected');
      });

      redisClient.connect().catch((err) => {
        logger.error('Failed to connect to Redis, falling back to memory cache:', err);
        redisClient = null;
        initializeMemoryCache();
      });
      
      logger.info('Cache service initialized with Redis');
    } catch (error) {
      logger.warn('Redis not available, using in-memory cache:', error.message);
      initializeMemoryCache();
    }
  } else {
    // Use in-memory cache (zero cost)
    initializeMemoryCache();
  }
};

/**
 * Initialize in-memory cache
 */
const initializeMemoryCache = () => {
  if (!NodeCache) {
    logger.warn('node-cache not installed - cache service will operate in no-op mode. Install node-cache for caching functionality.');
    memoryCache = null;
    return;
  }
  
  // Standard TTL: 1 hour, check for expired keys every 10 minutes
  memoryCache = new NodeCache({
    stdTTL: 3600,
    checkperiod: 600,
    useClones: false, // Better performance
  });
  
  logger.info('Cache service initialized with in-memory cache (zero cost)');
};

/**
 * Get a value from cache
 * @param {string} key - Cache key
 * @returns {Promise<string|object|null>} Cached value or null if not found
 */
const get = async (key) => {
  try {
    if (redisClient) {
      // Use Redis
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } else if (memoryCache) {
      // Use in-memory cache
      return memoryCache.get(key) || null;
    }
    return null;
  } catch (error) {
    logger.error(`Cache GET error for key ${key}:`, error);
    return null;
  }
};

/**
 * Set a value in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache (will be JSON stringified)
 * @param {number} ttlSeconds - Time to live in seconds (optional)
 * @returns {Promise<boolean>} True if successful
 */
const set = async (key, value, ttlSeconds = null) => {
  try {
    if (redisClient) {
      // Use Redis
      const serializedValue = JSON.stringify(value);
      if (ttlSeconds) {
        await redisClient.setEx(key, ttlSeconds, serializedValue);
      } else {
        await redisClient.set(key, serializedValue);
      }
      return true;
    } else if (memoryCache) {
      // Use in-memory cache
      if (ttlSeconds) {
        memoryCache.set(key, value, ttlSeconds);
      } else {
        memoryCache.set(key, value);
      }
      return true;
    }
    // No cache available - return true (no-op mode, pretend it worked)
    return true;
  } catch (error) {
    logger.error(`Cache SET error for key ${key}:`, error);
    return false;
  }
};

/**
 * Delete a value from cache
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} True if successful
 */
const del = async (key) => {
  try {
    if (redisClient) {
      // Use Redis
      await redisClient.del(key);
      return true;
    } else if (memoryCache) {
      // Use in-memory cache
      memoryCache.del(key);
      return true;
    }
    // No cache available - return true (no-op mode)
    return true;
  } catch (error) {
    logger.error(`Cache DEL error for key ${key}:`, error);
    return false;
  }
};

/**
 * Delete multiple keys (supports pattern matching for memory cache)
 * @param {string} pattern - Key pattern (e.g., 'user:*')
 * @returns {Promise<number>} Number of keys deleted
 */
const delPattern = async (pattern) => {
  try {
    if (redisClient) {
      // Use Redis SCAN to find matching keys
      const keys = [];
      for await (const key of redisClient.scanIterator({
        MATCH: pattern,
        COUNT: 100,
      })) {
        keys.push(key);
      }
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      return keys.length;
    } else if (memoryCache) {
      // Use in-memory cache - get all keys and filter
      const allKeys = memoryCache.keys();
      const matchingKeys = allKeys.filter(key => {
        // Simple pattern matching (supports * wildcard)
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(key);
      });
      memoryCache.del(matchingKeys);
      return matchingKeys.length;
    }
    // No cache available - return 0 (no-op mode)
    return 0;
  } catch (error) {
    logger.error(`Cache DEL pattern error for pattern ${pattern}:`, error);
    return 0;
  }
};

/**
 * Check if a key exists in cache
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} True if key exists
 */
const exists = async (key) => {
  try {
    if (redisClient) {
      // Use Redis
      const result = await redisClient.exists(key);
      return result === 1;
    } else if (memoryCache) {
      // Use in-memory cache
      return memoryCache.has(key);
    }
    return false;
  } catch (error) {
    logger.error(`Cache EXISTS error for key ${key}:`, error);
    return false;
  }
};

/**
 * Increment a numeric value in cache
 * @param {string} key - Cache key
 * @param {number} amount - Amount to increment (default: 1)
 * @param {number} ttlSeconds - TTL to set if key doesn't exist (optional)
 * @returns {Promise<number>} New value after increment
 */
const increment = async (key, amount = 1, ttlSeconds = null) => {
  try {
    if (redisClient) {
      // Use Redis
      const newValue = await redisClient.incrBy(key, amount);
      if (ttlSeconds && (await redisClient.ttl(key)) === -1) {
        // Key exists but has no TTL, set it
        await redisClient.expire(key, ttlSeconds);
      }
      return newValue;
    } else if (memoryCache) {
      // Use in-memory cache
      const currentValue = memoryCache.get(key) || 0;
      const newValue = currentValue + amount;
      if (ttlSeconds) {
        memoryCache.set(key, newValue, ttlSeconds);
      } else {
        memoryCache.set(key, newValue);
      }
      return newValue;
    }
    return 0;
  } catch (error) {
    logger.error(`Cache INCREMENT error for key ${key}:`, error);
    return 0;
  }
};

/**
 * Get cache statistics
 * @returns {Promise<object>} Cache statistics
 */
const getStats = async () => {
  try {
    if (redisClient) {
      // Redis stats
      const info = await redisClient.info('stats');
      return {
        type: 'redis',
        connected: redisClient.isOpen,
        // Parse Redis INFO output if needed
      };
    } else if (memoryCache) {
      // Memory cache stats
      const stats = memoryCache.getStats();
      return {
        type: 'memory',
        keys: stats.keys,
        hits: stats.hits,
        misses: stats.misses,
        ksize: stats.ksize,
        vsize: stats.vsize,
      };
    }
    // No cache available
    return { type: 'none', connected: false, message: 'node-cache not installed' };
  } catch (error) {
    logger.error('Cache STATS error:', error);
    return { type: 'error', error: error.message };
  }
};

/**
 * Clear all cache (use with caution!)
 * @returns {Promise<boolean>} True if successful
 */
const flush = async () => {
  try {
    if (redisClient) {
      // Use Redis FLUSHDB (only clears current database)
      await redisClient.flushDb();
      return true;
    } else if (memoryCache) {
      // Use in-memory cache flush
      memoryCache.flushAll();
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Cache FLUSH error:', error);
    return false;
  }
};

// Initialize cache on module load
initializeCache();

module.exports = {
  get,
  set,
  del,
  delPattern,
  exists,
  increment,
  getStats,
  flush,
  // Expose cache type for debugging
  getCacheType: () => redisClient ? 'redis' : memoryCache ? 'memory' : 'none',
};

