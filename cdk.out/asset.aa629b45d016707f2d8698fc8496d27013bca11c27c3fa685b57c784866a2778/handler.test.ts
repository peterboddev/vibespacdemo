import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from './handler';

// Mock event and context for testing
const createMockEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent => ({
  body: null,
  headers: {},
  multiValueHeaders: {},
  httpMethod: 'GET',
  isBase64Encoded: false,
  path: '/health',
  pathParameters: null,
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  stageVariables: null,
  requestContext: {
    requestId: 'test-request-id',
    stage: 'test',
    resourceId: 'test-resource',
    httpMethod: 'GET',
    resourcePath: '/health',
    path: '/test/health',
    accountId: '123456789012',
    apiId: 'test-api-id',
    protocol: 'HTTP/1.1',
    requestTime: '01/Jan/2023:00:00:00 +0000',
    requestTimeEpoch: 1672531200000,
    identity: {
      accessKey: null,
      accountId: null,
      apiKey: null,
      apiKeyId: null,
      caller: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: '127.0.0.1',
      user: null,
      userAgent: 'test-agent',
      userArn: null,
      clientCert: null
    },
    authorizer: null
  },
  resource: '/health',
  ...overrides
});

const createMockContext = (overrides: Partial<Context> = {}): Context => ({
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-health-function',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-health-function',
  memoryLimitInMB: '128',
  awsRequestId: 'test-aws-request-id',
  logGroupName: '/aws/lambda/test-health-function',
  logStreamName: '2023/01/01/[$LATEST]test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
  ...overrides
});

describe('Health Check Lambda Handler', () => {
  it('should return health status', async () => {
    const event = createMockEvent();
    const context = createMockContext();
    
    const result = await handler(event, context);
    
    expect(result.statusCode).toBe(200);
    expect(result.headers).toHaveProperty('Content-Type', 'application/json');
    
    const body = JSON.parse(result.body);
    expect(body.data).toHaveProperty('status', 'OK');
    expect(body.data).toHaveProperty('service', 'insurance-quotation-api');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('requestId', 'test-request-id');
  });
  
  it('should handle CORS preflight requests', async () => {
    const event = createMockEvent({ httpMethod: 'OPTIONS' });
    const context = createMockContext();
    
    const result = await handler(event, context);
    
    expect(result.statusCode).toBe(200);
    expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
    expect(result.headers).toHaveProperty('Access-Control-Allow-Methods');
  });
});