import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createSuccessResponse, createErrorResponse } from '../shared/response';
import { withErrorHandler, withCors } from '../shared/middleware';

const loginUserHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || context.awsRequestId || 'unknown';
  
  if (event.httpMethod !== 'POST') {
    return createErrorResponse(
      'METHOD_NOT_ALLOWED',
      'Only POST method is allowed',
      405,
      requestId
    );
  }
  
  // TODO: Implement user login logic in future tasks
  // For now, return a placeholder response
  
  const loginData = {
    token: 'placeholder-jwt-token-' + Date.now(),
    expiresIn: '24h',
    user: {
      id: 'user-placeholder',
      email: 'placeholder@example.com',
      role: 'customer'
    },
    message: 'User login endpoint - implementation pending'
  };
  
  return createSuccessResponse(loginData, 200, requestId);
};

export const handler = withCors(withErrorHandler(loginUserHandler));