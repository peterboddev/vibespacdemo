import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createSuccessResponse, createErrorResponse } from '../shared/response';
import { withErrorHandler, withCors } from '../shared/middleware';

/**
 * Get insurance quote by ID endpoint
 * 
 * @route GET /api/v1/quotes/{id}
 * @auth none
 * @description Retrieves an insurance quote by its ID
 * @timeout 30
 * @memory 256
 */

const getQuoteHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || context.awsRequestId || 'unknown';
  
  if (event.httpMethod !== 'GET') {
    return createErrorResponse(
      'METHOD_NOT_ALLOWED',
      'Only GET method is allowed',
      405,
      requestId
    );
  }
  
  const quoteId = event.pathParameters?.['id'];
  
  if (!quoteId) {
    return createErrorResponse(
      'MISSING_PARAMETER',
      'Quote ID is required',
      400,
      requestId
    );
  }
  
  // TODO: Implement quote retrieval logic in future tasks
  // For now, return a placeholder response
  
  const quoteData = {
    id: quoteId,
    referenceNumber: 'QT-' + quoteId,
    status: 'active',
    message: 'Quote retrieval endpoint - implementation pending'
  };
  
  return createSuccessResponse(quoteData, 200, requestId);
};

export const handler = withCors(withErrorHandler(getQuoteHandler));