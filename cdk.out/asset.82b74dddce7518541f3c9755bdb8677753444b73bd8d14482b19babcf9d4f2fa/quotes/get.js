"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const response_1 = require("../shared/response");
const middleware_1 = require("../shared/middleware");
const getQuoteHandler = async (event, context) => {
    const requestId = event.requestContext?.requestId || context.awsRequestId || 'unknown';
    if (event.httpMethod !== 'GET') {
        return (0, response_1.createErrorResponse)('METHOD_NOT_ALLOWED', 'Only GET method is allowed', 405, requestId);
    }
    const quoteId = event.pathParameters?.['id'];
    if (!quoteId) {
        return (0, response_1.createErrorResponse)('MISSING_PARAMETER', 'Quote ID is required', 400, requestId);
    }
    const quoteData = {
        id: quoteId,
        referenceNumber: 'QT-' + quoteId,
        status: 'active',
        message: 'Quote retrieval endpoint - implementation pending'
    };
    return (0, response_1.createSuccessResponse)(quoteData, 200, requestId);
};
exports.handler = (0, middleware_1.withCors)((0, middleware_1.withErrorHandler)(getQuoteHandler));
