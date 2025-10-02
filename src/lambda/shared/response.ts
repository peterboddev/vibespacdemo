import { APIGatewayProxyResult } from 'aws-lambda';
import { ErrorResponse, SuccessResponse } from './types';

export const createSuccessResponse = <T>(
  data: T,
  statusCode: number = 200,
  requestId: string = 'unknown'
): APIGatewayProxyResult => {
  const response: SuccessResponse<T> = {
    data,
    timestamp: new Date().toISOString(),
    requestId
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    },
    body: JSON.stringify(response)
  };
};

export const createErrorResponse = (
  code: string,
  message: string,
  statusCode: number = 500,
  requestId: string = 'unknown',
  details?: any
): APIGatewayProxyResult => {
  const response: ErrorResponse = {
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
      requestId
    }
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    },
    body: JSON.stringify(response)
  };
};