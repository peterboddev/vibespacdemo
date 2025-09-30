import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createSuccessResponse, createErrorResponse } from '../shared/response';
import { withErrorHandler, withCors } from '../shared/middleware';

const createQuoteHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || context.awsRequestId || 'unknown';
  
  // TODO: Implement quote creation logic in future tasks
  // For now, return a placeholder response
  
  if (event.httpMethod !== 'POST') {
    return createErrorResponse(
      'METHOD_NOT_ALLOWED',
      'Only POST method is allowed',
      405,
      requestId
    );
  }
  
  // Placeholder response
  const quoteData = {
    id: 'quote-placeholder-' + Date.now(),
    referenceNumber: 'QT-' + Date.now(),
    status: 'draft',
    message: 'Quote creation endpoint - implementation pending'
  };
  
  return createSuccessResponse(quoteData, 201, requestId);
};

export const handler = withCors(withErrorHandler(createQuoteHandler));