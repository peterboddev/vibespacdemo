import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from './create';
import { InsuranceType } from '../shared/types';

// Mock context
const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test-function',
  logStreamName: '2023/01/01/[$LATEST]test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {}
};

// Helper to create mock API Gateway event
const createMockEvent = (
  httpMethod: string = 'POST',
  body: string | null = null
): APIGatewayProxyEvent => ({
  body,
  headers: {},
  multiValueHeaders: {},
  httpMethod,
  isBase64Encoded: false,
  path: '/api/quotes',
  pathParameters: null,
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  stageVariables: null,
  requestContext: {
    requestId: 'test-request-id',
    stage: 'test',
    requestTimeEpoch: Date.now(),
    requestTime: new Date().toISOString(),
    authorizer: {},
    identity: {
      cognitoIdentityPoolId: null,
      accountId: null,
      cognitoIdentityId: null,
      caller: null,
      sourceIp: '127.0.0.1',
      principalOrgId: null,
      accessKey: null,
      cognitoAuthenticationType: null,
      cognitoAuthenticationProvider: null,
      userArn: null,
      userAgent: 'test-agent',
      user: null,
      apiKey: null,
      apiKeyId: null,
      clientCert: null
    },
    path: '/api/quotes',
    resourcePath: '/api/quotes',
    httpMethod,
    apiId: 'test-api',
    protocol: 'HTTP/1.1',
    resourceId: 'test-resource',
    accountId: '123456789012',
    domainName: 'test-domain',
    domainPrefix: 'test'
  },
  resource: '/api/quotes'
});

describe('Quote Creation Lambda', () => {
  test('should reject non-POST requests', async () => {
    const event = createMockEvent('GET');
    const result = await handler(event, mockContext);
    
    expect(result.statusCode).toBe(405);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('METHOD_NOT_ALLOWED');
  });

  test('should reject invalid JSON', async () => {
    const event = createMockEvent('POST', 'invalid json');
    const result = await handler(event, mockContext);
    
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('INVALID_JSON');
  });

  test('should reject missing required fields', async () => {
    const event = createMockEvent('POST', '{}');
    const result = await handler(event, mockContext);
    
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details.validationErrors).toBeDefined();
  });

  test('should create quote with valid request', async () => {
    const validRequest = {
      personalInfo: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '555-123-4567',
        dateOfBirth: '1985-06-15',
        address: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345'
        }
      },
      coverageDetails: {
        insuranceType: InsuranceType.AUTO,
        coverageAmount: 50000,
        deductible: 1000
      }
    };

    const event = createMockEvent('POST', JSON.stringify(validRequest));
    const result = await handler(event, mockContext);
    
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.data).toBeDefined();
    expect(body.data.id).toBeDefined();
    expect(body.data.referenceNumber).toMatch(/^QT-/);
    expect(body.data.premium).toBeDefined();
    expect(body.data.premium.totalPremium).toBeGreaterThan(0);
    expect(body.data.status).toBe('active');
  });

  test('should calculate different premiums for different insurance types', async () => {
    const baseRequest = {
      personalInfo: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '555-123-4567',
        dateOfBirth: '1985-06-15',
        address: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345'
        }
      },
      coverageDetails: {
        insuranceType: InsuranceType.AUTO,
        coverageAmount: 50000,
        deductible: 1000
      }
    };

    // Test AUTO insurance
    const autoEvent = createMockEvent('POST', JSON.stringify(baseRequest));
    const autoResult = await handler(autoEvent, mockContext);
    const autoBody = JSON.parse(autoResult.body);

    // Test HOME insurance
    const homeRequest = { ...baseRequest };
    homeRequest.coverageDetails.insuranceType = InsuranceType.HOME;
    const homeEvent = createMockEvent('POST', JSON.stringify(homeRequest));
    const homeResult = await handler(homeEvent, mockContext);
    const homeBody = JSON.parse(homeResult.body);

    expect(autoResult.statusCode).toBe(201);
    expect(homeResult.statusCode).toBe(201);
    
    // Premiums should be different for different insurance types
    expect(autoBody.data.premium.totalPremium).not.toBe(homeBody.data.premium.totalPremium);
  });

  test('should apply deductible discounts', async () => {
    const baseRequest = {
      personalInfo: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '555-123-4567',
        dateOfBirth: '1985-06-15',
        address: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345'
        }
      },
      coverageDetails: {
        insuranceType: InsuranceType.AUTO,
        coverageAmount: 50000,
        deductible: 500
      }
    };

    // Test low deductible
    const lowDeductibleEvent = createMockEvent('POST', JSON.stringify(baseRequest));
    const lowDeductibleResult = await handler(lowDeductibleEvent, mockContext);
    const lowDeductibleBody = JSON.parse(lowDeductibleResult.body);

    // Test high deductible
    const highDeductibleRequest = { ...baseRequest };
    highDeductibleRequest.coverageDetails.deductible = 2000;
    const highDeductibleEvent = createMockEvent('POST', JSON.stringify(highDeductibleRequest));
    const highDeductibleResult = await handler(highDeductibleEvent, mockContext);
    const highDeductibleBody = JSON.parse(highDeductibleResult.body);

    expect(lowDeductibleResult.statusCode).toBe(201);
    expect(highDeductibleResult.statusCode).toBe(201);
    
    // Higher deductible should result in lower premium due to discount
    expect(highDeductibleBody.data.premium.totalPremium).toBeLessThan(
      lowDeductibleBody.data.premium.totalPremium
    );
    expect(highDeductibleBody.data.premium.discounts).toBeGreaterThan(
      lowDeductibleBody.data.premium.discounts
    );
  });
});