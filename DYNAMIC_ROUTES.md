# Dynamic Route Generation System

This project implements a dynamic route generation system that allows developers to define API Gateway routes using annotations in Lambda function code, which are then automatically deployed via CDK.

## How It Works

### 1. Route Annotations

Add route annotations to your Lambda functions using JSDoc-style comments:

```typescript
/**
 * Create a new insurance quote
 * 
 * @route POST /api/v1/quotes
 * @auth required
 * @rateLimit 100/hour
 * @timeout 30
 * @memory 512
 * @description Creates a new insurance quote with validation
 */
export const createQuote = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Implementation
};
```

### 2. Available Annotations

- `@route <METHOD> <PATH>` - HTTP method and API path (required)
- `@auth <required|optional|none>` - Authentication requirement (default: none)
- `@rateLimit <limit>` - Rate limiting (e.g., "100/hour", "10/minute")
- `@timeout <seconds>` - Lambda timeout in seconds (default: 30)
- `@memory <MB>` - Lambda memory allocation in MB (default: 256)
- `@description <text>` - Function description for documentation

### 3. Route Generation Process

#### Development Workflow:
```bash
# Generate routes and deploy
npm run deploy-with-routes

# Or step by step:
npm run generate-routes  # Scan functions and generate routes.json
npm run cdk:synth       # Synthesize CDK with generated routes
npm run cdk:deploy      # Deploy infrastructure
```

#### CodeBuild Workflow:
1. **Scan Phase**: CodeBuild scans `src/lambda/` for route annotations
2. **Generate Phase**: Creates `infrastructure/generated/routes.json`
3. **Build Phase**: CDK uses the generated configuration to create API Gateway routes
4. **Deploy Phase**: Infrastructure and Lambda functions are deployed together

### 4. Generated Configuration

The route generator creates a configuration file at `infrastructure/generated/routes.json`:

```json
{
  "generatedAt": "2024-01-15T10:30:00.000Z",
  "functions": [
    {
      "functionName": "quotes-create",
      "filePath": "src/lambda/quotes/create.ts",
      "handlerName": "createQuote",
      "routes": [
        {
          "method": "POST",
          "path": "/api/v1/quotes",
          "auth": "required",
          "rateLimit": "100/hour",
          "timeout": 30,
          "memorySize": 512,
          "description": "Creates a new insurance quote with validation"
        }
      ]
    }
  ],
  "routes": [...]
}
```

### 5. Infrastructure Integration

The `ServerlessApp` construct automatically:
- Creates Lambda functions based on the generated configuration
- Sets up API Gateway routes with proper integration
- Configures authentication, rate limiting, and CORS
- Applies performance settings (timeout, memory)
- Sets up CloudWatch logging and monitoring

### 6. File Structure

```
src/lambda/
├── health/
│   └── handler.ts          # @route GET /api/v1/health
├── quotes/
│   ├── create.ts          # @route POST /api/v1/quotes
│   └── get.ts             # @route GET /api/v1/quotes/{id}
└── users/
    ├── register.ts        # @route POST /api/v1/users/register
    └── login.ts           # @route POST /api/v1/users/login

infrastructure/
├── constructs/
│   └── serverless-app.ts  # Main serverless infrastructure
├── utils/
│   └── route-generator.ts # Route scanning and generation logic
└── generated/
    └── routes.json        # Generated route configuration
```

### 7. Benefits

- **Developer Experience**: Simple annotations instead of complex CDK code
- **Consistency**: Standardized route configuration across all functions
- **Automation**: No manual infrastructure changes for new endpoints
- **Version Control**: All route definitions are in source code
- **Type Safety**: TypeScript annotations with validation
- **Documentation**: Self-documenting API through annotations

### 8. CodeBuild Integration

The `buildspec.yml` includes:
- Route generation in the pre-build phase
- CDK synthesis with generated routes
- Automated deployment with approval controls
- Artifact caching for faster builds

### 9. Example Usage

#### Simple GET Endpoint:
```typescript
/**
 * @route GET /api/v1/products
 * @auth none
 * @description Get all available insurance products
 */
export const getProducts = async (event: APIGatewayProxyEvent) => {
  // Implementation
};
```

#### Authenticated POST Endpoint:
```typescript
/**
 * @route POST /api/v1/quotes
 * @auth required
 * @rateLimit 50/hour
 * @timeout 45
 * @memory 1024
 * @description Create new insurance quote with risk assessment
 */
export const createQuote = async (event: APIGatewayProxyEvent) => {
  // Implementation
};
```

#### Path Parameters:
```typescript
/**
 * @route GET /api/v1/quotes/{id}
 * @auth required
 * @description Get quote by ID
 */
export const getQuote = async (event: APIGatewayProxyEvent) => {
  const quoteId = event.pathParameters?.id;
  // Implementation
};
```

### 10. Future Enhancements

- **OpenAPI Generation**: Auto-generate OpenAPI/Swagger documentation
- **Validation Schemas**: Include request/response validation in annotations
- **Custom Authorizers**: Support for custom Lambda authorizers
- **API Versioning**: Automatic API versioning and deprecation handling
- **Monitoring**: Enhanced CloudWatch metrics and alarms per route
- **Testing**: Auto-generate integration tests from route definitions