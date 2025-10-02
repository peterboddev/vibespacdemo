# Insurance Quotation Application Design

## Overview

The insurance quotation application is a web-based system that provides instant insurance quotes to customers while enabling agents and administrators to manage the quotation process. The system follows a microservices architecture with clear separation between the customer-facing quote engine, agent management interface, and administrative configuration system.

## Architecture

The application uses a layered architecture with automated deployment pipeline:

```mermaid
graph TB
    subgraph "Development Workflow"
        DEV[Developer]
        GIT[Git Repository]
        SYNTH[CDK Synth]
        DEPLOY[Auto Deploy]
        HEALTH[Health Check]
    end
    
    subgraph "Client Layer"
        A[Customer Web App]
        B[Agent Dashboard]
        C[Admin Panel]
    end
    
    subgraph "API Gateway"
        D[API Gateway/Load Balancer]
    end
    
    subgraph "Application Layer"
        E[Quote Service]
        F[User Service]
        G[Product Service]
        H[Notification Service]
    end
    
    subgraph "Data Layer"
        I[Quote Database]
        J[User Database]
        K[Product Database]
        L[Audit Database]
        M[Redis Cache]
    end
    
    DEV --> GIT
    GIT --> SYNTH
    SYNTH --> DEPLOY
    DEPLOY --> HEALTH
    HEALTH --> A
    HEALTH --> B
    HEALTH --> C
    
    A --> D
    B --> D
    C --> D
    D --> E
    D --> F
    D --> G
    D --> H
    E --> I
    F --> J
    G --> K
    H --> L
    E --> M
    F --> M
    G --> M
```

## Components and Interfaces

### 1. Quote Service
**Responsibilities:**
- Process quote requests and calculate premiums
- Apply risk assessment algorithms
- Generate and store quotes
- Manage quote lifecycle and expiration

**Key Interfaces:**
- `POST /api/quotes` - Create new quote
- `GET /api/quotes/{id}` - Retrieve quote by ID
- `PUT /api/quotes/{id}/status` - Update quote status
- `GET /api/quotes/search` - Search quotes with filters

### 2. User Service
**Responsibilities:**
- Manage customer and agent authentication
- Store and validate user profiles
- Handle user sessions and permissions

**Key Interfaces:**
- `POST /api/users/register` - Register new user
- `POST /api/users/login` - User authentication
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

### 3. Product Service
**Responsibilities:**
- Manage insurance products and coverage options
- Store and retrieve pricing rules
- Handle product configuration changes

**Key Interfaces:**
- `GET /api/products` - List available products
- `GET /api/products/{id}/coverage` - Get coverage options
- `POST /api/products` - Create new product (admin)
- `PUT /api/products/{id}/pricing` - Update pricing rules (admin)

### 4. Notification Service
**Responsibilities:**
- Send email notifications for quotes
- Handle system alerts and notifications
- Manage notification templates

**Key Interfaces:**
- `POST /api/notifications/email` - Send email notification
- `GET /api/notifications/templates` - Get notification templates
- `POST /api/notifications/templates` - Create notification template

### 5. Caching Layer
**Responsibilities:**
- Cache frequently accessed data (product information, pricing rules)
- Store temporary session data and rate limiting counters
- Improve API response times and reduce database load

**Implementation:**
- **ElastiCache Serverless Redis**: Auto-scaling cache with performance optimization
- **Connection Management**: Secure connection pooling with AWS Secrets Manager
- **Cache Strategies**: TTL-based expiration, cache-aside pattern
- **Key Prefixing**: Environment-specific key prefixes for isolation
- **Health Monitoring**: Built-in health checks for cache connectivity

### 6. Serverless Application Layer
**Responsibilities:**
- API Gateway with comprehensive security and CORS configuration
- Lambda functions with VPC integration and shared dependencies
- Environment-specific configurations and resource management
- Health monitoring and observability

**Implementation:**
- **API Gateway**: RESTful endpoints with IP-based access restrictions for production
- **Lambda Layers**: Docker-bundled shared dependencies for optimal performance
- **IAM Policies**: Least-privilege access to database, Redis, and VPC resources
- **CloudWatch Logs**: Environment-specific retention policies (1 week dev, 1 month prod)
- **Health Endpoints**: Built-in connectivity checks for all infrastructure components

## Data Models

### Quote Model
```typescript
interface Quote {
  id: string;
  referenceNumber: string;
  customerId: string;
  productType: InsuranceType;
  personalInfo: PersonalInfo;
  coverageDetails: CoverageDetails;
  riskAssessment: RiskAssessment;
  premium: PremiumCalculation;
  status: QuoteStatus;
  expirationDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface PersonalInfo {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  address: Address;
  contactInfo: ContactInfo;
}

interface CoverageDetails {
  coverageType: string;
  coverageAmount: number;
  deductible: number;
  additionalOptions: string[];
}

interface RiskAssessment {
  riskScore: number;
  riskFactors: RiskFactor[];
  adjustments: PremiumAdjustment[];
}

interface PremiumCalculation {
  basePremium: number;
  adjustments: number;
  discounts: number;
  finalPremium: number;
  breakdown: PremiumBreakdown[];
}
```

### User Model
```typescript
interface User {
  id: string;
  email: string;
  role: UserRole;
  profile: UserProfile;
  createdAt: Date;
  lastLoginAt: Date;
}

interface UserProfile {
  firstName: string;
  lastName: string;
  phone?: string;
  preferences: UserPreferences;
}

enum UserRole {
  CUSTOMER = 'customer',
  AGENT = 'agent',
  ADMIN = 'admin'
}
```

### Product Model
```typescript
interface InsuranceProduct {
  id: string;
  name: string;
  type: InsuranceType;
  description: string;
  coverageOptions: CoverageOption[];
  pricingRules: PricingRule[];
  riskFactors: RiskFactorDefinition[];
  isActive: boolean;
}

interface PricingRule {
  id: string;
  condition: string;
  adjustment: number;
  adjustmentType: 'percentage' | 'fixed';
  priority: number;
}
```

## Error Handling

### Error Response Format
```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId: string;
  };
}
```

### Error Categories
1. **Validation Errors (400)**: Invalid input data, missing required fields
2. **Authentication Errors (401)**: Invalid credentials, expired tokens
3. **Authorization Errors (403)**: Insufficient permissions
4. **Not Found Errors (404)**: Resource not found
5. **Business Logic Errors (422)**: Quote calculation failures, risk assessment issues
6. **Server Errors (500)**: Database connection issues, external service failures

### Error Handling Strategy
- All API endpoints return consistent error response format
- Client-side validation for immediate feedback
- Server-side validation for security and data integrity
- Graceful degradation for non-critical features
- Comprehensive logging for debugging and monitoring

## Testing Strategy

### Unit Testing
- Test individual components and functions in isolation
- Mock external dependencies and database calls
- Focus on business logic, calculations, and validation rules
- Target 90%+ code coverage for critical paths

### Integration Testing
- Test API endpoints with real database connections
- Verify service-to-service communication
- Test authentication and authorization flows
- Validate data persistence and retrieval

### End-to-End Testing
- Test complete user workflows from UI to database
- Verify quote generation process end-to-end
- Test agent and admin workflows
- Validate email notifications and external integrations

### Performance Testing
- Load testing for concurrent quote requests
- Database query optimization validation
- API response time benchmarking
- Memory and resource usage monitoring

### Security Testing
- Input validation and SQL injection prevention
- Authentication and session management testing
- Data encryption verification
- Access control and permission testing

### Test Data Management
- Use test databases with realistic but anonymized data
- Implement data seeding for consistent test scenarios
- Clean up test data after test execution
- Maintain separate test environments for different testing phases

## Deployment Automation

### Automated Deployment Pipeline

The system implements continuous deployment with the following workflow:

1. **Code Changes**: Developer commits infrastructure or application changes
2. **CDK Synthesis**: Automatic validation of CDK templates and TypeScript compilation
3. **Auto Deployment**: On successful synthesis, automatically deploy to development environment using `npm run cdk:synth-and-deploy`
4. **Health Checks**: Validate deployment with automated health checks (via deployment scripts)
5. **Rollback**: Automatic rollback on deployment or health check failures

### Deployment Stages

```mermaid
graph LR
    A[Code Commit] --> B[CDK Synth]
    B --> C{Synth Success?}
    C -->|Yes| D[Auto Deploy Dev]
    C -->|No| E[Build Failed]
    D --> F{Deploy Success?}
    F -->|Yes| G[Health Checks]
    F -->|No| H[Rollback]
    G --> I{Health OK?}
    I -->|Yes| J[Ready for Testing]
    I -->|No| H
    H --> K[Alert Team]
```

### Environment Strategy

- **Development**: Automatic deployment after successful synthesis using `npm run cdk:synth-and-deploy` or deployment scripts
- **Testing**: Manual promotion from development after validation
- **Production**: Manual approval required with additional safeguards

### Deployment Scripts

The project includes platform-specific deployment scripts with advanced features:

- **PowerShell Script** (`scripts/deploy-after-synth.ps1`): Windows deployment with health checks and rollback
- **Bash Script** (`scripts/deploy-after-synth.sh`): Unix/Linux deployment with health checks and rollback
- **NPM Script** (`cdk:synth-and-deploy`): Simple synthesis and deployment workflow

Both deployment scripts provide:
- Automated health checks after deployment
- Rollback capabilities on failure
- Environment-specific configuration
- Dry-run mode for testing
- Colored output and progress monitoring

### Health Check Components

1. **Infrastructure Health**: Verify all AWS resources are running
2. **Database Connectivity**: Test database connections and basic queries
3. **API Endpoints**: Validate all API endpoints respond correctly
4. **Service Integration**: Test inter-service communication

### Rollback Strategy

- Automatic rollback triggers on deployment failures
- CloudFormation stack rollback for infrastructure issues
- Lambda function version rollback for application issues
- Database migration rollback procedures for schema changes