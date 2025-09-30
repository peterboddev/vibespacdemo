import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createSuccessResponse } from '../shared/response';
import { withErrorHandler, withCors } from '../shared/middleware';

const healthCheckHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || context.awsRequestId || 'unknown';
  
  const healthData = {
    status: 'OK',
    service: 'insurance-quotation-api',
    version: process.env['SERVICE_VERSION'] || '1.0.0',
    environment: process.env['NODE_ENV'] || 'development',
    region: process.env['AWS_REGION'] || 'unknown',
    functionName: context.functionName,
    memoryLimit: context.memoryLimitInMB
  };
  
  return createSuccessResponse(healthData, 200, requestId);
};

export const handler = withCors(withErrorHandler(healthCheckHandler));