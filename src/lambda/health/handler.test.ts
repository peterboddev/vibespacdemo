import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from './handler';

// Mock the Redis manager
jest.mock('../../database/redis', () => ({
  redisManager: {
    isReady: jest.fn(),
    initialize: jest.fn(),
    healthCheck: jest.fn(),
  },
}));

// Mock the database connection
jest.mock('../../database/connection', () => ({
  healthCheck: jest.fn(),
}));

const mockRedisManager = require('../../database/redis').redisManager;
const mockDatabaseHealthCheck = require('../../database/connection').healthCheck;

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
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should return healthy status when all services are healthy', async () => {
    // Mock Redis as healthy
    mockRedisManager.isReady.mockReturnValue(true);
    mockRedisManager.healthCheck.mockResolvedValue({
      status: 'healthy',
      latency: 50,
    });

    // Mock Database as healthy
    mockDatabaseHealthCheck.mockResolvedValue(true);

    const event = createMockEvent();
    const context = createMockContext();
    
    const result = await handler(event, context);
    
    expect(result.statusCode).toBe(200);
    expect(result.headers).toHaveProperty('Content-Type', 'application/json');
    
    const body = JSON.parse(result.body);
    expect(body.data).toHaveProperty('status', 'OK');
    expect(body.data).toHaveProperty('service', 'insurance-quotation-api');
    expect(body.data.checks.redis.status).toBe('healthy');
    expect(body.data.checks.database.status).toBe('healthy');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('requestId', 'test-request-id');
  });

  it('should return degraded status when Redis is unhealthy', async () => {
    // Mock Redis as unhealthy
    mockRedisManager.isReady.mockReturnValue(false);
    mockRedisManager.initialize.mockRejectedValue(new Error('Redis connection failed'));
    mockRedisManager.healthCheck.mockResolvedValue({
      status: 'unhealthy',
      latency: 1000,
    });

    // Mock Database as healthy
    mockDatabaseHealthCheck.mockResolvedValue(true);

    const event = createMockEvent();
    const context = createMockContext();
    
    const result = await handler(event, context);
    
    expect(result.statusCode).toBe(503);
    
    const body = JSON.parse(result.body);
    expect(body.data.status).toBe('DEGRADED');
    expect(body.data.checks.redis.status).toBe('unhealthy');
    expect(body.data.checks.database.status).toBe('healthy');
  });

  it('should return degraded status when database is unhealthy', async () => {
    // Mock Redis as healthy
    mockRedisManager.isReady.mockReturnValue(true);
    mockRedisManager.healthCheck.mockResolvedValue({
      status: 'healthy',
      latency: 25,
    });

    // Mock Database as unhealthy
    mockDatabaseHealthCheck.mockResolvedValue(false);

    const event = createMockEvent();
    const context = createMockContext();
    
    const result = await handler(event, context);
    
    expect(result.statusCode).toBe(503);
    
    const body = JSON.parse(result.body);
    expect(body.data.status).toBe('DEGRADED');
    expect(body.data.checks.redis.status).toBe('healthy');
    expect(body.data.checks.database.status).toBe('unhealthy');
  });

  it('should handle database connection errors gracefully', async () => {
    // Mock Redis as healthy
    mockRedisManager.isReady.mockReturnValue(true);
    mockRedisManager.healthCheck.mockResolvedValue({
      status: 'healthy',
      latency: 30,
    });

    // Mock Database connection error
    mockDatabaseHealthCheck.mockRejectedValue(new Error('Database connection timeout'));

    const event = createMockEvent();
    const context = createMockContext();
    
    const result = await handler(event, context);
    
    expect(result.statusCode).toBe(503);
    
    const body = JSON.parse(result.body);
    expect(body.data.status).toBe('DEGRADED');
    expect(body.data.checks.database.status).toBe('unhealthy');
    expect(body.data.checks.database.error).toBe('Database connection timeout');
  });
  
  it('should handle CORS preflight requests', async () => {
    const event = createMockEvent({ httpMethod: 'OPTIONS' });
    const context = createMockContext();
    
    const result = await handler(event, context);
    
    expect(result.statusCode).toBe(200);
    expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
    expect(result.headers).toHaveProperty('Access-Control-Allow-Methods');
  });

  it('should include comprehensive service metadata', async () => {
    // Mock services as healthy
    mockRedisManager.isReady.mockReturnValue(true);
    mockRedisManager.healthCheck.mockResolvedValue({
      status: 'healthy',
      latency: 40,
    });
    mockDatabaseHealthCheck.mockResolvedValue(true);

    const event = createMockEvent();
    const context = createMockContext();
    
    const result = await handler(event, context);
    
    const body = JSON.parse(result.body);
    expect(body.data).toHaveProperty('service', 'insurance-quotation-api');
    expect(body.data).toHaveProperty('version');
    expect(body.data).toHaveProperty('environment');
    expect(body.data).toHaveProperty('functionName', 'test-health-function');
    expect(body.data).toHaveProperty('memoryLimit', '128');
    expect(body.data).toHaveProperty('timestamp');
    expect(body.data.checks).toHaveProperty('redis');
    expect(body.data.checks).toHaveProperty('database');
  });
});