import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import Redis from 'ioredis';

/**
 * Redis connection configuration interface
 */
export interface RedisConfig {
  host: string;
  port: number;
  ssl: boolean;
  connectTimeout: number;
  lazyConnect: boolean;
  maxRetriesPerRequest: number;
  retryDelayOnFailover: number;
  enableReadyCheck: boolean;
  family: number;
  keepAlive: boolean;
  db: number;
  keyPrefix: string;
  auth_token?: string;
}

/**
 * Redis connection manager with connection pooling and error handling
 */
export class RedisManager {
  private static instance: RedisManager;
  private redis: Redis | null = null;
  private config: RedisConfig | null = null;
  private secretsClient: SecretsManagerClient;

  private constructor() {
    this.secretsClient = new SecretsManagerClient({
      region: process.env['AWS_REGION'] || 'us-east-1',
    });
  }

  /**
   * Get singleton instance of RedisManager
   */
  public static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  /**
   * Initialize Redis connection with configuration from AWS Secrets Manager
   */
  public async initialize(): Promise<void> {
    if (this.redis && this.redis.status === 'ready') {
      return; // Already connected
    }

    try {
      // Get Redis configuration from Secrets Manager
      const secretArn = process.env['REDIS_SECRET_ARN'];
      if (!secretArn) {
        throw new Error('REDIS_SECRET_ARN environment variable is required');
      }

      const command = new GetSecretValueCommand({
        SecretId: secretArn,
      });

      const response = await this.secretsClient.send(command);
      if (!response.SecretString) {
        throw new Error('Redis secret value is empty');
      }

      this.config = JSON.parse(response.SecretString) as RedisConfig;

      // Create Redis connection with optimized settings
      const redisOptions: any = {
        host: this.config.host,
        port: this.config.port,
        
        // Connection settings
        connectTimeout: this.config.connectTimeout,
        lazyConnect: this.config.lazyConnect,
        family: this.config.family,
        keepAlive: this.config.keepAlive ? 30000 : 0, // Convert boolean to number (30 seconds or disabled)
        
        // Performance settings
        db: this.config.db,
        keyPrefix: this.config.keyPrefix,
        
        // Retry and error handling
        maxRetriesPerRequest: this.config.maxRetriesPerRequest,
        enableReadyCheck: this.config.enableReadyCheck,
        
        // Lambda optimizations
        enableOfflineQueue: false,
      };

      // Add optional settings only if they exist
      if (this.config.ssl) {
        redisOptions.tls = {};
      }
      
      if (this.config.auth_token) {
        redisOptions.password = this.config.auth_token;
      }

      this.redis = new Redis(redisOptions);

      // Set up event handlers
      this.redis.on('connect', () => {
        console.log('Redis connected successfully');
      });

      this.redis.on('ready', () => {
        console.log('Redis ready for commands');
      });

      this.redis.on('error', (error) => {
        console.error('Redis connection error:', error);
      });

      this.redis.on('close', () => {
        console.log('Redis connection closed');
      });

      this.redis.on('reconnecting', () => {
        console.log('Redis reconnecting...');
      });

      // Connect to Redis
      await this.redis.connect();
      
    } catch (error) {
      console.error('Failed to initialize Redis connection:', error);
      throw error;
    }
  }

  /**
   * Get Redis client instance
   */
  public getClient(): Redis {
    if (!this.redis) {
      throw new Error('Redis not initialized. Call initialize() first.');
    }
    return this.redis;
  }

  /**
   * Check if Redis is connected and ready
   */
  public isReady(): boolean {
    return this.redis?.status === 'ready';
  }

  /**
   * Disconnect from Redis
   */
  public async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }

  /**
   * Health check for Redis connection
   */
  public async healthCheck(): Promise<{ status: string; latency?: number }> {
    if (!this.redis || this.redis.status !== 'ready') {
      return { status: 'disconnected' };
    }

    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency,
      };
    } catch (error) {
      console.error('Redis health check failed:', error);
      return { status: 'unhealthy' };
    }
  }

  /**
   * Get cache statistics
   */
  public async getStats(): Promise<any> {
    if (!this.redis || this.redis.status !== 'ready') {
      return null;
    }

    try {
      const info = await this.redis.info();
      return this.parseRedisInfo(info);
    } catch (error) {
      console.error('Failed to get Redis stats:', error);
      return null;
    }
  }

  /**
   * Parse Redis INFO command output
   */
  private parseRedisInfo(info: string): any {
    const lines = info.split('\r\n');
    const stats: any = {};
    let section = '';

    for (const line of lines) {
      if (line.startsWith('#')) {
        section = line.substring(2).toLowerCase();
        stats[section] = {};
      } else if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (section && key) {
          stats[section][key] = isNaN(Number(value)) ? value : Number(value);
        }
      }
    }

    return stats;
  }
}

/**
 * Cache utility functions for common operations
 */
export class CacheUtils {
  private static redisManager = RedisManager.getInstance();

  /**
   * Get value from cache with JSON parsing
   */
  public static async get<T>(key: string): Promise<T | null> {
    try {
      const redis = this.redisManager.getClient();
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with JSON serialization and TTL
   */
  public static async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const redis = this.redisManager.getClient();
      const serialized = JSON.stringify(value);
      
      if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, serialized);
      } else {
        await redis.set(key, serialized);
      }
      
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  public static async del(key: string): Promise<boolean> {
    try {
      const redis = this.redisManager.getClient();
      const result = await redis.del(key);
      return result > 0;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  public static async exists(key: string): Promise<boolean> {
    try {
      const redis = this.redisManager.getClient();
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set TTL for existing key
   */
  public static async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const redis = this.redisManager.getClient();
      const result = await redis.expire(key, ttlSeconds);
      return result === 1;
    } catch (error) {
      console.error(`Cache expire error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get multiple keys at once
   */
  public static async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const redis = this.redisManager.getClient();
      const values = await redis.mget(...keys);
      return values.map(value => value ? JSON.parse(value) : null);
    } catch (error) {
      console.error(`Cache mget error for keys ${keys.join(', ')}:`, error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple key-value pairs
   */
  public static async mset(keyValuePairs: { [key: string]: any }): Promise<boolean> {
    try {
      const redis = this.redisManager.getClient();
      const serializedPairs: string[] = [];
      
      for (const [key, value] of Object.entries(keyValuePairs)) {
        serializedPairs.push(key, JSON.stringify(value));
      }
      
      await redis.mset(...serializedPairs);
      return true;
    } catch (error) {
      console.error('Cache mset error:', error);
      return false;
    }
  }
}

// Export singleton instance for easy access
export const redisManager = RedisManager.getInstance();