import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createSuccessResponse } from '../shared/response';
import { withErrorHandler, withCors } from '../shared/middleware';
import { redisManager } from '../../database/redis';

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
  
  // Check Redis health
  const redisHealth = await redisManager.healthCheck();
  
  const healthData = {
    status: redisHealth.status === 'healthy' ? 'OK' : 'DEGRADED',
    service: 'insurance-quotation-api',
    version: process.env['SERVICE_VERSION'] || '1.0.0',
    environment: process.env['NODE_ENV'] || 'development',
    region: process.env['AWS_REGION'] || 'unknown',
    functionName: context.functionName,
    memoryLimit: context.memoryLimitInMB,
    checks: {
      redis: {
        status: redisHealth.status,
        latency: redisHealth.latency,
      }
    }
  };
  
  // Return 200 for OK, 503 for degraded services
  const statusCode = healthData.status === 'OK' ? 200 : 503;
  
  return createSuccessResponse(healthData, statusCode, requestId);
};

export const handler = withCors(withErrorHandler(healthCheckHandler));