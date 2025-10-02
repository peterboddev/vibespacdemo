import { RedisManager, CacheUtils } from './redis';

// Mock AWS SDK
jest.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  GetSecretValueCommand: jest.fn(),
}));

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    mget: jest.fn(),
    mset: jest.fn(),
    info: jest.fn(),
    status: 'ready',
    on: jest.fn(),
  }));
});

describe('RedisManager', () => {
  let redisManager: RedisManager;
  let mockSecretsClient: any;
  let mockRedis: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env['REDIS_SECRET_ARN'] = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:redis-secret';
    process.env['AWS_REGION'] = 'us-east-1';

    // Mock secrets manager response
    const { SecretsManagerClient } = require('@aws-sdk/client-secrets-manager');
    mockSecretsClient = SecretsManagerClient.prototype;
    mockSecretsClient.send = jest.fn().mockResolvedValue({
      SecretString: JSON.stringify({
        host: 'test-redis.cache.amazonaws.com',
        port: 6379,
        ssl: true,
        connectTimeout: 10000,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        family: 4,
        keepAlive: true,
        db: 0,
        keyPrefix: 'insurance-quotation-test:',
        auth_token: 'test-auth-token',
      }),
    });

    // Mock Redis instance
    const Redis = require('ioredis');
    mockRedis = new Redis();
    
    redisManager = RedisManager.getInstance();
  });

  afterEach(() => {
    delete process.env['REDIS_SECRET_ARN'];
    delete process.env['AWS_REGION'];
  });

  describe('initialize', () => {
    it('should initialize Redis connection successfully', async () => {
      await redisManager.initialize();
      
      expect(mockSecretsClient.send).toHaveBeenCalledTimes(1);
      expect(mockRedis.connect).toHaveBeenCalledTimes(1);
    });

    it('should throw error when REDIS_SECRET_ARN is not set', async () => {
      delete process.env['REDIS_SECRET_ARN'];
      
      await expect(redisManager.initialize()).rejects.toThrow(
        'REDIS_SECRET_ARN environment variable is required'
      );
    });

    it('should throw error when secret value is empty', async () => {
      const { SecretsManagerClient } = require('@aws-sdk/client-secrets-manager');
      SecretsManagerClient.prototype.send = jest.fn().mockResolvedValue({ SecretString: '' });
      
      await expect(redisManager.initialize()).rejects.toThrow(
        'Redis secret value is empty'
      );
    });
  });

  describe('getClient', () => {
    it('should return Redis client when initialized', async () => {
      await redisManager.initialize();
      const client = redisManager.getClient();
      
      expect(client).toBeDefined();
    });

    it('should throw error when not initialized', () => {
      expect(() => redisManager.getClient()).toThrow(
        'Redis not initialized. Call initialize() first.'
      );
    });
  });

  describe('isReady', () => {
    it('should return true when Redis is ready', async () => {
      await redisManager.initialize();
      
      expect(redisManager.isReady()).toBe(true);
    });

    it('should return false when Redis is not initialized', () => {
      expect(redisManager.isReady()).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when Redis is ready', async () => {
      await redisManager.initialize();
      mockRedis.ping.mockResolvedValue('PONG');
      
      const health = await redisManager.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.latency).toBeDefined();
      expect(typeof health.latency).toBe('number');
    });

    it('should return disconnected status when Redis is not ready', async () => {
      const health = await redisManager.healthCheck();
      
      expect(health.status).toBe('disconnected');
      expect(health.latency).toBeUndefined();
    });

    it('should return unhealthy status when ping fails', async () => {
      await redisManager.initialize();
      mockRedis.ping.mockRejectedValue(new Error('Connection failed'));
      
      const health = await redisManager.healthCheck();
      
      expect(health.status).toBe('unhealthy');
    });
  });

  describe('disconnect', () => {
    it('should disconnect from Redis', async () => {
      await redisManager.initialize();
      await redisManager.disconnect();
      
      expect(mockRedis.quit).toHaveBeenCalledTimes(1);
    });
  });
});

describe('CacheUtils', () => {
  let mockRedis: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env['REDIS_SECRET_ARN'] = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:redis-secret';
    process.env['AWS_REGION'] = 'us-east-1';

    // Mock secrets manager response
    const { SecretsManagerClient } = require('@aws-sdk/client-secrets-manager');
    SecretsManagerClient.prototype.send = jest.fn().mockResolvedValue({
      SecretString: JSON.stringify({
        host: 'test-redis.cache.amazonaws.com',
        port: 6379,
        ssl: true,
        connectTimeout: 10000,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        family: 4,
        keepAlive: true,
        db: 0,
        keyPrefix: 'insurance-quotation-test:',
        auth_token: 'test-auth-token',
      }),
    });

    // Mock Redis instance
    const Redis = require('ioredis');
    mockRedis = new Redis();

    // Initialize Redis manager
    const redisManager = RedisManager.getInstance();
    await redisManager.initialize();
  });

  afterEach(() => {
    delete process.env['REDIS_SECRET_ARN'];
    delete process.env['AWS_REGION'];
  });

  describe('get', () => {
    it('should get and parse JSON value', async () => {
      const testData = { id: 1, name: 'test' };
      mockRedis.get.mockResolvedValue(JSON.stringify(testData));
      
      const result = await CacheUtils.get('test-key');
      
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
      expect(result).toEqual(testData);
    });

    it('should return null when key does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);
      
      const result = await CacheUtils.get('non-existent-key');
      
      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));
      
      const result = await CacheUtils.get('error-key');
      
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value without TTL', async () => {
      const testData = { id: 1, name: 'test' };
      mockRedis.set.mockResolvedValue('OK');
      
      const result = await CacheUtils.set('test-key', testData);
      
      expect(mockRedis.set).toHaveBeenCalledWith('test-key', JSON.stringify(testData));
      expect(result).toBe(true);
    });

    it('should set value with TTL', async () => {
      const testData = { id: 1, name: 'test' };
      mockRedis.setex.mockResolvedValue('OK');
      
      const result = await CacheUtils.set('test-key', testData, 3600);
      
      expect(mockRedis.setex).toHaveBeenCalledWith('test-key', 3600, JSON.stringify(testData));
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis error'));
      
      const result = await CacheUtils.set('error-key', { test: 'data' });
      
      expect(result).toBe(false);
    });
  });

  describe('del', () => {
    it('should delete key successfully', async () => {
      mockRedis.del.mockResolvedValue(1);
      
      const result = await CacheUtils.del('test-key');
      
      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
      expect(result).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      mockRedis.del.mockResolvedValue(0);
      
      const result = await CacheUtils.del('non-existent-key');
      
      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true when key exists', async () => {
      mockRedis.exists.mockResolvedValue(1);
      
      const result = await CacheUtils.exists('test-key');
      
      expect(result).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      mockRedis.exists.mockResolvedValue(0);
      
      const result = await CacheUtils.exists('non-existent-key');
      
      expect(result).toBe(false);
    });
  });

  describe('mget', () => {
    it('should get multiple values', async () => {
      const testData1 = { id: 1, name: 'test1' };
      const testData2 = { id: 2, name: 'test2' };
      mockRedis.mget.mockResolvedValue([
        JSON.stringify(testData1),
        JSON.stringify(testData2),
        null,
      ]);
      
      const result = await CacheUtils.mget(['key1', 'key2', 'key3']);
      
      expect(mockRedis.mget).toHaveBeenCalledWith('key1', 'key2', 'key3');
      expect(result).toEqual([testData1, testData2, null]);
    });
  });

  describe('mset', () => {
    it('should set multiple key-value pairs', async () => {
      const keyValuePairs = {
        key1: { id: 1, name: 'test1' },
        key2: { id: 2, name: 'test2' },
      };
      mockRedis.mset.mockResolvedValue('OK');
      
      const result = await CacheUtils.mset(keyValuePairs);
      
      expect(mockRedis.mset).toHaveBeenCalledWith(
        'key1', JSON.stringify(keyValuePairs.key1),
        'key2', JSON.stringify(keyValuePairs.key2)
      );
      expect(result).toBe(true);
    });
  });
});