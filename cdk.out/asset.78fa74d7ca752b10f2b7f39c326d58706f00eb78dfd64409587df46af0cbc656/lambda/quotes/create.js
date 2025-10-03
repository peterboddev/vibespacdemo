"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const response_1 = require("../shared/response");
const middleware_1 = require("../shared/middleware");
const validation_1 = require("../shared/validation");
const quote_calculator_1 = require("../shared/quote-calculator");
const createQuoteHandler = async (event, context) => {
    const requestId = event.requestContext?.requestId || context.awsRequestId || 'unknown';
    console.log(`[${requestId}] Processing quote creation request`);
    if (event.httpMethod !== 'POST') {
        return (0, response_1.createErrorResponse)('METHOD_NOT_ALLOWED', 'Only POST method is allowed', 405, requestId);
    }
    try {
        let requestBody;
        try {
            requestBody = JSON.parse(event.body || '{}');
        }
        catch (error) {
            console.error(`[${requestId}] Invalid JSON in request body:`, error);
            return (0, response_1.createErrorResponse)('INVALID_JSON', 'Request body must be valid JSON', 400, requestId);
        }
        const validation = (0, validation_1.validateQuoteRequest)(requestBody);
        if (!validation.isValid) {
            console.warn(`[${requestId}] Validation failed:`, validation.errors);
            return (0, response_1.createErrorResponse)('VALIDATION_ERROR', 'Request validation failed', 400, requestId, { validationErrors: validation.errors });
        }
        const quoteRequest = requestBody;
        const quote = quote_calculator_1.QuoteCalculator.calculateQuote(quoteRequest);
        console.log(`[${requestId}] Quote created successfully:`, {
            id: quote.id,
            referenceNumber: quote.referenceNumber,
            totalPremium: quote.premium.totalPremium
        });
        return (0, response_1.createSuccessResponse)(quote, 201, requestId);
    }
    catch (error) {
        console.error(`[${requestId}] Unexpected error in quote creation:`, error);
        return (0, response_1.createErrorResponse)('INTERNAL_ERROR', 'An unexpected error occurred while creating the quote', 500, requestId);
    }
};
exports.handler = (0, middleware_1.withCors)((0, middleware_1.withErrorHandler)(createQuoteHandler));
