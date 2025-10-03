"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisManager = exports.CacheUtils = exports.RedisManager = void 0;
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const ioredis_1 = __importDefault(require("ioredis"));
class RedisManager {
    constructor() {
        this.redis = null;
        this.config = null;
        this.secretsClient = new client_secrets_manager_1.SecretsManagerClient({
            region: process.env['AWS_REGION'] || 'us-east-1',
        });
    }
    static getInstance() {
        if (!RedisManager.instance) {
            RedisManager.instance = new RedisManager();
        }
        return RedisManager.instance;
    }
    async initialize() {
        if (this.redis && this.redis.status === 'ready') {
            return;
        }
        try {
            const secretArn = process.env['REDIS_SECRET_ARN'];
            if (!secretArn) {
                throw new Error('REDIS_SECRET_ARN environment variable is required');
            }
            const command = new client_secrets_manager_1.GetSecretValueCommand({
                SecretId: secretArn,
            });
            const response = await this.secretsClient.send(command);
            if (!response.SecretString) {
                throw new Error('Redis secret value is empty');
            }
            this.config = JSON.parse(response.SecretString);
            const redisOptions = {
                host: this.config.host,
                port: this.config.port,
                connectTimeout: this.config.connectTimeout,
                lazyConnect: this.config.lazyConnect,
                family: this.config.family,
                keepAlive: this.config.keepAlive ? 30000 : 0,
                db: this.config.db,
                keyPrefix: this.config.keyPrefix,
                maxRetriesPerRequest: this.config.maxRetriesPerRequest,
                enableReadyCheck: this.config.enableReadyCheck,
                enableOfflineQueue: false,
            };
            if (this.config.ssl) {
                redisOptions.tls = {};
            }
            if (this.config.auth_token) {
                redisOptions.password = this.config.auth_token;
            }
            this.redis = new ioredis_1.default(redisOptions);
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
            await this.redis.connect();
        }
        catch (error) {
            console.error('Failed to initialize Redis connection:', error);
            throw error;
        }
    }
    getClient() {
        if (!this.redis) {
            throw new Error('Redis not initialized. Call initialize() first.');
        }
        return this.redis;
    }
    isReady() {
        return this.redis?.status === 'ready';
    }
    async disconnect() {
        if (this.redis) {
            await this.redis.quit();
            this.redis = null;
        }
    }
    async healthCheck() {
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
        }
        catch (error) {
            console.error('Redis health check failed:', error);
            return { status: 'unhealthy' };
        }
    }
    async getStats() {
        if (!this.redis || this.redis.status !== 'ready') {
            return null;
        }
        try {
            const info = await this.redis.info();
            return this.parseRedisInfo(info);
        }
        catch (error) {
            console.error('Failed to get Redis stats:', error);
            return null;
        }
    }
    parseRedisInfo(info) {
        const lines = info.split('\r\n');
        const stats = {};
        let section = '';
        for (const line of lines) {
            if (line.startsWith('#')) {
                section = line.substring(2).toLowerCase();
                stats[section] = {};
            }
            else if (line.includes(':')) {
                const [key, value] = line.split(':');
                if (section && key) {
                    stats[section][key] = isNaN(Number(value)) ? value : Number(value);
                }
            }
        }
        return stats;
    }
}
exports.RedisManager = RedisManager;
class CacheUtils {
    static async get(key) {
        try {
            const redis = this.redisManager.getClient();
            const value = await redis.get(key);
            return value ? JSON.parse(value) : null;
        }
        catch (error) {
            console.error(`Cache get error for key ${key}:`, error);
            return null;
        }
    }
    static async set(key, value, ttlSeconds) {
        try {
            const redis = this.redisManager.getClient();
            const serialized = JSON.stringify(value);
            if (ttlSeconds) {
                await redis.setex(key, ttlSeconds, serialized);
            }
            else {
                await redis.set(key, serialized);
            }
            return true;
        }
        catch (error) {
            console.error(`Cache set error for key ${key}:`, error);
            return false;
        }
    }
    static async del(key) {
        try {
            const redis = this.redisManager.getClient();
            const result = await redis.del(key);
            return result > 0;
        }
        catch (error) {
            console.error(`Cache delete error for key ${key}:`, error);
            return false;
        }
    }
    static async exists(key) {
        try {
            const redis = this.redisManager.getClient();
            const result = await redis.exists(key);
            return result === 1;
        }
        catch (error) {
            console.error(`Cache exists error for key ${key}:`, error);
            return false;
        }
    }
    static async expire(key, ttlSeconds) {
        try {
            const redis = this.redisManager.getClient();
            const result = await redis.expire(key, ttlSeconds);
            return result === 1;
        }
        catch (error) {
            console.error(`Cache expire error for key ${key}:`, error);
            return false;
        }
    }
    static async mget(keys) {
        try {
            const redis = this.redisManager.getClient();
            const values = await redis.mget(...keys);
            return values.map(value => value ? JSON.parse(value) : null);
        }
        catch (error) {
            console.error(`Cache mget error for keys ${keys.join(', ')}:`, error);
            return keys.map(() => null);
        }
    }
    static async mset(keyValuePairs) {
        try {
            const redis = this.redisManager.getClient();
            const serializedPairs = [];
            for (const [key, value] of Object.entries(keyValuePairs)) {
                serializedPairs.push(key, JSON.stringify(value));
            }
            await redis.mset(...serializedPairs);
            return true;
        }
        catch (error) {
            console.error('Cache mset error:', error);
            return false;
        }
    }
}
exports.CacheUtils = CacheUtils;
CacheUtils.redisManager = RedisManager.getInstance();
exports.redisManager = RedisManager.getInstance();
