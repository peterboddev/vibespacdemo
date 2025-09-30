import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

/**
 * Standard Lambda handler type for API Gateway integration
 * Ensures consistent function signatures across all Lambda handlers
 */
export type LambdaHandler = (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<APIGatewayProxyResult>;

/**
 * Standardized error response format for all API endpoints
 * Provides consistent error structure with debugging information
 */
export interface ErrorResponse {
  error: {
    code: string;           // Machine-readable error code
    message: string;        // Human-readable error message
    details?: any;          // Optional additional error context
    timestamp: string;      // ISO timestamp of when error occurred
    requestId: string;      // Unique request identifier for tracing
  };
}

/**
 * Generic success response wrapper for all API endpoints
 * Provides consistent response structure with metadata
 */
export interface SuccessResponse<T = any> {
  data: T;               // Response payload of any type
  timestamp: string;     // ISO timestamp of response
  requestId: string;     // Unique request identifier for tracing
}