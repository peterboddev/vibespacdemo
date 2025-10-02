import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createSuccessResponse, createErrorResponse } from '../shared/response';
import { withErrorHandler, withCors } from '../shared/middleware';
import { validateQuoteRequest } from '../shared/validation';
import { QuoteCalculator } from '../shared/quote-calculator';
import { QuoteRequest } from '../shared/types';

const createQuoteHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || context.awsRequestId || 'unknown';
  
  console.log(`[${requestId}] Processing quote creation request`);
  
  if (event.httpMethod !== 'POST') {
    return createErrorResponse(
      'METHOD_NOT_ALLOWED',
      'Only POST method is allowed',
      405,
      requestId
    );
  }
  
  try {
    // Parse request body
    let requestBody: any;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (error) {
      console.error(`[${requestId}] Invalid JSON in request body:`, error);
      return createErrorResponse(
        'INVALID_JSON',
        'Request body must be valid JSON',
        400,
        requestId
      );
    }
    
    // Validate request
    const validation = validateQuoteRequest(requestBody);
    if (!validation.isValid) {
      console.warn(`[${requestId}] Validation failed:`, validation.errors);
      return createErrorResponse(
        'VALIDATION_ERROR',
        'Request validation failed',
        400,
        requestId,
        { validationErrors: validation.errors }
      );
    }
    
    // Calculate quote
    const quoteRequest: QuoteRequest = requestBody;
    const quote = QuoteCalculator.calculateQuote(quoteRequest);
    
    console.log(`[${requestId}] Quote created successfully:`, {
      id: quote.id,
      referenceNumber: quote.referenceNumber,
      totalPremium: quote.premium.totalPremium
    });
    
    // Return successful response
    return createSuccessResponse(quote, 201, requestId);
    
  } catch (error) {
    console.error(`[${requestId}] Unexpected error in quote creation:`, error);
    return createErrorResponse(
      'INTERNAL_ERROR',
      'An unexpected error occurred while creating the quote',
      500,
      requestId
    );
  }
};

export const handler = withCors(withErrorHandler(createQuoteHandler));