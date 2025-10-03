"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const response_1 = require("../shared/response");
const middleware_1 = require("../shared/middleware");
const redis_1 = require("../../database/redis");
const connection_1 = require("../../database/connection");
const healthCheckHandler = async (event, context) => {
    const requestId = event.requestContext?.requestId || context.awsRequestId || 'unknown';
    try {
        if (!redis_1.redisManager.isReady()) {
            await redis_1.redisManager.initialize();
        }
    }
    catch (error) {
        console.warn('Redis initialization failed during health check:', error);
    }
    const redisHealth = await redis_1.redisManager.healthCheck();
    const dbStartTime = Date.now();
    let databaseHealth;
    try {
        const isDbHealthy = await (0, connection_1.healthCheck)();
        const dbLatency = Date.now() - dbStartTime;
        databaseHealth = {
            status: isDbHealthy ? 'healthy' : 'unhealthy',
            latency: dbLatency
        };
    }
    catch (error) {
        const dbLatency = Date.now() - dbStartTime;
        databaseHealth = {
            status: 'unhealthy',
            latency: dbLatency,
            error: error instanceof Error ? error.message : 'Unknown database error'
        };
    }
    const allHealthy = redisHealth.status === 'healthy' && databaseHealth.status === 'healthy';
    const overallStatus = allHealthy ? 'OK' : 'DEGRADED';
    const healthData = {
        status: overallStatus,
        service: 'insurance-quotation-api',
        version: process.env['SERVICE_VERSION'] || '1.0.0',
        environment: process.env['NODE_ENV'] || 'development',
        region: process.env['AWS_REGION'] || 'unknown',
        functionName: context.functionName,
        memoryLimit: context.memoryLimitInMB,
        timestamp: new Date().toISOString(),
        checks: {
            redis: {
                status: redisHealth.status,
                latency: redisHealth.latency,
            },
            database: {
                status: databaseHealth.status,
                latency: databaseHealth.latency,
                ...(databaseHealth.error && { error: databaseHealth.error })
            }
        }
    };
    const statusCode = healthData.status === 'OK' ? 200 : 503;
    return (0, response_1.createSuccessResponse)(healthData, statusCode, requestId);
};
exports.handler = (0, middleware_1.withCors)((0, middleware_1.withErrorHandler)(healthCheckHandler));
