const {
  checkStagingDataHosts,
  hostFromUrl,
} = require('../../../src/utils/stagingDataHosts.util');

describe('stagingDataHosts.util', () => {
  describe('hostFromUrl', () => {
    it('parses mongodb URLs', () => {
      expect(hostFromUrl('mongodb://mongodb:27017/bianca-service')).toBe('mongodb');
      expect(hostFromUrl('mongodb://localhost:27017/bianca-service')).toBe('localhost');
    });

    it('parses redis URLs', () => {
      expect(hostFromUrl('redis://redis:6379')).toBe('redis');
      expect(hostFromUrl('redis://127.0.0.1:6379')).toBe('127.0.0.1');
    });
  });

  describe('checkStagingDataHosts', () => {
    it('allows on-box hosts when NODE_ENV=staging', () => {
      expect(
        checkStagingDataHosts({
          nodeEnv: 'staging',
          mongodbUrl: 'mongodb://mongodb:27017/bianca-service',
          redisUrl: 'redis://redis:6379',
        })
      ).toEqual({ ok: true });
    });

    it('allows localhost mongo without redis', () => {
      expect(
        checkStagingDataHosts({
          nodeEnv: 'staging',
          secretId: 'MySecretsManagerSecret-Staging',
          mongodbUrl: 'mongodb://127.0.0.1:27017/bianca-service',
        })
      ).toEqual({ ok: true });
    });

    it('rejects off-box mongo host', () => {
      const result = checkStagingDataHosts({
        nodeEnv: 'staging',
        mongodbUrl: 'mongodb://prod-cluster.docdb.amazonaws.com:27017/bianca',
      });
      expect(result.ok).toBe(false);
      expect(result.host).toBe('prod-cluster.docdb.amazonaws.com');
      expect(result.field).toBe('MONGODB_URL');
    });

    it('rejects production mongo hostname even if secret looks staging', () => {
      const result = checkStagingDataHosts({
        nodeEnv: 'production',
        secretId: 'MySecretsManagerSecret-Staging',
        mongodbUrl: 'mongodb://production-mongo.internal:27017/bianca',
      });
      expect(result.ok).toBe(false);
      expect(result.host).toContain('production-mongo');
    });

    it('rejects off-box redis', () => {
      const result = checkStagingDataHosts({
        nodeEnv: 'staging',
        mongodbUrl: 'mongodb://mongodb:27017/db',
        redisUrl: 'redis://my-elasticache.cache.amazonaws.com:6379',
      });
      expect(result.ok).toBe(false);
      expect(result.field).toBe('REDIS_URL');
    });

    it('does not enforce when not staging', () => {
      expect(
        checkStagingDataHosts({
          nodeEnv: 'production',
          secretId: 'MySecretsManagerSecret',
          mongodbUrl: 'mongodb://anything.example.com:27017/db',
        })
      ).toEqual({ ok: true });
    });
  });
});
