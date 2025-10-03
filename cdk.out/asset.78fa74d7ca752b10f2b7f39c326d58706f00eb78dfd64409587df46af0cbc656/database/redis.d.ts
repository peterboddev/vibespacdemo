import Redis from 'ioredis';
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
export declare class RedisManager {
    private static instance;
    private redis;
    private config;
    private secretsClient;
    private constructor();
    static getInstance(): RedisManager;
    initialize(): Promise<void>;
    getClient(): Redis;
    isReady(): boolean;
    disconnect(): Promise<void>;
    healthCheck(): Promise<{
        status: string;
        latency?: number;
    }>;
    getStats(): Promise<any>;
    private parseRedisInfo;
}
export declare class CacheUtils {
    private static redisManager;
    static get<T>(key: string): Promise<T | null>;
    static set(key: string, value: any, ttlSeconds?: number): Promise<boolean>;
    static del(key: string): Promise<boolean>;
    static exists(key: string): Promise<boolean>;
    static expire(key: string, ttlSeconds: number): Promise<boolean>;
    static mget<T>(keys: string[]): Promise<(T | null)[]>;
    static mset(keyValuePairs: {
        [key: string]: any;
    }): Promise<boolean>;
}
export declare const redisManager: RedisManager;
//# sourceMappingURL=redis.d.ts.map