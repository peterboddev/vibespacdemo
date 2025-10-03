"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const response_1 = require("../shared/response");
const middleware_1 = require("../shared/middleware");
const loginUserHandler = async (event, context) => {
    const requestId = event.requestContext?.requestId || context.awsRequestId || 'unknown';
    if (event.httpMethod !== 'POST') {
        return (0, response_1.createErrorResponse)('METHOD_NOT_ALLOWED', 'Only POST method is allowed', 405, requestId);
    }
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
    return (0, response_1.createSuccessResponse)(loginData, 200, requestId);
};
exports.handler = (0, middleware_1.withCors)((0, middleware_1.withErrorHandler)(loginUserHandler));
