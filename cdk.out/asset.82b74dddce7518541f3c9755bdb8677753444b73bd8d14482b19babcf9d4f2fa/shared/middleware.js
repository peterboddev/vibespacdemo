"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withValidation = exports.withCors = exports.withErrorHandler = void 0;
const response_1 = require("./response");
const withErrorHandler = (handler) => {
    return async (event, context) => {
        try {
            return await handler(event, context);
        }
        catch (error) {
            console.error('Lambda error:', error);
            const requestId = event.requestContext?.requestId || context.awsRequestId || 'unknown';
            if (error instanceof Error) {
                return (0, response_1.createErrorResponse)('INTERNAL_SERVER_ERROR', 'An unexpected error occurred', 500, requestId, process.env['NODE_ENV'] === 'development' ? error.stack : undefined);
            }
            return (0, response_1.createErrorResponse)('UNKNOWN_ERROR', 'An unknown error occurred', 500, requestId);
        }
    };
};
exports.withErrorHandler = withErrorHandler;
const withCors = (handler) => {
    return async (event, context) => {
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
exports.withCors = withCors;
const withValidation = (_schema, handler) => {
    return async (event, context) => {
        try {
            if (event.body) {
                JSON.parse(event.body);
            }
            return await handler(event, context);
        }
        catch (error) {
            const requestId = event.requestContext?.requestId || context.awsRequestId || 'unknown';
            return (0, response_1.createErrorResponse)('VALIDATION_ERROR', 'Invalid request body', 400, requestId);
        }
    };
};
exports.withValidation = withValidation;
