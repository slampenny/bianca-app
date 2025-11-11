# Caching Strategy - Zero Cost to Start, Scale Later

**Date:** January 2025  
**Approach:** Docker Compose → ElastiCache (when needed)

---

## Current Implementation (Zero Cost)

### Docker Compose Setup

Redis is now included in `docker-compose.yml` and runs as a container alongside your app:

- **Local Development**: Redis runs in Docker (zero additional cost)
- **Staging**: Redis runs in Docker on the same EC2 instance (zero additional cost)
- **Production**: Redis runs in Docker on the same ECS instance (zero additional cost)

### Benefits

✅ **Zero additional infrastructure cost** - Uses existing compute  
✅ **Same Redis features** - Full Redis functionality  
✅ **Easy to scale** - Switch to ElastiCache when needed (just change env var)  
✅ **No code changes** - Cache service abstraction handles both

---

## How It Works

### Cache Service Abstraction

The `cache.service.js` automatically detects and uses:
1. **Redis** (if `REDIS_URL` is set) - Docker or ElastiCache
2. **In-Memory** (fallback) - Zero cost, single server only

### Configuration

**Docker Compose (Current - Zero Cost):**
```yaml
environment:
  - REDIS_URL=redis://redis:6379
  - CACHE_TYPE=redis
```

**ElastiCache (Future - When Scaling):**
```yaml
environment:
  - REDIS_URL=redis://staging-redis.xxxxx.cache.amazonaws.com:6379
  - CACHE_TYPE=redis
```

**No Redis (Fallback - Zero Cost):**
```yaml
# Don't set REDIS_URL, or set:
environment:
  - CACHE_TYPE=memory
```

---

## When to Scale to ElastiCache

### Current Setup is Fine For:
- ✅ Single server deployments
- ✅ Low to moderate traffic
- ✅ Development and staging
- ✅ Cost optimization

### Switch to ElastiCache When:
- ⚠️ **Multiple server instances** - Need distributed cache
- ⚠️ **High traffic** - Redis in Docker competing for resources
- ⚠️ **Dedicated Redis needed** - Better performance isolation
- ⚠️ **Production at scale** - Better reliability and monitoring

---

## Migration Path (When Needed)

### Step 1: Deploy ElastiCache

```bash
cd devops/terraform
terraform apply -target=aws_elasticache_replication_group.redis
```

### Step 2: Update Environment Variables

**Option A: Update docker-compose.production.yml**
```yaml
environment:
  - REDIS_URL=redis://${REDIS_ENDPOINT}:6379
  - CACHE_TYPE=redis
```

**Option B: Update ECS Task Definition**
- Add `REDIS_URL` environment variable
- Point to ElastiCache endpoint

### Step 3: Deploy

No code changes needed! The cache service automatically uses ElastiCache.

### Step 4: Remove Docker Redis (Optional)

Once ElastiCache is working, you can remove Redis from docker-compose if desired.

---

## Cost Comparison

| Setup | Monthly Cost | Best For |
|-------|-------------|----------|
| **Docker Redis** (current) | **$0** | Development, staging, low traffic |
| **ElastiCache cache.t3.micro** | ~$12 | Production, moderate traffic |
| **ElastiCache cache.t3.small** | ~$25 | Production, high traffic |
| **ElastiCache HA (2 nodes)** | ~$25-50 | Production, critical workloads |

---

## Usage Examples

### Rate Limiting

```javascript
const { cacheService } = require('./services');

const rateLimit = async (userId, limit, windowSeconds) => {
  const key = `rate-limit:${userId}`;
  const count = await cacheService.increment(key, 1, windowSeconds);
  return count <= limit;
};
```

### Session Blacklisting

```javascript
const blacklistToken = async (tokenId, ttlSeconds) => {
  await cacheService.set(`blacklist:${tokenId}`, '1', ttlSeconds);
};

const isTokenBlacklisted = async (tokenId) => {
  return await cacheService.exists(`blacklist:${tokenId}`);
};
```

### Query Caching

```javascript
const getCachedAnalysis = async (patientId) => {
  const cacheKey = `analysis:${patientId}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) return cached;
  
  const analysis = await computeExpensiveAnalysis(patientId);
  await cacheService.set(cacheKey, analysis, 3600); // 1 hour
  return analysis;
};
```

---

## Monitoring

### Check Cache Status

```javascript
const stats = await cacheService.getStats();
console.log(stats);
// { type: 'redis', connected: true } or { type: 'memory', keys: 42, hits: 100, misses: 10 }
```

### Health Check

The cache service automatically:
- Falls back to memory if Redis is unavailable
- Logs connection errors
- Handles reconnection automatically

---

## Summary

✅ **Current**: Redis in Docker Compose = **$0/month**  
✅ **Future**: Switch to ElastiCache = Just change env var  
✅ **No code changes**: Cache service handles both  
✅ **Production ready**: Works great for current scale

**You're all set!** Start using the cache service now, scale to ElastiCache when you need it.

---

**Status:** ✅ Ready to use - Zero cost implementation complete

