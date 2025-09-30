
import { createErrorResponse } from './response';
import { LambdaHandler } from './types';

export const withErrorHandler = (handler: LambdaHandler): LambdaHandler => {
  return async (event, context) => {
    try {
      return await handler(event, context);
    } catch (error) {
      console.error('Lambda error:', error);
      
      const requestId = event.requestContext?.requestId || context.awsRequestId || 'unknown';
      
      if (error instanceof Error) {
        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          'An unexpected error occurred',
          500,
          requestId,
          process.env['NODE_ENV'] === 'development' ? error.stack : undefined
        );
      }
      
      return createErrorResponse(
        'UNKNOWN_ERROR',
        'An unknown error occurred',
        500,
        requestId
      );
    }
  };
};

export const withCors = (handler: LambdaHandler): LambdaHandler => {
  return async (event, context) => {
    // Handle preflight OPTIONS requests
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: ''
      };
    }
    
    const result = await handler(event, context);
    
    // Ensure CORS headers are present
    return {
      ...result,
      headers: {
        ...result.headers,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      }
    };
  };
};

export const withValidation = (
  _schema: any,
  handler: LambdaHandler
): LambdaHandler => {
  return async (event, context) => {
    try {
      if (event.body) {
        JSON.parse(event.body);
      }
      
      // Validation logic would go here
      // For now, just pass through
      
      return await handler(event, context);
    } catch (error) {
      const requestId = event.requestContext?.requestId || context.awsRequestId || 'unknown';
      
      return createErrorResponse(
        'VALIDATION_ERROR',
        'Invalid request body',
        400,
        requestId
      );
    }
  };
};