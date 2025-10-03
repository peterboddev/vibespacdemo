import { APIGatewayProxyResult } from 'aws-lambda';
export declare const createSuccessResponse: <T>(data: T, statusCode?: number, requestId?: string) => APIGatewayProxyResult;
export declare const createErrorResponse: (code: string, message: string, statusCode?: number, requestId?: string, details?: any) => APIGatewayProxyResult;
//# sourceMappingURL=response.d.ts.map