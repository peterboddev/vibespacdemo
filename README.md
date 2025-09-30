# Insurance Quotation API

A comprehensive insurance quotation system that allows customers to request quotes, agents to manage quotes, and administrators to configure products and pricing.

## Project Structure

```
src/
├── lambda/        # AWS Lambda function handlers
│   ├── shared/    # Common Lambda utilities and types
│   ├── health/    # Health check endpoint
│   ├── quotes/    # Quote management endpoints
│   ├── users/     # User authentication endpoints
│   └── index.ts   # Lambda handler exports
├── models/        # TypeScript interfaces and data models
├── services/      # Business logic services
├── repositories/  # Data access layer
├── middleware/    # Express middleware functions (legacy)
├── utils/         # Utility functions and helpers
├── test/          # Test setup and utilities
└── index.ts       # Application entry point (legacy)
```

### Lambda Architecture

The application has been refactored to use AWS Lambda functions with API Gateway:

```
src/lambda/
├── shared/
│   ├── types.ts          # Lambda handler types and response interfaces
│   ├── response.ts       # Standardized API response utilities
│   └── middleware.ts     # Lambda middleware (CORS, error handling, validation)
├── health/
│   ├── handler.ts        # Health check endpoint
│   └── handler.test.ts   # Unit tests
├── quotes/
│   ├── create.ts         # POST /api/quotes
│   └── get.ts           # GET /api/quotes/{id}
├── users/
│   ├── register.ts       # POST /api/users/register
│   └── login.ts         # POST /api/users/login
└── index.ts             # Export all handlers
```

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- PostgreSQL database
- Redis (optional, for caching)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your configuration

### Development

Start the development server:
```bash
npm run dev
```

### Building

Build the project:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

### Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Generate coverage report:
```bash
npm run test:coverage
```

### Linting

Check code style:
```bash
npm run lint
```

Fix linting issues:
```bash
npm run lint:fix
```

## Data Models

The application includes comprehensive TypeScript interfaces for all core entities:

### Quote Models
- `Quote` - Complete quote with all details, calculations, and metadata
- `QuoteRequest` - Input data for creating new quotes
- `PersonalInfo` - Customer personal information
- `CoverageDetails` - Insurance coverage specifications
- `RiskAssessment` - Risk evaluation and scoring
- `PremiumCalculation` - Premium breakdown and calculations
- `QuoteSearchFilters` - Search and filtering criteria

### User Models
- `User` - Complete user profile with authentication data
- `UserRegistration` - New user signup data
- `UserLogin` - Authentication credentials
- `UserProfile` - User profile information
- `AuthToken` - JWT authentication token structure

### Product Models
- `InsuranceProduct` - Complete insurance product definition
- `ProductCreateRequest` - New product creation data
- `CoverageOption` - Available coverage options and limits
- `PricingRule` - Configurable pricing rules and adjustments
- `RiskFactorDefinition` - Risk assessment factor definitions

### Common Types
- `InsuranceType` - Enum for insurance product types (AUTO, HOME, LIFE, HEALTH, BUSINESS)
- `UserRole` - Enum for user roles (CUSTOMER, AGENT, ADMIN)
- `QuoteStatus` - Enum for quote lifecycle states
- `Address` - Standard address structure
- `ContactInfo` - Contact information and preferences

### Lambda Types (src/lambda/shared/types.ts)
- `LambdaHandler` - Type definition for AWS Lambda handler functions
- `ErrorResponse` - Standardized API error response format
- `SuccessResponse<T>` - Generic success response wrapper with data, timestamp, and requestId

All models are exported from `src/models/index.ts` for easy importing throughout the application.
Lambda-specific types are available from `src/lambda/shared/types.ts`.

## API Documentation

The API is implemented as AWS Lambda functions behind API Gateway.

### Available Endpoints

#### Health Check
- `GET /health` - Service status and metadata

#### Quote Management
- `POST /api/quotes` - Create new insurance quote (placeholder)
- `GET /api/quotes/{id}` - Retrieve quote by ID (placeholder)

#### User Management
- `POST /api/users/register` - User registration (placeholder)
- `POST /api/users/login` - User authentication (placeholder)

### Response Format

All API responses follow a standardized format:

**Success Response:**
```json
{
  "data": { /* response data */ },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "unique-request-id"
}
```

**Error Response:**
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": { /* optional error details */ },
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "unique-request-id"
  }
}
```

### CORS Support

All endpoints include proper CORS headers for cross-origin requests:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Headers: Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token`
- `Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS`

## Architecture

The application follows a serverless architecture using AWS Lambda:

- **Lambda Layer**: AWS Lambda function handlers with API Gateway integration
- **Shared Layer**: Common utilities, types, and middleware for Lambda functions
- **Service Layer**: Business logic and orchestration (to be implemented)
- **Repository Layer**: Data access and persistence (to be implemented)
- **Model Layer**: TypeScript interfaces and data structures

### Lambda Middleware

The application includes reusable middleware for Lambda functions:

- **Error Handler**: Catches and formats unhandled errors with proper logging
- **CORS Handler**: Manages cross-origin requests and preflight OPTIONS requests
- **Validation Handler**: Request body validation framework (extensible)

### Response Utilities

Standardized response creation utilities ensure consistent API responses:
- `createSuccessResponse<T>(data, statusCode, requestId)` - Success responses
- `createErrorResponse(code, message, statusCode, requestId, details)` - Error responses

## Features

- Insurance quote generation and management
- User authentication and authorization
- Product and pricing configuration
- Email notifications
- Comprehensive error handling
- Security best practices
- Comprehensive test coverage