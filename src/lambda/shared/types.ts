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

/**
 * Insurance types supported by the quotation system
 */
export enum InsuranceType {
  AUTO = 'auto',
  HOME = 'home',
  LIFE = 'life',
  HEALTH = 'health'
}

/**
 * Quote status enumeration
 */
export enum QuoteStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CONVERTED = 'converted'
}

/**
 * Personal information for quote requests
 */
export interface PersonalInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

/**
 * Coverage details for insurance quote
 */
export interface CoverageDetails {
  insuranceType: InsuranceType;
  coverageAmount: number;
  deductible: number;
  additionalOptions?: string[];
}

/**
 * Quote request payload from client
 */
export interface QuoteRequest {
  personalInfo: PersonalInfo;
  coverageDetails: CoverageDetails;
}

/**
 * Complete quote response with calculated premium
 */
export interface Quote {
  id: string;
  referenceNumber: string;
  personalInfo: PersonalInfo;
  coverageDetails: CoverageDetails;
  premium: {
    basePremium: number;
    discounts: number;
    surcharges: number;
    totalPremium: number;
  };
  status: QuoteStatus;
  expirationDate: string;
  createdAt: string;
  updatedAt: string;
}