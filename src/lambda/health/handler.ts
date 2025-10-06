import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createSuccessResponse } from '../shared/response';
import { withErrorHandler, withCors } from '../shared/middleware';
import { redisManager } from '../../database/redis';
import { detailedHealthCheck as databaseDetailedHealthCheck } from '../../database/connection';
import { RedisMetrics } from '../shared/metrics';

/**
 * Health check endpoint for the Insurance Quotation API
 * 
 * @route GET /api/v1/health
 * @auth none
 * @description Returns the health status of the API and its dependencies
 * @timeout 30
 * @memory 256
 */

const healthCheckHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || context.awsRequestId || 'unknown';
  
  // Initialize Redis connection if not already connected
  try {
    if (!redisManager.isReady()) {
      await redisManager.initialize();
    }
  } catch (error) {
    console.warn('Redis initialization failed during health check:', error);
  }
  
  // Check Redis health with metrics
  const redisStartTime = Date.now();
  const redisHealth = await redisManager.healthCheck();
  const redisLatency = Date.now() - redisStartTime;
  
  // Record Redis health check metrics
  await RedisMetrics.recordHealthCheck(redisLatency, redisHealth.status === 'healthy');
  
  // Check Database health with detailed read/write test
  const databaseHealthResult = await databaseDetailedHealthCheck();
  
  const databaseHealth = {
    status: databaseHealthResult.healthy ? 'healthy' : 'unhealthy',
    latency: databaseHealthResult.totalLatency,
    operations: databaseHealthResult.operations,
    operationLatencies: databaseHealthResult.operationLatencies,
    ...(databaseHealthResult.error && { error: databaseHealthResult.error })
  };
  
  // Determine overall status
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
  
  // Return 200 for OK, 503 for degraded services
  const statusCode = healthData.status === 'OK' ? 200 : 503;
  
  return createSuccessResponse(healthData, statusCode, requestId);
};

export const handler = withCors(withErrorHandler(healthCheckHandler));